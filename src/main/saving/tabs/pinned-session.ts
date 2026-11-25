import { getDatastore } from "@/saving/datastore";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import type { BrowserWindow } from "@/controllers/windows-controller/types/browser";
import { pinnedTabsController } from "@/controllers/pinned-tabs-controller";
import { spacesController } from "@/controllers/spaces-controller";
import { profilesController } from "@/controllers/profiles-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { Tab } from "@/controllers/tabs-controller/tab";
import { setWindowSpace } from "@/ipc/session/spaces";
import { getCurrentTimestamp } from "@/modules/utils";

const PinnedSessionDataStore = getDatastore("pinned-tab-session");
const SESSION_KEY = "state";

export interface WindowBoundsSnapshot {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface ActivePinnedTabSnapshotEntry {
  windowGroupId: string;
  windowIndex: number;
  spaceId: string;
  pinnedTabId: string;
  url: string;
  title?: string;
  faviconURL?: string;
  lastActiveAt: number;
  isWindowActiveSpace: boolean;
  /** Persistent regular tab uniqueIds from the same window to accurately remap across sessions */
  anchorTabUniqueIds: string[];
  windowBounds?: WindowBoundsSnapshot;
}

interface PinnedTabSessionState {
  quitEntries: ActivePinnedTabSnapshotEntry[];
  lastClosedEntries: ActivePinnedTabSnapshotEntry[];
  lastWindowBounds?: WindowBoundsSnapshot;
}

let inMemoryState: PinnedTabSessionState | null = null;
let persistQueue: Promise<void> = Promise.resolve();
let hasConsumedStartupSession = false;

const pendingWindowInitGates = new Map<number, Promise<void>>();
let pendingActivateRestore: Promise<void> | null = null;

function enqueuePersist(nextState: PinnedTabSessionState): Promise<void> {
  inMemoryState = nextState;
  const run = persistQueue.then(async () => {
    await PinnedSessionDataStore.set(SESSION_KEY, nextState);
  });
  persistQueue = run.catch((error) => {
    console.error("[PinnedSession] Failed to persist pinned tab session:", error);
  });
  return run;
}

async function loadSessionState(): Promise<PinnedTabSessionState> {
  await persistQueue;
  if (inMemoryState) {
    return inMemoryState;
  }

  const stored = await PinnedSessionDataStore.get<PinnedTabSessionState>(SESSION_KEY);
  if (stored && typeof stored === "object") {
    const normalized: PinnedTabSessionState = {
      quitEntries: Array.isArray(stored.quitEntries) ? stored.quitEntries : [],
      lastClosedEntries: Array.isArray(stored.lastClosedEntries) ? stored.lastClosedEntries : [],
      lastWindowBounds: stored.lastWindowBounds
    };
    inMemoryState = normalized;
    return normalized;
  }

  const empty: PinnedTabSessionState = { quitEntries: [], lastClosedEntries: [] };
  inMemoryState = empty;
  return empty;
}

function getNormalizedUrl(rawUrl: string | undefined, fallbackUrl: string): string {
  const trimmed = rawUrl?.trim();
  if (!trimmed || trimmed === "about:blank") {
    return fallbackUrl;
  }
  return trimmed;
}

function extractWindowBounds(win: BrowserWindow): WindowBoundsSnapshot | undefined {
  if (win.destroyed || win.browserWindow.isDestroyed()) {
    return win.lastKnownBounds;
  }
  const bounds = win.browserWindow.getBounds();
  return {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y
  };
}

function captureActivePinnedEntriesForWindow(
  win: BrowserWindow,
  windowIndex: number,
  now: number,
  windowBounds?: WindowBoundsSnapshot
): ActivePinnedTabSnapshotEntry[] {
  if (win.destroyed || win.browserWindowType !== "normal") {
    return [];
  }

  const persistedTabsInWindow = tabsController
    .getTabsInWindow(win.id)
    .filter(
      (t) =>
        !t.isDestroyed &&
        !t.ephemeral &&
        !t.loadedProfile.profileData.ephemeral &&
        !t.loadedProfile.profileData.internal
    );
  const anchorTabUniqueIds = persistedTabsInWindow.slice(0, 8).map((t) => t.uniqueId);

  const activeEntries = tabsController.getActiveTabEntriesForWindow(win.id);
  const result: ActivePinnedTabSnapshotEntry[] = [];

  for (const { spaceId, activeItem } of activeEntries) {
    if (!(activeItem instanceof Tab) || activeItem.isDestroyed) continue;
    if (activeItem.loadedProfile.profileData.ephemeral || activeItem.loadedProfile.profileData.internal) continue;

    const pinInfo = pinnedTabsController.getPinnedIdByTabId(activeItem.id);
    if (!pinInfo || pinInfo.spaceId !== spaceId) continue;

    const pinnedTab = pinnedTabsController.getById(pinInfo.pinnedTabId);
    if (!pinnedTab) continue;

    if (!activeItem.asleep && activeItem.webContents && !activeItem.webContents.isDestroyed()) {
      activeItem.updateTabState();
    }

    const preSleepUrl = tabsController.getTabManagers(activeItem.id)?.lifecycle.preSleepState?.url;
    const url = getNormalizedUrl(preSleepUrl ?? activeItem.url, pinnedTab.defaultUrl);
    const isWindowActiveSpace = win.currentSpaceId === spaceId;

    result.push({
      windowGroupId: `w-${win.id}`,
      windowIndex,
      spaceId,
      pinnedTabId: pinInfo.pinnedTabId,
      url,
      title: activeItem.title || undefined,
      faviconURL: activeItem.faviconURL ?? pinnedTab.faviconUrl ?? undefined,
      lastActiveAt: activeItem.visible || isWindowActiveSpace ? now : activeItem.lastActiveAt,
      isWindowActiveSpace,
      anchorTabUniqueIds,
      windowBounds
    });
  }

  return result;
}

/**
 * Snapshot active pinned tabs across all open normal windows right before app quit / restart.
 * When all windows already closed before quit (e.g. closing final window via X before
 * window-all-closed / Dock quit), leaves the last-closed window snapshot intact and awaits disk flush.
 */
export async function snapshotPinnedTabsForQuit(): Promise<void> {
  const now = getCurrentTimestamp();
  const liveNormalWindows = browserWindowsController
    .getWindows()
    .filter((win) => !win.destroyed && !win.browserWindow.isDestroyed() && win.browserWindowType === "normal");

  if (liveNormalWindows.length === 0) {
    await persistQueue;
    return;
  }

  const quitEntries: ActivePinnedTabSnapshotEntry[] = [];
  let primaryWindowBounds: WindowBoundsSnapshot | undefined;

  for (let i = 0; i < liveNormalWindows.length; i++) {
    const win = liveNormalWindows[i];
    const windowBounds = extractWindowBounds(win);
    if (i === 0) {
      primaryWindowBounds = windowBounds;
    }
    quitEntries.push(...captureActivePinnedEntriesForWindow(win, i, now, windowBounds));
  }

  await enqueuePersist({
    quitEntries,
    lastClosedEntries: [],
    lastWindowBounds: primaryWindowBounds
  });
}

/**
 * Capture active pinned tab state synchronously right before the final normal BrowserWindow
 * is destroyed (while its `spaceActiveTabMap` entries are still intact).
 * If the closing window was on a regular tab, `entries` is empty so stale pinned state is cleared.
 */
export function recordLastNormalWindowClosedPinnedSession(win: BrowserWindow): void {
  if (win.destroyed || win.browserWindowType !== "normal") {
    return;
  }

  const windowBounds = extractWindowBounds(win);
  const entries = captureActivePinnedEntriesForWindow(win, 0, getCurrentTimestamp(), windowBounds);
  void enqueuePersist({
    quitEntries: [],
    lastClosedEntries: entries,
    lastWindowBounds: windowBounds
  });
}

/**
 * Ensure any queued pinned-session writes finish before app exit.
 */
export async function flushPinnedTabSessionSaves(): Promise<void> {
  await persistQueue;
}

/**
 * Gate renderer `tabs:get-data` IPC calls for a window until asynchronous pinned-tab
 * restoration finishes (preventing AutoNewTab from opening a spurious Start Page).
 */
export function runWithWindowInitGate(windowId: number, work: () => Promise<void>): Promise<void> {
  const gate = work().finally(() => {
    if (pendingWindowInitGates.get(windowId) === gate) {
      pendingWindowInitGates.delete(windowId);
    }
  });
  pendingWindowInitGates.set(windowId, gate);
  return gate;
}

export async function waitForWindowInit(windowId: number): Promise<void> {
  const gate = pendingWindowInitGates.get(windowId);
  if (gate) {
    await gate;
  }
}

async function isValidPinnedEntry(entry: ActivePinnedTabSnapshotEntry): Promise<boolean> {
  const pinnedTab = pinnedTabsController.getById(entry.pinnedTabId);
  if (!pinnedTab) return false;

  const space = await spacesController.get(entry.spaceId);
  if (!space || space.profileId !== pinnedTab.profileId) return false;

  const profile = await profilesController.get(pinnedTab.profileId);
  if (!profile || profile.ephemeral || profile.internal) return false;

  return true;
}

async function hasValidPinnedEntry(entries: ActivePinnedTabSnapshotEntry[]): Promise<boolean> {
  for (const entry of entries) {
    if (await isValidPinnedEntry(entry)) {
      return true;
    }
  }
  return false;
}

async function restorePinnedSessionEntriesInWindow(
  window: BrowserWindow,
  windowEntries: ActivePinnedTabSnapshotEntry[]
): Promise<Set<string>> {
  const restoredWindowSpaces = new Set<string>();
  if (window.destroyed || window.browserWindow.isDestroyed()) {
    return restoredWindowSpaces;
  }

  // Restore inactive spaces before the active space so the window's active space settles last.
  const orderedEntries = [...windowEntries].sort(
    (a, b) => Number(a.isWindowActiveSpace) - Number(b.isWindowActiveSpace)
  );

  const activeSpaceEntry = orderedEntries.find((entry) => entry.isWindowActiveSpace);
  if (activeSpaceEntry && !window.currentSpaceId && (await isValidPinnedEntry(activeSpaceEntry))) {
    setWindowSpace(window, activeSpaceEntry.spaceId);
  }

  for (const entry of orderedEntries) {
    try {
      if (!(await isValidPinnedEntry(entry))) continue;

      const pinnedTab = pinnedTabsController.getById(entry.pinnedTabId);
      if (!pinnedTab) continue;

      const existingId = pinnedTabsController.getAssociatedTabId(pinnedTab.uniqueId, entry.spaceId);
      if (existingId !== null) {
        const existingTab = tabsController.getTabById(existingId);
        if (existingTab && !existingTab.isDestroyed && existingTab.getWindow().id === window.id) {
          tabsController.restoreActiveTab(existingTab);
          restoredWindowSpaces.add(`${window.id}-${entry.spaceId}`);
          continue;
        }
        pinnedTabsController.dissociateTab(pinnedTab.uniqueId, entry.spaceId);
      }

      const targetUrl = getNormalizedUrl(entry.url, pinnedTab.defaultUrl);
      const restoredTab = await tabsController.createTab(window.id, pinnedTab.profileId, entry.spaceId, undefined, {
        url: targetUrl,
        title: entry.title,
        faviconURL: entry.faviconURL ?? pinnedTab.faviconUrl ?? undefined,
        ephemeral: true,
        asleep: true,
        lastActiveAt: entry.lastActiveAt
      });

      pinnedTabsController.associateTab(pinnedTab.uniqueId, entry.spaceId, restoredTab.id);

      if (entry.isWindowActiveSpace && window.currentSpaceId !== entry.spaceId) {
        setWindowSpace(window, entry.spaceId);
      }

      tabsController.restoreActiveTab(restoredTab);
      restoredWindowSpaces.add(`${window.id}-${entry.spaceId}`);
    } catch (error) {
      console.error("[PinnedSession] Failed to restore pinned tab entry:", entry.pinnedTabId, error);
    }
  }

  return restoredWindowSpaces;
}

/**
 * Restore active pinned tabs for a session that also has persisted regular tabs.
 * Returns the set of `${windowId}-${spaceId}` keys where a pinned tab took over active status
 * so regular-tab restore skips activating a regular tab for those window/spaces.
 */
export async function restorePinnedTabsForPersistedWindows(createdTabs: Tab[]): Promise<Set<string>> {
  const restoredWindowSpaces = new Set<string>();
  const state = await loadSessionState();
  hasConsumedStartupSession = true;

  const entries = state.quitEntries.length > 0 ? state.quitEntries : state.lastClosedEntries;
  if (entries.length === 0) {
    if (state.quitEntries.length > 0 || state.lastClosedEntries.length > 0 || state.lastWindowBounds) {
      await enqueuePersist({ quitEntries: [], lastClosedEntries: [] });
    }
    return restoredWindowSpaces;
  }

  await enqueuePersist({ quitEntries: [], lastClosedEntries: [] });

  const windowByTabUniqueId = new Map<string, BrowserWindow>();
  for (const tab of createdTabs) {
    if (!tab.isDestroyed) {
      windowByTabUniqueId.set(tab.uniqueId, tab.getWindow());
    }
  }

  const entriesByWindowGroup = new Map<string, ActivePinnedTabSnapshotEntry[]>();
  for (const entry of entries) {
    const list = entriesByWindowGroup.get(entry.windowGroupId);
    if (list) {
      list.push(entry);
    } else {
      entriesByWindowGroup.set(entry.windowGroupId, [entry]);
    }
  }

  for (const windowEntries of entriesByWindowGroup.values()) {
    let targetWindow: BrowserWindow | null = null;
    for (const entry of windowEntries) {
      for (const uniqueId of entry.anchorTabUniqueIds) {
        const matched = windowByTabUniqueId.get(uniqueId);
        if (matched && !matched.destroyed && !matched.browserWindow.isDestroyed()) {
          targetWindow = matched;
          break;
        }
      }
      if (targetWindow) break;
    }

    if (!targetWindow) {
      if (!(await hasValidPinnedEntry(windowEntries))) continue;
      targetWindow = await browserWindowsController.create("normal", windowEntries[0]?.windowBounds);
    }

    const restored = await restorePinnedSessionEntriesInWindow(targetWindow, windowEntries);
    for (const key of restored) {
      restoredWindowSpaces.add(key);
    }
  }

  return restoredWindowSpaces;
}

/**
 * Restore active pinned tabs when cold startup had zero persisted regular tabs
 * (so `createTabsFromPersistedData` did not run).
 */
export async function restoreUnconsumedPinnedTabSession(): Promise<void> {
  if (hasConsumedStartupSession) {
    return;
  }
  hasConsumedStartupSession = true;

  const state = await loadSessionState();
  const entries = state.quitEntries.length > 0 ? state.quitEntries : state.lastClosedEntries;
  const savedBounds = state.lastWindowBounds;

  if (entries.length === 0) {
    if (savedBounds) {
      await enqueuePersist({ quitEntries: [], lastClosedEntries: [] });
    }
    return;
  }

  await enqueuePersist({ quitEntries: [], lastClosedEntries: [] });

  const entriesByWindowGroup = new Map<string, ActivePinnedTabSnapshotEntry[]>();
  for (const entry of entries) {
    const list = entriesByWindowGroup.get(entry.windowGroupId);
    if (list) {
      list.push(entry);
    } else {
      entriesByWindowGroup.set(entry.windowGroupId, [entry]);
    }
  }

  const existingNormalWindows = browserWindowsController
    .getWindows()
    .filter((win) => !win.destroyed && !win.browserWindow.isDestroyed() && win.browserWindowType === "normal");

  let windowSlot = 0;
  for (const windowEntries of entriesByWindowGroup.values()) {
    if (!(await hasValidPinnedEntry(windowEntries))) continue;

    let targetWindow = existingNormalWindows[windowSlot] ?? null;
    const bounds = windowEntries[0]?.windowBounds ?? savedBounds;

    if (!targetWindow) {
      targetWindow = await browserWindowsController.create("normal", bounds);
    } else if (bounds && !targetWindow.browserWindow.isDestroyed()) {
      targetWindow.browserWindow.setBounds({
        width: bounds.width,
        height: bounds.height,
        ...(bounds.x !== undefined && bounds.y !== undefined ? { x: bounds.x, y: bounds.y } : {})
      });
    }
    windowSlot++;

    await restorePinnedSessionEntriesInWindow(targetWindow, windowEntries);
  }
}

/**
 * On macOS `activate` (e.g. clicking Dock after closing all windows with Red-X),
 * reopen a browser window onto the last active pinned tab if the closing window
 * had a pinned tab active.
 */
export async function openBrowserWindowOnActivate(): Promise<void> {
  if (pendingActivateRestore) {
    return pendingActivateRestore;
  }

  pendingActivateRestore = (async () => {
    const state = await loadSessionState();
    const entries = state.lastClosedEntries.length > 0 ? state.lastClosedEntries : state.quitEntries;
    const valid = entries.length > 0 && (await hasValidPinnedEntry(entries));

    if (!valid) {
      if (state.quitEntries.length > 0 || state.lastClosedEntries.length > 0 || state.lastWindowBounds) {
        await enqueuePersist({ quitEntries: [], lastClosedEntries: [] });
      }
      await browserWindowsController.create();
      return;
    }

    const bounds = entries[0]?.windowBounds ?? state.lastWindowBounds;
    await enqueuePersist({ quitEntries: [], lastClosedEntries: [] });

    const window = await browserWindowsController.create("normal", bounds);
    await runWithWindowInitGate(window.id, async () => {
      await restorePinnedSessionEntriesInWindow(window, entries);
    });
  })().finally(() => {
    pendingActivateRestore = null;
  });

  return pendingActivateRestore;
}
