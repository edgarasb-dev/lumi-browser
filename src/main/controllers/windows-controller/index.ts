import { WindowTypeManager } from "@/controllers/windows-controller/type-manager";
import {
  SettingsWindow,
  BaseWindow,
  OnboardingWindow,
  BrowserWindow,
  ExtensionPopupWindow
} from "@/controllers/windows-controller/types";
import { debugPrint } from "@/modules/output";
import { TypedEventEmitter } from "@/modules/typed-event-emitter";
import { BrowserWindow as ElectronBrowserWindow, type WebContents } from "electron";
import "./utils/close-preventer";
import "./utils/tab-cycle-shortcuts";

export type WindowType = "browser" | "settings" | "onboarding" | "extension-popup";

const WINDOW_PRIORITY: Record<WindowType, number> = {
  browser: 0,
  "extension-popup": 1,
  onboarding: 2,
  settings: 3
};

type WindowsControllerEvents = {
  "window-added": [id: number, window: BaseWindow];
  "window-removed": [id: number, window: BaseWindow];
  "window-focused": [id: number, window: BaseWindow];
};

class WindowsController extends TypedEventEmitter<WindowsControllerEvents> {
  private windows: Map<number, BaseWindow>;
  private focusOrder: number[] = [];

  // Window Type Managers //
  public settings: WindowTypeManager<typeof SettingsWindow>;
  public onboarding: WindowTypeManager<typeof OnboardingWindow>;
  public browser: WindowTypeManager<typeof BrowserWindow>;
  public extensionPopup: WindowTypeManager<typeof ExtensionPopupWindow>;

  constructor() {
    super();

    this.windows = new Map();

    // Window Type Managers //
    this.settings = new WindowTypeManager(this, "settings", SettingsWindow, { singleton: true });
    this.onboarding = new WindowTypeManager(this, "onboarding", OnboardingWindow, { singleton: true });
    this.browser = new WindowTypeManager(this, "browser", BrowserWindow);
    this.extensionPopup = new WindowTypeManager(this, "extension-popup", ExtensionPopupWindow);
  }

  private bumpFocusOrder(id: number) {
    const idx = this.focusOrder.indexOf(id);
    if (idx !== -1) {
      this.focusOrder.splice(idx, 1);
    }
    this.focusOrder.push(id);
  }

  // Add & Remove //
  /** Warning: This should only be used internally! */
  public _addWindow(window: BaseWindow) {
    const id = window.id;
    this.windows.set(id, window);
    this.bumpFocusOrder(id);
    this.emit("window-added", id, window);

    window.browserWindow.on("focus", () => {
      if (!window.destroyed) {
        this.bumpFocusOrder(id);
        this.emit("window-focused", id, window);
      }
    });
    window.on("destroyed", () => this._removeWindow(id));

    debugPrint("WINDOWS", "Window added with type", window.type, "and id", id);
  }

  /** Warning: This should only be used internally! */
  public _removeWindow(id: number) {
    const window = this.windows.get(id);
    this.focusOrder = this.focusOrder.filter((entryId) => entryId !== id);
    if (window) {
      this.windows.delete(id);
      this.emit("window-removed", id, window);

      debugPrint("WINDOWS", "Window removed with type", window.type, "and id", id);
    }
  }

  // Get Functions //
  public getFocused() {
    for (const window of this.windows.values()) {
      if (window.destroyed || window.browserWindow.isDestroyed()) continue;
      if (window.browserWindow.isFocused()) {
        return window;
      }
    }
    return null;
  }

  public getWindowById(id: number) {
    const window = this.windows.get(id);
    return window ? window : null;
  }

  public getWindowFromWebContents(webContents: WebContents): BaseWindow | null {
    for (const window of this.windows.values()) {
      if (window.destroyed || window.browserWindow.isDestroyed()) continue;

      const foundWebContents = window.getAllWebContents();

      for (const wc of foundWebContents) {
        if (wc.id === webContents.id) {
          return window;
        }
      }
    }
    return null;
  }

  public getIdFromWindow(window: BaseWindow) {
    for (const [id, w] of this.windows.entries()) {
      if (w === window) {
        return id;
      }
    }
    return null;
  }

  public getAllWindows() {
    return Array.from(this.windows.values());
  }

  /**
   * Restores windows back-to-front on app activation so Settings (or Onboarding)
   * always rises above browser windows rather than being buried underneath.
   */
  public activateWindows(): boolean {
    const managed = this.getAllWindows().filter((w) => !w.destroyed && !w.browserWindow.isDestroyed());
    if (managed.length === 0) {
      const fallback = ElectronBrowserWindow.getAllWindows().filter((bw) => !bw.isDestroyed());
      if (fallback.length === 0) return false;
      for (const bw of fallback) {
        if (bw.isMinimized()) bw.restore();
        bw.show();
        bw.focus();
      }
      return true;
    }

    const rank = (win: BaseWindow) => {
      const mruIdx = this.focusOrder.indexOf(win.id);
      return mruIdx === -1 ? win.id : mruIdx;
    };

    const ordered = [...managed].sort((a, b) => {
      const tierDiff = WINDOW_PRIORITY[a.type] - WINDOW_PRIORITY[b.type];
      if (tierDiff !== 0) return tierDiff;
      return rank(a) - rank(b);
    });

    const topWindow = ordered[ordered.length - 1];
    const hasUnminimized = ordered.some((w) => !w.browserWindow.isMinimized());

    for (const win of ordered) {
      if (win === topWindow) continue;
      const bw = win.browserWindow;
      if (bw.isMinimized()) {
        if (!hasUnminimized) {
          bw.restore();
          bw.showInactive();
        }
      } else {
        bw.showInactive();
      }
    }

    const bringTopToFront = () => {
      if (topWindow.destroyed || topWindow.browserWindow.isDestroyed()) return;
      topWindow.showImmediately(true);
    };

    bringTopToFront();
    setImmediate(bringTopToFront);
    return true;
  }
}

export { type WindowsController };
export const windowsController = new WindowsController();
export const browserWindowsManager = windowsController.browser;
