// Opens or focuses the in-browser Settings tab (`lumi://settings`)
import { spacesController } from "@/controllers/spaces-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";

function buildSettingsUrl(section?: string): string {
  if (!section) return "lumi://settings";
  const url = new URL("lumi://settings");
  url.searchParams.set("section", section);
  return url.toString();
}

function isSettingsTabUrl(rawUrl: string): boolean {
  const parsed = URL.parse(rawUrl);
  return parsed?.protocol === "lumi:" && parsed.hostname === "settings";
}

async function resolveTargetBrowserWindow() {
  const focused = browserWindowsController.getFocusedWindow();
  if (focused && !focused.destroyed && focused.browserWindowType === "normal") {
    return focused;
  }

  const normalWindow = browserWindowsController
    .getWindows()
    .find((win) => !win.destroyed && win.browserWindowType === "normal");
  if (normalWindow) {
    return normalWindow;
  }

  return await browserWindowsController.create("normal");
}

export const settings = {
  show: async (section?: string) => {
    const targetWindow = await resolveTargetBrowserWindow();
    if (targetWindow.destroyed) return;

    const targetUrl = buildSettingsUrl(section);
    const windowTabs = tabsController.getTabsInWindow(targetWindow.id);
    const existingTab =
      windowTabs.find((tab) => tab.spaceId === targetWindow.currentSpaceId && isSettingsTabUrl(tab.url)) ??
      windowTabs.find((tab) => isSettingsTabUrl(tab.url));

    if (existingTab) {
      const wasAsleep = existingTab.asleep;
      tabsController.activateTab(existingTab);

      if (section) {
        if (wasAsleep || existingTab.webContents?.isLoadingMainFrame()) {
          if (existingTab.url !== targetUrl) {
            existingTab.loadURL(targetUrl);
          }
        } else if (existingTab.webContents && !existingTab.webContents.isDestroyed()) {
          existingTab.webContents.send("settings:navigate-section", section);
        }
      }

      await targetWindow.show(true);
      return;
    }

    let spaceId = targetWindow.currentSpaceId ?? undefined;
    let profileId: string | undefined;
    if (spaceId) {
      const space = await spacesController.get(spaceId);
      profileId = space?.profileId;
    }
    if (!spaceId || !profileId) {
      const lastUsed = await spacesController.getLastUsed();
      if (lastUsed) {
        spaceId = lastUsed.id;
        profileId = lastUsed.profileId;
        if (!targetWindow.currentSpaceId) {
          targetWindow.setCurrentSpace(lastUsed.id);
        }
      }
    }

    const tab = await tabsController.createTab(targetWindow.id, profileId, spaceId, undefined, {
      url: targetUrl
    });
    tabsController.activateTab(tab);
    await targetWindow.show(true);
  }
};
