import { tabsController } from "@/controllers/tabs-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { ipcMain, systemPreferences, type WebContents } from "electron";

export type GestureNavigationDirection = "back" | "forward";

const GESTURE_NAVIGATION_COOLDOWN_MS = 650;
const lastGestureNavigationAt = new WeakMap<WebContents, number>();

export function isTrackpadSwipeNavigationEnabled(): boolean {
  if (process.platform === "darwin") {
    return systemPreferences.isSwipeTrackingFromScrollEventsEnabled();
  }
  return true;
}

function isGestureNavigationCoolingDown(webContents: WebContents): boolean {
  return Date.now() - (lastGestureNavigationAt.get(webContents) ?? 0) < GESTURE_NAVIGATION_COOLDOWN_MS;
}

function isNavigableContentWebContents(webContents: WebContents): boolean {
  if (!webContents || webContents.isDestroyed()) return false;
  if (webContents.getURL().startsWith("lumi-internal:")) return false;

  const window = browserWindowsController.getWindowFromWebContents(webContents);
  if (!window || window.coreWebContents.includes(webContents)) return false;

  return true;
}

/**
 * Performs back/forward history navigation on a content WebContents with a
 * short cooldown so simultaneous 2-finger and 3-finger events cannot double-fire.
 */
export function performGestureNavigation(
  webContents: WebContents | null | undefined,
  direction: GestureNavigationDirection
): boolean {
  if (!webContents || webContents.isDestroyed()) return false;
  if (isGestureNavigationCoolingDown(webContents)) return false;

  const history = webContents.navigationHistory;
  if (direction === "back" && history.canGoBack()) {
    lastGestureNavigationAt.set(webContents, Date.now());
    history.goBack();
    return true;
  }
  if (direction === "forward" && history.canGoForward()) {
    lastGestureNavigationAt.set(webContents, Date.now());
    history.goForward();
    return true;
  }

  return false;
}

ipcMain.handle("navigation:get-gesture-state", (event) => {
  const sender = event.sender;
  if (
    !isNavigableContentWebContents(sender) ||
    !isTrackpadSwipeNavigationEnabled() ||
    isGestureNavigationCoolingDown(sender)
  ) {
    return {
      enabled: false,
      canGoBack: false,
      canGoForward: false
    };
  }

  return {
    enabled: true,
    canGoBack: sender.navigationHistory.canGoBack(),
    canGoForward: sender.navigationHistory.canGoForward()
  };
});

ipcMain.on("navigation:gesture-navigate", (event, direction: unknown) => {
  if (direction !== "back" && direction !== "forward") return;
  const sender = event.sender;
  if (!isNavigableContentWebContents(sender) || !isTrackpadSwipeNavigationEnabled()) return;

  performGestureNavigation(sender, direction);
});

ipcMain.on("navigation:go-to", (event, url: string, tabId?: number, typedFromAddressBar?: boolean) => {
  const webContents = event.sender;
  const window = browserWindowsController.getWindowFromWebContents(webContents);
  if (!window) return false;

  const currentSpace = window.currentSpaceId;
  if (!currentSpace) return false;

  const tab = tabId ? tabsController.getTabById(tabId) : tabsController.getFocusedTab(window.id, currentSpace);
  if (!tab) return false;

  if (typedFromAddressBar === true) {
    tab.markTypedNavigationForNextHistoryVisit(url);
  }
  tab.loadURL(url);
  return true;
});

ipcMain.on("navigation:stop-loading-tab", (_event, tabId: number) => {
  const tab = tabsController.getTabById(tabId);
  if (!tab) return;

  tab.webContents?.stop();
});

ipcMain.on("navigation:reload-tab", (_event, tabId: number) => {
  const tab = tabsController.getTabById(tabId);
  if (!tab) return;

  tab.webContents?.reload();
});

ipcMain.handle("navigation:get-tab-status", async (_event, tabId: number) => {
  const tab = tabsController.getTabById(tabId);
  if (!tab) return null;

  const tabWebContents = tab.webContents;
  const navigationHistory = tabWebContents?.navigationHistory;
  if (!navigationHistory) return null;

  return {
    navigationHistory: navigationHistory.getAllEntries(),
    activeIndex: navigationHistory.getActiveIndex(),
    canGoBack: navigationHistory.canGoBack(),
    canGoForward: navigationHistory.canGoForward()
  };
});

ipcMain.on("navigation:go-to-entry", (_event, tabId: number, index: number) => {
  const tab = tabsController.getTabById(tabId);
  if (!tab) return;

  return tab.webContents?.navigationHistory?.goToIndex(index);
});
