import { BrowserWindow as ElectronWindow, ipcMain, Menu, MenuItem } from "electron";
import { BrowserWindow } from "@/controllers/windows-controller/types";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { setWindowCursorEdgeMode } from "@/controllers/windows-controller/utils/cursor-edge-monitor";
import { openNewTab } from "@/ipc/app/new-tab";
import { getSettingValueById, setSettingValueById } from "@/saving/settings";
import type { CursorEdgeMonitorMode } from "~/lumi/interfaces/browser/interface";

ipcMain.on("window-button:set-position", (event, position: { x: number; y: number }) => {
  const win = ElectronWindow.fromWebContents(event.sender);
  if (win && "setWindowButtonPosition" in win) {
    win.setWindowButtonPosition(position);
  }
});

ipcMain.on("window-button:set-visibility", (event, visible: boolean) => {
  const tabbedWindow = browserWindowsController.getWindowFromWebContents(event.sender);
  if (tabbedWindow) {
    tabbedWindow.setMacOSTrafficLights(visible);
  }
});

export function toggleSidebar(win: BrowserWindow) {
  win.sendMessageToCoreWebContents("sidebar:on-toggle");
}

// These methods are only available for popup windows
function moveWindowTo(win: ElectronWindow, x: number, y: number) {
  win.setPosition(x, y);
}

function resizeWindowTo(win: ElectronWindow, width: number, height: number) {
  win.setSize(width, height);
}

ipcMain.on("interface:move-window-by", (event, x: number, y: number) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (win) {
    const electronWindow = win.browserWindow;
    if (!electronWindow.isFullScreen() && !electronWindow.isMaximized()) {
      const position = electronWindow.getPosition();
      moveWindowTo(electronWindow, position[0] + x, position[1] + y);
    }
  }
});

ipcMain.on("interface:move-window-to", (event, x: number, y: number) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (win) {
    const electronWindow = win.browserWindow;
    if (!electronWindow.isFullScreen() && !electronWindow.isMaximized()) {
      moveWindowTo(electronWindow, x, y);
    }
  }
});

ipcMain.on("interface:resize-window-by", (event, width: number, height: number) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (win && win.browserWindowType === "popup") {
    const size = win.browserWindow.getSize();
    resizeWindowTo(win.browserWindow, size[0] + width, size[1] + height);
  }
});

ipcMain.on("interface:resize-window-to", (event, width: number, height: number) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (win && win.browserWindowType === "popup") {
    resizeWindowTo(win.browserWindow, width, height);
  }
});

// Window Controls
ipcMain.on("interface:minimize-window", (event) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (win) {
    win.browserWindow.minimize();
  }
});

ipcMain.on("interface:maximize-window", (event) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (win) {
    if (win.browserWindow.isMaximized()) {
      win.browserWindow.unmaximize();
    } else {
      win.browserWindow.maximize();
    }
  }
});

ipcMain.on("interface:close-window", (event) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (win) {
    win.browserWindow.close();
  }
});

function getWindowState(win: BrowserWindow) {
  return {
    isMaximized: win.browserWindow.isMaximized(),
    isFullscreen: win.browserWindow.isFullScreen()
  };
}

ipcMain.handle("interface:get-window-state", (event) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (win) {
    return getWindowState(win);
  }
  return false;
});

export function fireWindowStateChanged(win: BrowserWindow) {
  win.sendMessage("interface:window-state-changed", getWindowState(win));
}

ipcMain.on("interface:set-cursor-edge-monitor-mode", (event, mode: CursorEdgeMonitorMode) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (win) {
    setWindowCursorEdgeMode(win.id, mode);
  }
});

ipcMain.on("interface:show-navigation-layout-menu", (event) => {
  const win = browserWindowsController.getWindowFromWebContents(event.sender);
  if (!win || win.browserWindowType !== "normal") return;

  const currentLayout = getSettingValueById("navigationLayout") === "topbar" ? "topbar" : "sidebar";
  const sidebarSide = getSettingValueById("sidebarSide") === "right" ? "right" : "left";

  const contextMenu = new Menu();

  contextMenu.append(
    new MenuItem({
      label: "New Tab",
      click: () => {
        openNewTab(win);
      }
    })
  );

  contextMenu.append(new MenuItem({ type: "separator" }));

  contextMenu.append(
    new MenuItem({
      label: "Vertical Sidebar",
      type: "radio",
      checked: currentLayout === "sidebar",
      click: () => {
        void setSettingValueById("navigationLayout", "sidebar");
      }
    })
  );

  contextMenu.append(
    new MenuItem({
      label: "Horizontal Top Bar",
      type: "radio",
      checked: currentLayout === "topbar",
      click: () => {
        void setSettingValueById("navigationLayout", "topbar");
      }
    })
  );

  if (currentLayout === "sidebar") {
    contextMenu.append(new MenuItem({ type: "separator" }));
    contextMenu.append(
      new MenuItem({
        label: sidebarSide === "right" ? "Move Sidebar to Left" : "Move Sidebar to Right",
        click: () => {
          void setSettingValueById("sidebarSide", sidebarSide === "right" ? "left" : "right");
        }
      })
    );
  }

  contextMenu.popup({ window: win.browserWindow });
});
