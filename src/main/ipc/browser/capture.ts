import { ipcMain } from "electron";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { tabsController } from "@/controllers/tabs-controller";
import {
  captureFullScrollTabPage,
  captureVisibleTabPage,
  copyCapturedDataUrl,
  saveCapturedPng
} from "@/modules/page-capture";
import type { CaptureRect } from "~/lumi/interfaces/browser/capture";

function getActiveTabFromSender(sender: Electron.WebContents) {
  const win =
    browserWindowsController.getWindowFromWebContents(sender) ??
    browserWindowsController.getFocusedWindow() ??
    browserWindowsController.getWindows()[0];
  if (!win || !win.currentSpaceId) return { win: null, tab: null };
  const tab = tabsController.getFocusedTab(win.id, win.currentSpaceId);
  return { win, tab };
}

ipcMain.handle("capture:visible", async (event, rect?: CaptureRect) => {
  const { tab } = getActiveTabFromSender(event.sender);
  if (!tab) return null;
  return await captureVisibleTabPage(tab, rect);
});

ipcMain.handle("capture:full-page", async (event) => {
  const { tab } = getActiveTabFromSender(event.sender);
  if (!tab) return null;
  return await captureFullScrollTabPage(tab);
});

ipcMain.handle("capture:copy-data-url", async (_event, dataUrl: string) => {
  return await copyCapturedDataUrl(dataUrl);
});

ipcMain.handle("capture:save-png", async (event, dataUrl: string, suggestedFilename?: string) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  return await saveCapturedPng(win?.browserWindow, dataUrl, suggestedFilename);
});
