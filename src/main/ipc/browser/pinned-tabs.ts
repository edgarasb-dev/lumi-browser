import { pinnedTabsController } from "@/controllers/pinned-tabs-controller";
import {
  handlePinnedTabClick,
  pinTabToSpace,
  unpinPinnedTabToList
} from "@/controllers/pinned-tabs-controller/actions";
import { tabsController } from "@/controllers/tabs-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { clipboard, ipcMain, Menu, MenuItem } from "electron";

// --- Change notification ---

let changeTimeout: NodeJS.Timeout | null = null;

function schedulePinnedTabsChange() {
  if (changeTimeout) clearTimeout(changeTimeout);
  changeTimeout = setTimeout(() => {
    changeTimeout = null;
    const allByProfile = pinnedTabsController.getAllByProfile();
    for (const window of browserWindowsController.getWindows()) {
      window.sendMessageToCoreWebContents("pinned-tabs:on-changed", allByProfile);
    }
  }, 80);
}

// Listen for changes from the controller
pinnedTabsController.on("changed", () => {
  schedulePinnedTabsChange();
});

// --- Wire tab destruction ---
// When a browser tab is destroyed, clear any pinned tab association pointing to it.
tabsController.on("tab-removed", (tab) => {
  pinnedTabsController.onBrowserTabDestroyed(tab.id);
});

// NOTE: Pinned tabs are per-profile, but their associated ephemeral tabs live
// in a specific space. We intentionally do NOT move them when switching spaces
// so that each space maintains its own independent active-tab state. The
// associated tab is moved to the current space only when the user explicitly
// clicks the pinned tab (see handlePinnedTabClick).

// --- IPC Handlers ---

/**
 * Get all pinned tabs grouped by profile ID.
 */
ipcMain.handle("pinned-tabs:get-data", async () => {
  return pinnedTabsController.getAllByProfile();
});

/**
 * Create a pinned tab from an existing browser tab.
 * The tab's current URL becomes the pinned tab's defaultUrl.
 */
ipcMain.handle("pinned-tabs:create-from-tab", async (_event, tabId: number, position?: number) => {
  return pinTabToSpace(tabId, position);
});

ipcMain.handle("pinned-tabs:click", async (event, pinnedTabId: string) => {
  const window = browserWindowsController.getWindowFromWebContents(event.sender);
  if (!window) return false;
  return handlePinnedTabClick(window, pinnedTabId, false);
});

ipcMain.handle("pinned-tabs:double-click", async (event, pinnedTabId: string) => {
  const window = browserWindowsController.getWindowFromWebContents(event.sender);
  if (!window) return false;
  return handlePinnedTabClick(window, pinnedTabId, true);
});

/**
 * Remove a pinned tab.
 * Also destroys all associated ephemeral tabs (if any) so they don't leak.
 */
ipcMain.handle("pinned-tabs:remove", async (_event, pinnedTabId: string) => {
  const removedTabIds = pinnedTabsController.remove(pinnedTabId);
  for (const tabId of removedTabIds) {
    const tab = tabsController.getTabById(tabId);
    if (tab && !tab.isDestroyed) {
      tab.destroy();
    }
  }
  return true;
});

/**
 * Unpin a tab back to the tab list in the current space.
 * Removes the association for the current space and makes that tab persistent
 * so it reappears in the sidebar at the given position.
 * If there is no associated tab in the current space, creates a new persistent tab.
 */
ipcMain.handle("pinned-tabs:unpin-to-tab-list", async (event, pinnedTabId: string, position?: number) => {
  const webContents = event.sender;
  const window = browserWindowsController.getWindowFromWebContents(webContents);
  if (!window) return false;

  const currentSpaceId = window.currentSpaceId;
  if (!currentSpaceId) return false;

  return unpinPinnedTabToList(pinnedTabId, window, currentSpaceId, position);
});

/**
 * Reorder a pinned tab to a new position.
 */
ipcMain.handle("pinned-tabs:reorder", async (_event, pinnedTabId: string, newPosition: number) => {
  pinnedTabsController.reorder(pinnedTabId, newPosition);
  return true;
});

/**
 * Show the context menu for a pinned tab.
 */
ipcMain.on("pinned-tabs:show-context-menu", (event, pinnedTabId: string) => {
  const webContents = event.sender;
  const window = browserWindowsController.getWindowFromWebContents(webContents);
  if (!window) return;

  const pinnedTab = pinnedTabsController.getById(pinnedTabId);
  if (!pinnedTab) return;

  const contextMenu = new Menu();

  contextMenu.append(
    new MenuItem({
      label: "Unpin",
      click: () => {
        const removedTabIds = pinnedTabsController.remove(pinnedTabId);
        for (const tabId of removedTabIds) {
          const tab = tabsController.getTabById(tabId);
          if (tab && !tab.isDestroyed) {
            tab.destroy();
          }
        }
      }
    })
  );

  contextMenu.append(
    new MenuItem({
      type: "separator"
    })
  );

  // "Reset to Default" — navigate associated tab in current space back to defaultUrl
  const currentSpaceId = window.currentSpaceId;
  const associatedTabId = currentSpaceId ? pinnedTabsController.getAssociatedTabId(pinnedTabId, currentSpaceId) : null;
  const associatedTab = associatedTabId !== null ? tabsController.getTabById(associatedTabId) : undefined;
  const isOnDifferentUrl = associatedTab && associatedTab.url !== pinnedTab.defaultUrl;

  contextMenu.append(
    new MenuItem({
      label: "Reset to Default",
      enabled: !!isOnDifferentUrl,
      click: () => {
        if (associatedTab && !associatedTab.isDestroyed) {
          associatedTab.loadURL(pinnedTab.defaultUrl);
        }
      }
    })
  );

  contextMenu.append(
    new MenuItem({
      label: "Copy URL",
      click: () => {
        clipboard.writeText(pinnedTab.defaultUrl);
      }
    })
  );

  contextMenu.popup({
    window: window.browserWindow
  });
});
