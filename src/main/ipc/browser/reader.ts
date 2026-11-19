import { ipcMain } from "electron";
import { readerModeController } from "@/controllers/reader-mode-controller";
import type { ReaderPreferences } from "~/types/reader";

ipcMain.handle("reader:toggle", async (_event, tabId: number) => {
  return await readerModeController.toggle(tabId);
});

ipcMain.handle("reader:enable", async (_event, tabId: number) => {
  return await readerModeController.enable(tabId);
});

ipcMain.handle("reader:disable", async (_event, tabId: number) => {
  return readerModeController.disable(tabId);
});

ipcMain.handle("reader:get-article", async (_event, tabId: number) => {
  return readerModeController.getArticle(tabId);
});

ipcMain.handle("reader:get-preferences", async () => {
  return await readerModeController.getPreferences();
});

ipcMain.handle("reader:update-preferences", async (_event, updates: Partial<ReaderPreferences>) => {
  return await readerModeController.updatePreferences(updates);
});
