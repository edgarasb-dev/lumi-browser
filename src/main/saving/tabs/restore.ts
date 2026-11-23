import { PersistedTabData, PersistedTabGroupData } from "~/types/tabs";
import { tabPersistenceManager } from "@/saving/tabs";
import { consumePreserveSessionForRestart } from "@/saving/ephemeral";
import { onSettingsCached } from "@/saving/settings";
import { tabsController } from "@/controllers/tabs-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { shouldArchiveTab } from "@/saving/tabs";
import { app } from "electron";
import { GlanceTabGroup } from "@/controllers/tabs-controller/tab-groups/glance";
import { SplitTabGroup } from "@/controllers/tabs-controller/tab-groups/split";
import { FolderTabGroup } from "@/controllers/tabs-controller/tab-groups/folder";
import type { Tab } from "@/controllers/tabs-controller/tab";
import type { BrowserWindowCreationOptions, BrowserWindowType } from "@/controllers/windows-controller/types/browser";

/**
 * Loads tabs and tab groups from storage, filters archived ones,
 * and restores them into browser windows.
 */
export async function restoreSession(): Promise<boolean> {
  await app.whenReady();
  await onSettingsCached();

  const tabs = await loadAndFilterTabs();
  if (tabs.length > 0) {
    await createTabsFromPersistedData(tabs);
  } else {
    await browserWindowsController.create();
  }

  return true;
}

/**
 * Loads tabs from storage and filters out archived ones.
 * On an update restart (`preserveSession`), skips auto-archiving completely so
 * every open tab from the pre-update session reopens reliably.
 */
async function loadAndFilterTabs(): Promise<PersistedTabData[]> {
  const [allTabs, preserveAllTabs] = await Promise.all([
    tabPersistenceManager.loadAllTabs(),
    consumePreserveSessionForRestart().catch(() => false)
  ]);

  if (preserveAllTabs) {
    return allTabs;
  }

  // Never archive the most recently active tab in each (windowGroupId, spaceId)
  // at cold startup even if its lastActiveAt crossed archiveTabAfter during a long session.
  const newestByWindowSpace = new Map<string, string>();
  const maxActiveByWindowSpace = new Map<string, number>();
  for (const tabData of allTabs) {
    const key = `${tabData.windowGroupId}::${tabData.spaceId}`;
    const prevMax = maxActiveByWindowSpace.get(key) ?? -Infinity;
    if (tabData.lastActiveAt >= prevMax) {
      maxActiveByWindowSpace.set(key, tabData.lastActiveAt);
      newestByWindowSpace.set(key, tabData.uniqueId);
    }
  }

  const protectedUniqueIds = new Set(newestByWindowSpace.values());
  const filtered: PersistedTabData[] = [];
  const archivedUniqueIds: string[] = [];
  for (const tabData of allTabs) {
    if (
      !protectedUniqueIds.has(tabData.uniqueId) &&
      typeof tabData.lastActiveAt === "number" &&
      shouldArchiveTab(tabData.lastActiveAt)
    ) {
      archivedUniqueIds.push(tabData.uniqueId);
      continue;
    }
    filtered.push(tabData);
  }

  if (archivedUniqueIds.length > 0) {
    await tabPersistenceManager.removeTabsBatch(archivedUniqueIds);
  }

  return filtered;
}

/**
 * Creates browser windows and tabs from persisted data.
 * Groups tabs by windowGroupId to recreate window layout.
 * Also restores tab groups.
 */
