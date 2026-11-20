import { ipcMain } from "electron";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import type { SidePanelBounds } from "~/lumi/interfaces/browser/side-panel";

ipcMain.handle(
  "side-panel:set-state",
  async (event, params: { visible: boolean; mode: "scratchpad" | "web"; url?: string; bounds?: SidePanelBounds }) => {
    const win = browserWindowsController.getWindowFromWebContents(event.sender);
    if (!win) return false;
    return await win.sidePanel.setState(params);
  }
);

ipcMain.handle("side-panel:navigate", async (event, url: string) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (!win) return false;
  return await win.sidePanel.navigate(url);
});

ipcMain.handle("side-panel:go-back", async (event) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (!win) return false;
  return await win.sidePanel.goBack();
});

ipcMain.handle("side-panel:go-forward", async (event) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (!win) return false;
  return await win.sidePanel.goForward();
});

ipcMain.handle("side-panel:reload", async (event) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (!win) return false;
  return await win.sidePanel.reload();
});
