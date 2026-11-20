import { ipcMain } from "electron";
import { tabsController } from "@/controllers/tabs-controller";
import { contentBlocker } from "@/modules/content-blocker";
import {
  DEFAULT_SITE_SETTINGS,
  extractOriginFromUrl,
  getSiteSettings,
  listProfileSiteSettings,
  resetProfileOriginSettings,
  setSitePermissionDecision,
  setSiteSmartDarkMode,
  setSiteZoom
} from "@/saving/site-settings";
import { sessionsController } from "@/controllers/sessions-controller";
import { windowsController } from "@/controllers/windows-controller";
import { profilesController } from "@/controllers/profiles-controller";
import type { SitePermissionDecision, SitePermissionKey, TabSiteControlsState } from "~/types/site-controls";

function syncMatchingOriginTabs(profileId: string, origin: string) {
  for (const tab of tabsController.getTabsInProfile(profileId)) {
    const tabUrl = tab.webContents?.getURL() || tab.url;
    const info = extractOriginFromUrl(tabUrl);
    if (info && info.origin === origin) {
      void tab.applySiteSettingsForCurrentUrl();
    }
  }
}

ipcMain.handle("site-controls:get-for-tab", async (_event, tabId: number): Promise<TabSiteControlsState | null> => {
  const tab = tabsController.getTabById(tabId);
  if (!tab || tab.isDestroyed) return null;

  const url = tab.webContents?.getURL() || tab.url;
  const originInfo = extractOriginFromUrl(url);
  if (!originInfo) {
    const parsed = URL.parse(url);
    return {
      origin: null,
      hostname: parsed?.hostname || parsed?.host || "",
      protocol: parsed?.protocol || "",
      settings: { ...DEFAULT_SITE_SETTINGS },
      blockerStats: null
    };
  }

  const [settings, blockerStats] = await Promise.all([
    getSiteSettings(tab.profileId, originInfo.origin),
    Promise.resolve(contentBlocker.getTabStats(tabId))
  ]);

  return {
    origin: originInfo.origin,
    hostname: originInfo.hostname,
    protocol: originInfo.protocol,
    settings,
    blockerStats
  };
});

ipcMain.handle("site-controls:set-zoom", async (_event, tabId: number, zoomFactor: number): Promise<number> => {
  const tab = tabsController.getTabById(tabId);
  if (!tab || tab.isDestroyed || !tab.webContents || tab.webContents.isDestroyed()) return 1;

  const url = tab.webContents.getURL() || tab.url;
  const originInfo = extractOriginFromUrl(url);
  if (!originInfo) {
    const clamped = Math.round(Math.min(2.5, Math.max(0.5, zoomFactor)) * 100) / 100;
    tab.webContents.setZoomFactor(clamped);
    return clamped;
  }

  const next = await setSiteZoom(tab.profileId, originInfo.origin, zoomFactor);
  syncMatchingOriginTabs(tab.profileId, originInfo.origin);
  return next.zoomFactor;
});

ipcMain.handle("site-controls:set-smart-dark", async (_event, tabId: number, enabled: boolean): Promise<boolean> => {
  const tab = tabsController.getTabById(tabId);
  if (!tab || tab.isDestroyed) return false;

  const url = tab.webContents?.getURL() || tab.url;
  const originInfo = extractOriginFromUrl(url);
  if (!originInfo) return false;

  await setSiteSmartDarkMode(tab.profileId, originInfo.origin, enabled);
  syncMatchingOriginTabs(tab.profileId, originInfo.origin);
  return enabled;
});

ipcMain.handle(
  "site-controls:set-permission",
  async (_event, tabId: number, permission: SitePermissionKey, decision: SitePermissionDecision) => {
    const tab = tabsController.getTabById(tabId);
    if (!tab || tab.isDestroyed) return null;

    const url = tab.webContents?.getURL() || tab.url;
    const originInfo = extractOriginFromUrl(url);
    if (!originInfo) return null;

    return await setSitePermissionDecision(tab.profileId, originInfo.origin, permission, decision);
  }
);

ipcMain.handle("site-controls:clear-site-data", async (_event, tabId: number): Promise<boolean> => {
  const tab = tabsController.getTabById(tabId);
  if (!tab || tab.isDestroyed) return false;

  const url = tab.webContents?.getURL() || tab.url;
  const originInfo = extractOriginFromUrl(url);
  if (!originInfo) return false;

  const session = sessionsController.get(tab.profileId);
  await session.clearStorageData({ origin: originInfo.origin });
  tab.webContents?.reload();
  return true;
});

ipcMain.handle("site-controls:list-profile", async (_event, profileId?: string) => {
  if (profileId) {
    return listProfileSiteSettings(profileId);
  }
  const focused = windowsController.browser.getFocused();
  if (focused?.currentSpaceId) {
    const spaceTabs = tabsController.getTabsInSpace(focused.currentSpaceId);
    if (spaceTabs[0]) {
      return listProfileSiteSettings(spaceTabs[0].profileId);
    }
  }
  const allProfiles = await profilesController.getAll();
  const primary = allProfiles.find((p) => !p.internal) ?? allProfiles[0];
  return primary ? listProfileSiteSettings(primary.id) : [];
});

ipcMain.handle("site-controls:reset-origin", async (_event, profileId: string, origin: string) => {
  const removed = await resetProfileOriginSettings(profileId, origin);
  if (removed) {
    syncMatchingOriginTabs(profileId, origin);
  }
  return removed;
});