async function createTabsFromPersistedData(tabDatas: PersistedTabData[]): Promise<void> {
  // Group tabs by windowGroupId
  const windowGroups = new Map<string, PersistedTabData[]>();
  for (const tabData of tabDatas) {
    const groupId = tabData.windowGroupId;
    if (!windowGroups.has(groupId)) {
      windowGroups.set(groupId, []);
    }
    windowGroups.get(groupId)!.push(tabData);
  }

  // Load persisted tab groups and window states
  const persistedGroups = await tabPersistenceManager.loadAllTabGroups();
  const windowStates = await tabPersistenceManager.loadAllWindowStates();
  const uniqueIdToTabId = new Map<string, number>();
  const createdTabs: Tab[] = [];

  // Create windows concurrently so multi-window restores don't serialize window startup
  await Promise.all(
    Array.from(windowGroups.values()).map(async (tabs) => {
      // All tabs in the same group share the same persisted window state
      const windowGroupId = tabs[0]?.windowGroupId;
      const windowState = windowGroupId ? windowStates.get(windowGroupId) : undefined;

      const windowType: BrowserWindowType = windowState?.isPopup ? "popup" : "normal";
      const windowOptions: BrowserWindowCreationOptions = {};
      if (windowState) {
        windowOptions.width = windowState.width;
        windowOptions.height = windowState.height;
        if (windowState.x !== undefined) windowOptions.x = windowState.x;
        if (windowState.y !== undefined) windowOptions.y = windowState.y;
      }
      const window = await browserWindowsController.create(windowType, windowOptions);

      for (const tabData of tabs) {
        try {
          const tab = await tabsController.createTab(window.id, tabData.profileId, tabData.spaceId, undefined, {
            asleep: true,
            createdAt: tabData.createdAt,
            lastActiveAt: tabData.lastActiveAt,
            position: tabData.position,
            url: tabData.url,
            navHistory: tabData.navHistory,
            navHistoryIndex: tabData.navHistoryIndex,
            uniqueId: tabData.uniqueId,
            title: tabData.title,
            faviconURL: tabData.faviconURL || undefined
          });

          uniqueIdToTabId.set(tabData.uniqueId, tab.id);
          createdTabs.push(tab);
        } catch (err) {
          console.error(`[RestoreSession] Failed to restore tab ${tabData.uniqueId} (${tabData.url}):`, err);
        }
      }
    })
  );

  await restoreTabGroups(persistedGroups, uniqueIdToTabId);

  // Mark the most recently active restored tab (preferring regular tabs over ephemeral ones)
  // active in each window/space so restored windows wake their visible tab instead of staying blank.
  const bestTabByWindowSpace = new Map<string, Tab>();
  for (const tab of createdTabs) {
    if (tab.isDestroyed) continue;
    const key = `${tab.getWindow().id}-${tab.spaceId}`;
    const currentBest = bestTabByWindowSpace.get(key);
    if (!currentBest || isPreferredRestoredTab(tab, currentBest)) {
      bestTabByWindowSpace.set(key, tab);
    }
  }

  for (const tab of bestTabByWindowSpace.values()) {
    tabsController.restoreActiveTab(tab);
  }
}

function isPreferredRestoredTab(candidate: Tab, current: Tab): boolean {
  if (candidate.ephemeral !== current.ephemeral) {
    return !candidate.ephemeral;
  }
  if (candidate.lastActiveAt !== current.lastActiveAt) {
    return candidate.lastActiveAt > current.lastActiveAt;
  }
  return candidate.position < current.position;
}

/**
 * Restores tab groups from persisted data using the uniqueId -> tabId mapping.
 */
async function restoreTabGroups(
  persistedGroups: PersistedTabGroupData[],
  uniqueIdToTabId: Map<string, number>
): Promise<void> {
  for (const groupData of persistedGroups) {
    // Resolve uniqueIds to runtime tab IDs
    const tabIds: number[] = [];
    for (const uniqueId of groupData.tabUniqueIds) {
      const tabId = uniqueIdToTabId.get(uniqueId);
      if (tabId !== undefined) {
        tabIds.push(tabId);
      }
    }

    const minTabs = groupData.mode === "folder" ? 1 : 2;
    if (tabIds.length < minTabs) {
      // Split/Glance groups need at least 2 tabs; Folders need at least 1 tab
      try {
        await tabPersistenceManager.removeTabGroup(groupData.groupId);
      } catch (error) {
        console.error("Failed to remove stale tab group:", error);
      }
      continue;
    }

    try {
      const group = tabsController.createTabGroup(groupData.mode, tabIds as [number, ...number[]], groupData.groupId);

      // Restore glance front tab
      if (groupData.mode === "glance" && groupData.glanceFrontTabUniqueId) {
        const frontTabId = uniqueIdToTabId.get(groupData.glanceFrontTabUniqueId);
        if (frontTabId !== undefined && group instanceof GlanceTabGroup) {
          group.setFrontTab(frontTabId);
        }
      }

      // Restore split view geometry
      if (groupData.mode === "split" && group instanceof SplitTabGroup) {
        if (groupData.splitDirection) {
          group.setSplitDirection(groupData.splitDirection);
        }
        if (typeof groupData.splitRatio === "number") {
          group.setSplitRatio(groupData.splitRatio);
        }
      }

      // Restore folder metadata
      if (groupData.mode === "folder" && group instanceof FolderTabGroup) {
        if (groupData.name) {
          group.rename(groupData.name);
        }
        if (groupData.color) {
          group.setColor(groupData.color);
        }
        if (groupData.collapsed !== undefined) {
          group.setCollapsed(groupData.collapsed);
        }
      }
    } catch (error) {
      console.error("Failed to restore tab group:", error);
    }
  }
}
