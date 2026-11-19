import { pinnedTabsController } from "@/controllers/pinned-tabs-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { moveTabOrGroupToWindow } from "@/controllers/tabs-controller/tab-sync";
import type { BrowserWindow } from "@/controllers/windows-controller/types";
import type { PinnedTabData } from "~/types/pinned-tabs";

/**
 * Create a new ephemeral tab for a pinned tab in a specific space, associate it, and activate it.
 */
export async function createAndAssociatePinnedTab(
  pinnedTabId: string,
  pinnedTab: PinnedTabData,
  window: BrowserWindow,
  spaceId: string,
  url?: string
) {
  const newTab = await tabsController.createTab(window.id, pinnedTab.profileId, spaceId, undefined, {
    url: url ?? pinnedTab.defaultUrl,
    ephemeral: true
  });

  pinnedTabsController.associateTab(pinnedTabId, spaceId, newTab.id);
  tabsController.activateTab(newTab);
  return newTab;
}

export function pinTabToSpace(tabId: number, position?: number): PinnedTabData | null {
  const tab = tabsController.getTabById(tabId);
  if (!tab || !tab.url) return null;

  const existingPin = pinnedTabsController.getPinnedIdByTabId(tab.id);
  if (existingPin) {
    return pinnedTabsController.getById(existingPin.pinnedTabId);
  }

  // Detach from any glance/split group before converting to an ephemeral pinned tab
  const existingGroup = tabsController.getTabGroupByTabId(tab.id);
  existingGroup?.removeTab(tab.id);

  const faviconUrl = tab.faviconURL ?? null;
  const pinnedTab = pinnedTabsController.create(tab.profileId, tab.url, faviconUrl, position);

  // Mark the tab as ephemeral so it won't be persisted across sessions
  tabsController.makeTabEphemeral(tab.id);

  // Associate the pinned tab with the browser tab in its current space
  pinnedTabsController.associateTab(pinnedTab.uniqueId, tab.spaceId, tab.id);

  return { ...pinnedTab, associatedTabIdsBySpace: { [tab.spaceId]: tab.id } };
}

export async function unpinPinnedTabToList(
  pinnedTabId: string,
  window: BrowserWindow,
  currentSpaceId: string,
  position?: number
): Promise<boolean> {
  const pinnedTab = pinnedTabsController.getById(pinnedTabId);
  if (!pinnedTab) return false;

  const associatedTabId = pinnedTabsController.getAssociatedTabId(pinnedTabId, currentSpaceId);
  let preservedTabId: number | null = null;

  if (associatedTabId !== null) {
    const tab = tabsController.getTabById(associatedTabId);
    if (tab && position !== undefined) {
      tab.updateStateProperty("position", position);
    }
    tabsController.makeTabPersistent(associatedTabId);
    if (tab) {
      preservedTabId = tab.id;
      tabsController.normalizePositions(tab.getWindow().id, tab.spaceId);
    }
  } else {
    const newTab = await tabsController.createTab(window.id, pinnedTab.profileId, currentSpaceId, undefined, {
      url: pinnedTab.defaultUrl,
      position
    });
    preservedTabId = newTab.id;
    tabsController.activateTab(newTab);
    tabsController.normalizePositions(window.id, currentSpaceId);
  }

  const removedTabIds = pinnedTabsController.remove(pinnedTabId);
  for (const tabId of removedTabIds) {
    if (tabId === preservedTabId) continue;
    const tab = tabsController.getTabById(tabId);
    if (tab && !tab.isDestroyed) {
      tab.destroy();
    }
  }

  return true;
}

export async function toggleFocusedTabPin(window: BrowserWindow): Promise<boolean> {
  const spaceId = window.currentSpaceId;
  if (!spaceId) return false;

  const focusedTab = tabsController.getFocusedTab(window.id, spaceId);
  if (!focusedTab) return false;

  const pinnedInfo = pinnedTabsController.getPinnedIdByTabId(focusedTab.id);
  if (pinnedInfo) {
    return unpinPinnedTabToList(pinnedInfo.pinnedTabId, window, spaceId);
  }

  return pinTabToSpace(focusedTab.id) !== null;
}

export async function handlePinnedTabClick(
  window: BrowserWindow,
  pinnedTabId: string,
  navigateToDefault: boolean
): Promise<boolean> {
  const pinnedTab = pinnedTabsController.getById(pinnedTabId);
  if (!pinnedTab) return false;

  const currentSpaceId = window.currentSpaceId;
  if (!currentSpaceId) return false;

  const associatedTabId = pinnedTabsController.getAssociatedTabId(pinnedTabId, currentSpaceId);

  if (associatedTabId !== null) {
    const tab = tabsController.getTabById(associatedTabId);
    if (tab && !tab.isDestroyed) {
      if (tab.getWindow().id !== window.id) {
        await moveTabOrGroupToWindow(tab, window);
      }

      if (navigateToDefault && tab.url !== pinnedTab.defaultUrl) {
        tab.loadURL(pinnedTab.defaultUrl);
      }
      tabsController.activateTab(tab);
      return true;
    }
    pinnedTabsController.dissociateTab(pinnedTabId, currentSpaceId);
  }

  const newTab = await createAndAssociatePinnedTab(pinnedTabId, pinnedTab, window, currentSpaceId);
  return newTab !== null;
}
