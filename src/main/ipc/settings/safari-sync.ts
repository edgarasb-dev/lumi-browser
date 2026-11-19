import { ipcMain } from "electron";
import { safariSyncController } from "@/controllers/safari-sync-controller";
import { sendMessageToListeners } from "@/ipc/listeners-manager";
import type {
  ICloudSyncConfig,
  LocalCompanionConfig,
  SafariImportOptions,
  SafariLiveSyncConfig
} from "~/types/safari-sync";

safariSyncController.on("state-changed", (state) => {
  sendMessageToListeners("safari-sync:on-state-changed", state);
});

ipcMain.handle("safari-sync:get-state", async () => {
  return safariSyncController.getState();
});

ipcMain.handle("safari-sync:discover-safari", async (_event, customBookmarksFilePath?: string) => {
  return safariSyncController.discoverSafari(customBookmarksFilePath);
});

ipcMain.handle("safari-sync:pick-bookmarks-file", async () => {
  return safariSyncController.pickBookmarksFile();
});

ipcMain.handle("safari-sync:import-from-safari", async (_event, options: SafariImportOptions) => {
  return safariSyncController.importFromSafari(options);
});

ipcMain.handle("safari-sync:open-in-safari", async (_event, url: string) => {
  return safariSyncController.openInSafari(url);
});

ipcMain.handle("safari-sync:update-safari-live-sync", async (_event, updates: Partial<SafariLiveSyncConfig>) => {
  return safariSyncController.updateSafariLiveSync(updates);
});

ipcMain.handle("safari-sync:sync-safari-tabs-now", async () => {
  return safariSyncController.syncSafariOpenTabsNow(false);
});

ipcMain.handle("safari-sync:open-mac-privacy-settings", async (_event, pane: "automation" | "full-disk-access") => {
  return safariSyncController.openMacPrivacySettings(pane);
});

ipcMain.handle("safari-sync:update-icloud-config", async (_event, updates: Partial<ICloudSyncConfig>) => {
  return safariSyncController.updateICloudConfig(updates);
});

ipcMain.handle("safari-sync:set-icloud-passphrase", async (_event, passphrase: string) => {
  return safariSyncController.setICloudPassphrase(passphrase);
});

ipcMain.handle("safari-sync:generate-icloud-passphrase", async () => {
  return safariSyncController.generateICloudPassphrase();
});

ipcMain.handle("safari-sync:reveal-icloud-passphrase", async () => {
  return safariSyncController.revealICloudPassphrase();
});

ipcMain.handle("safari-sync:pick-icloud-directory", async () => {
  return safariSyncController.pickICloudDirectory();
});

ipcMain.handle("safari-sync:reveal-icloud-directory", async () => {
  return safariSyncController.revealICloudDirectory();
});

ipcMain.handle("safari-sync:sync-icloud-now", async () => {
  return safariSyncController.syncICloudNow();
});

ipcMain.handle("safari-sync:open-remote-device-tab", async (_event, url: string, spaceId?: string) => {
  return safariSyncController.openRemoteDeviceTab(url, spaceId);
});

ipcMain.handle("safari-sync:open-all-remote-device-tabs", async (_event, deviceId: string, createSpace?: boolean) => {
  return safariSyncController.openAllRemoteDeviceTabs(deviceId, createSpace);
});

ipcMain.handle("safari-sync:update-companion-config", async (_event, updates: Partial<LocalCompanionConfig>) => {
  return safariSyncController.updateCompanionConfig(updates);
});

ipcMain.handle("safari-sync:regenerate-companion-pairing", async () => {
  return safariSyncController.regenerateCompanionPairing();
});

ipcMain.handle("safari-sync:open-inbox-link", async (_event, linkId: string, spaceId?: string) => {
  return safariSyncController.openInboxLink(linkId, spaceId);
});

ipcMain.handle("safari-sync:save-inbox-link-to-favourites", async (_event, linkId: string) => {
  return safariSyncController.saveInboxLinkToFavourites(linkId);
});

ipcMain.handle("safari-sync:dismiss-inbox-link", async (_event, linkId: string) => {
  return safariSyncController.dismissInboxLink(linkId);
});

ipcMain.handle("safari-sync:clear-inbox", async () => {
  return safariSyncController.clearInbox();
});
