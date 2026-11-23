import { parse as parseTld } from "tldts";
import type { TabsController } from "./index";
import { FolderTabGroup } from "./tab-groups/folder";
import { serializeTab } from "@/saving/tabs/serialization";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { windowTabsChanged } from "@/ipc/browser/tabs";
import { generateID } from "@/modules/utils";
import { isSyncExcludedTab, isTabSyncEnabled } from "./tab-sync";
import type { PersistedTabData, TidyResult } from "~/types/tabs";
import type { Tab } from "./tab";

const KNOWN_SITE_LABELS: Record<string, string> = {
  "github.com": "GitHub",
  "gitlab.com": "GitLab",
  "linear.app": "Linear",
  "figma.com": "Figma",
  "notion.so": "Notion",
  "notion.site": "Notion",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "slack.com": "Slack",
  "discord.com": "Discord",
  "stripe.com": "Stripe",
  "vercel.com": "Vercel",
  "stackoverflow.com": "Stack Overflow",
  "reddit.com": "Reddit",
  "x.com": "X",
  "twitter.com": "Twitter",
  "wikipedia.org": "Wikipedia",
  "spotify.com": "Spotify",
  "chatgpt.com": "ChatGPT",
  "openai.com": "OpenAI",
  "claude.ai": "Claude",
  "anthropic.com": "Anthropic",
  "atlassian.net": "Atlassian",
  "jira.com": "Jira",
  "google.com": "Google"
};

const KNOWN_HOST_LABELS: Record<string, string> = {
  "docs.google.com": "Google Docs",
  "drive.google.com": "Google Drive",
  "mail.google.com": "Gmail",
  "calendar.google.com": "Calendar",
  "meet.google.com": "Google Meet",
  "news.ycombinator.com": "Hacker News"
};

interface UndoTabSnapshot {
  uniqueId: string;
  serialized: PersistedTabData;
  originalGroupId: string | null;
  wasAsleep: boolean;
}

interface TidyUndoSnapshot {
  windowId: number;
  spaceId: string;
  focusedTabUniqueId: string | null;
  tabs: UndoTabSnapshot[];
  createdGroupIds: string[];
  movedIntoExistingGroup: Array<{ tabUniqueId: string; groupId: string }>;
}

const MAX_UNDO_SNAPSHOTS = 5;
const tidyUndoSnapshots = new Map<string, TidyUndoSnapshot>();

