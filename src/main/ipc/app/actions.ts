import { ipcMain } from "electron";
import { BrowserWindow } from "@/controllers/windows-controller/types";
import { windowsController } from "@/controllers/windows-controller";
import { sendMessageToListeners } from "@/ipc/listeners-manager";

export async function fireCopyLinkAction(win: BrowserWindow) {
  win.sendMessage("actions:on-copy-link");
}

export async function fireFrontendAction(action: string) {
  const focused = windowsController.browser.getFocused();
  if (focused && !focused.destroyed) {
    focused.sendMessageToCoreWebContents("actions:on-incoming", action);
    return;
  }
  sendMessageToListeners("actions:on-incoming", action);
}

ipcMain.on("actions:emit-incoming", (_event, action: string) => {
  void fireFrontendAction(action);
});
