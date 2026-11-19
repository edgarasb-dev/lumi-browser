import { MenuItemConstructorOptions } from "electron";
import { getFocusedBrowserWindow } from "../helpers";
import { tabsController } from "@/controllers/tabs-controller";
import { getCurrentShortcut } from "@/modules/shortcuts";
import { toggleFocusedTabPin } from "@/ipc/browser/pinned-tabs";

export function menuNextTab() {
  const window = getFocusedBrowserWindow();
  const spaceId = window?.currentSpaceId;
  if (!window || !spaceId) return;
  tabsController.activateNextTabInSpace(window.id, spaceId);
}

export function menuPreviousTab() {
  const window = getFocusedBrowserWindow();
  const spaceId = window?.currentSpaceId;
  if (!window || !spaceId) return;
  tabsController.activatePreviousTabInSpace(window.id, spaceId);
}

export function menuToggleSplitView() {
  const window = getFocusedBrowserWindow();
  const spaceId = window?.currentSpaceId;
  if (!window || !spaceId) return;

  const active = tabsController.getActiveTab(window.id, spaceId);
  if (!active) return;

  if (!("id" in active)) {
    // Active item is a TabGroup (split or glance)
    if (active.mode === "split") {
      const focused = tabsController.getFocusedTab(window.id, spaceId);
      tabsController.ungroupTabGroup(active.groupId, focused?.id);
    } else if (active.mode === "glance") {
      tabsController.dismissGlance(active.groupId, true);
    }
    return;
  }

  if (active.ephemeral) return;
  const candidate = tabsController
    .getTabsInWindowSpace(window.id, spaceId)
    .find((t) => t.id !== active.id && !t.ephemeral && !t.groupId);
  if (candidate) {
    tabsController.createSplitView([active.id, candidate.id], "horizontal");
  }
}

export const createTabsMenu = (): MenuItemConstructorOptions => ({
  label: "Tabs",
  submenu: [
    {
      label: "Next Tab",
      accelerator: getCurrentShortcut("tabs.next"),
      click: menuNextTab
    },
    {
      label: "Previous Tab",
      accelerator: getCurrentShortcut("tabs.previous"),
      click: menuPreviousTab
    },
    { type: "separator" },
    {
      label: "Pin / Unpin Tab",
      accelerator: getCurrentShortcut("tab.togglePin"),
      click: () => {
        const window = getFocusedBrowserWindow();
        if (window) {
          void toggleFocusedTabPin(window);
        }
      }
    },
    {
      label: "Toggle Split View",
      accelerator: getCurrentShortcut("tab.toggleSplitView"),
      click: menuToggleSplitView
    }
  ]
});