function toTitleCase(text: string): string {
  return text
    .split(/[-_\s.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function deriveSiteClusterInfo(rawUrl: string): { key: string; label: string } | null {
  if (!rawUrl) return null;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  if (!host) return null;

  if (/^(\d+\.){3}\d+$/.test(host) || host === "localhost") {
    return {
      key: host,
      label: host === "localhost" || host === "127.0.0.1" ? "Localhost" : host
    };
  }

  if (KNOWN_HOST_LABELS[host]) {
    return { key: host, label: KNOWN_HOST_LABELS[host] };
  }

  const tld = parseTld(host);
  const rootDomain = (tld.domain ?? host).toLowerCase();

  if (KNOWN_SITE_LABELS[rootDomain]) {
    return { key: rootDomain, label: KNOWN_SITE_LABELS[rootDomain] };
  }

  const stem = tld.domainWithoutSuffix || rootDomain.split(".")[0] || rootDomain;
  return {
    key: rootDomain,
    label: toTitleCase(stem) || rootDomain
  };
}

function isBlankNewTab(tab: Tab): boolean {
  const url = tab.url.trim().toLowerCase();
  if (!url || url === "about:blank" || url === "lumi://new-tab" || url === "lumi://new-tab/") {
    return tab.navHistory.length <= 1;
  }
  return false;
}

function canonicalDuplicateKey(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === "about:blank" || trimmed === "lumi://new-tab" || trimmed === "lumi://new-tab/") {
    return null;
  }
  try {
    const u = new URL(trimmed);
    const normalizedPath = u.pathname === "/" ? "" : u.pathname;
    return `${u.protocol}//${u.host.toLowerCase()}${normalizedPath}${u.search}${u.hash}`;
  } catch {
    return trimmed;
  }
}

export function tidySpaceTabs(tabsController: TabsController, windowId: number, spaceId: string): TidyResult {
  const rawTabs = isTabSyncEnabled()
    ? tabsController.getTabsInSpace(spaceId).filter((t) => t.getWindow().id === windowId || !isSyncExcludedTab(t))
    : tabsController.getTabsInWindowSpace(windowId, spaceId);

  const spaceTabs = rawTabs.filter((t) => !t.isDestroyed && !t.ephemeral).sort((a, b) => a.position - b.position);
  if (spaceTabs.length === 0) {
    return {
      undoId: null,
      summary: "Workspace is already tidy",
      groupedCount: 0,
      closedDuplicates: 0,
      closedBlankTabs: 0
    };
  }

  const focusedTab = tabsController.getFocusedTab(windowId, spaceId);
  const snapshotTabs: UndoTabSnapshot[] = spaceTabs.map((tab) => {
    const lifecycle = tabsController.getLifecycleManager(tab.id);
    return {
      uniqueId: tab.uniqueId,
      serialized: serializeTab(tab, `w-${tab.getWindow().id}`, lifecycle?.preSleepState),
      originalGroupId: tab.groupId,
      wasAsleep: tab.asleep
    };
  });

  const looseTabs = spaceTabs.filter((t) => !t.groupId);
  const tabsToClose = new Set<Tab>();
  let closedBlankTabs = 0;
  let closedDuplicates = 0;

  // 1. Clean redundant blank New Tabs when other non-closing tabs remain
  const nonBlankCount = spaceTabs.filter((t) => !isBlankNewTab(t)).length;
  const blankLooseTabs = looseTabs.filter((t) => isBlankNewTab(t));
  let blankKeepCandidateSeen = false;
  for (const blankTab of blankLooseTabs) {
    const isFocused = focusedTab?.id === blankTab.id;
    // Keep any actively focused blank tab, or keep one blank tab if nothing else exists in the space
    if (isFocused || blankTab.visible) continue;
    if (nonBlankCount === 0 && !blankKeepCandidateSeen) {
      blankKeepCandidateSeen = true;
      continue;
    }
    tabsToClose.add(blankTab);
    closedBlankTabs++;
  }

  // 2. Deduplicate identical canonical URLs among remaining loose tabs
  const byUrl = new Map<string, Tab[]>();
  for (const tab of looseTabs) {
    if (tabsToClose.has(tab)) continue;
    const key = canonicalDuplicateKey(tab.url);
    if (!key) continue;
    const bucket = byUrl.get(key) ?? [];
    bucket.push(tab);
    byUrl.set(key, bucket);
  }

  for (const bucket of byUrl.values()) {
    if (bucket.length < 2) continue;
    // Keep the visible/focused or most recently active instance
    bucket.sort((a, b) => {
      if (a.visible !== b.visible) return a.visible ? -1 : 1;
      if ((focusedTab?.id === a.id) !== (focusedTab?.id === b.id)) return focusedTab?.id === a.id ? -1 : 1;
      return b.lastActiveAt - a.lastActiveAt;
    });
    for (let i = 1; i < bucket.length; i++) {
      const dupe = bucket[i]!;
      if (dupe.visible) continue;
      tabsToClose.add(dupe);
      closedDuplicates++;
    }
  }

  // 3. Group remaining loose tabs sharing a site/domain cluster into named folders
  const remainingLoose = looseTabs.filter((t) => !tabsToClose.has(t));
  const existingFolders = [...tabsController.tabGroups.values()].filter(
    (g): g is FolderTabGroup => g.mode === "folder" && g.spaceId === spaceId
  );

  const clusters = new Map<string, { label: string; tabs: Tab[] }>();
  for (const tab of remainingLoose) {
    const info = deriveSiteClusterInfo(tab.url);
    if (!info) continue;
    const existing = clusters.get(info.key);
    if (existing) {
      existing.tabs.push(tab);
    } else {
      clusters.set(info.key, { label: info.label, tabs: [tab] });
    }
  }

  const createdGroupIds: string[] = [];
  const movedIntoExistingGroup: Array<{ tabUniqueId: string; groupId: string }> = [];
  let groupedCount = 0;

  for (const cluster of clusters.values()) {
    // Check if a folder in this space already carries this site name
    const matchingFolder = existingFolders.find((f) => f.name.toLowerCase() === cluster.label.toLowerCase());
    if (matchingFolder) {
      for (const tab of cluster.tabs) {
        if (tabsController.addTabToFolder(matchingFolder.groupId, tab.id)) {
          movedIntoExistingGroup.push({ tabUniqueId: tab.uniqueId, groupId: matchingFolder.groupId });
          groupedCount++;
        }
      }
      continue;
    }

    if (cluster.tabs.length < 2) continue;

    const basePos = cluster.tabs[0]!.position;
    for (let i = 0; i < cluster.tabs.length; i++) {
      cluster.tabs[i]!.updateStateProperty("position", basePos + i * 0.001);
    }

    const groupId = tabsController.createFolder(
      cluster.tabs.map((t) => t.id),
      { name: cluster.label, color: "neutral" }
    );
    if (groupId) {
      createdGroupIds.push(groupId);
      groupedCount += cluster.tabs.length;
    }
  }

  if (closedBlankTabs === 0 && closedDuplicates === 0 && groupedCount === 0) {
    return {
      undoId: null,
      summary: "Workspace is already tidy",
      groupedCount: 0,
      closedDuplicates: 0,
      closedBlankTabs: 0
    };
  }

  // Record undo snapshot before destroying closed tabs
  const undoId = generateID();
  tidyUndoSnapshots.set(undoId, {
    windowId,
    spaceId,
    focusedTabUniqueId: focusedTab?.uniqueId ?? null,
    tabs: snapshotTabs,
    createdGroupIds,
    movedIntoExistingGroup
  });
  if (tidyUndoSnapshots.size > MAX_UNDO_SNAPSHOTS) {
    const oldestKey = tidyUndoSnapshots.keys().next().value;
    if (oldestKey) tidyUndoSnapshots.delete(oldestKey);
  }

  for (const tab of tabsToClose) {
    if (!tab.isDestroyed) {
      tab.destroy();
    }
  }

  tabsController.normalizePositions(windowId, spaceId);
  windowTabsChanged(windowId);

  const parts: string[] = [];
  if (groupedCount > 0) parts.push(`Grouped ${groupedCount} tab${groupedCount === 1 ? "" : "s"}`);
  if (closedDuplicates > 0) parts.push(`closed ${closedDuplicates} duplicate${closedDuplicates === 1 ? "" : "s"}`);
  if (closedBlankTabs > 0) parts.push(`cleaned ${closedBlankTabs} blank tab${closedBlankTabs === 1 ? "" : "s"}`);

  const rawSummary = parts.join(" · ");
  const summary = rawSummary.charAt(0).toUpperCase() + rawSummary.slice(1);

  return {
    undoId,
    summary,
    groupedCount,
    closedDuplicates,
    closedBlankTabs
  };
}

export async function undoTidyTabs(tabsController: TabsController, undoId: string): Promise<boolean> {
  const snapshot = tidyUndoSnapshots.get(undoId);
  if (!snapshot) return false;
  tidyUndoSnapshots.delete(undoId);

  const targetWindow =
    browserWindowsController.getWindowById(snapshot.windowId) ??
    browserWindowsController.getFocusedWindow() ??
    browserWindowsController.getWindows()[0];
  if (!targetWindow) return false;

  // 1. Disband newly created tidy folders cleanly (keeping tabs)
  for (const groupId of snapshot.createdGroupIds) {
    const group = tabsController.getTabGroupById(groupId);
    if (group && group.mode === "folder") {
      tabsController.ungroupTabGroup(groupId);
    }
  }

  // Build map of currently live tabs by uniqueId
  const liveByUniqueId = new Map<string, Tab>();
  for (const tab of tabsController.tabs.values()) {
    if (!tab.isDestroyed) {
      liveByUniqueId.set(tab.uniqueId, tab);
    }
  }

  // 2. Remove tabs that tidy moved into pre-existing folders
  for (const entry of snapshot.movedIntoExistingGroup) {
    const tab = liveByUniqueId.get(entry.tabUniqueId);
    const group = tabsController.getTabGroupById(entry.groupId);
    if (tab && group && group.hasTab(tab.id)) {
      group.removeTab(tab.id);
    }
  }

  // 3. Recreate any closed tabs & restore positions
  for (const item of snapshot.tabs) {
    let tab = liveByUniqueId.get(item.uniqueId);
    if (!tab) {
      try {
        tab = await tabsController.createTab(
          targetWindow.id,
          item.serialized.profileId,
          item.serialized.spaceId,
          undefined,
          {
            uniqueId: item.serialized.uniqueId,
            asleep: item.wasAsleep,
            createdAt: item.serialized.createdAt,
            lastActiveAt: item.serialized.lastActiveAt,
            position: item.serialized.position,
            url: item.serialized.url,
            title: item.serialized.title,
            faviconURL: item.serialized.faviconURL ?? undefined,
            navHistory: item.serialized.navHistory,
            navHistoryIndex: item.serialized.navHistoryIndex
          }
        );
        liveByUniqueId.set(tab.uniqueId, tab);
      } catch (err) {
        console.error("[Tidy] Failed to recreate tab on undo:", err);
      }
    }

    if (tab && !tab.isDestroyed) {
      tab.updateStateProperty("position", item.serialized.position);
      if (item.originalGroupId) {
        const originalGroup = tabsController.getTabGroupById(item.originalGroupId);
        if (originalGroup && !originalGroup.hasTab(tab.id)) {
          originalGroup.addTab(tab.id);
          if (originalGroup instanceof FolderTabGroup) {
            originalGroup.syncTabOrderFromPositions();
          }
        }
      }
    }
  }

  tabsController.normalizePositions(targetWindow.id, snapshot.spaceId);

  if (snapshot.focusedTabUniqueId) {
    const focused = liveByUniqueId.get(snapshot.focusedTabUniqueId);
    if (focused && !focused.isDestroyed) {
      tabsController.activateTab(focused);
    }
  }

  windowTabsChanged(targetWindow.id);
  return true;
}
