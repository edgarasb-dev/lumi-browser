import { BaseWindow } from "@/controllers/windows-controller/types/base";
import { sessionsController } from "@/controllers/sessions-controller";
import { getDatastore } from "@/saving/datastore";
import { BrowserWindow, nativeTheme, screen } from "electron";

interface SettingsWindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const DEFAULT_WIDTH = 940;
const DEFAULT_HEIGHT = 680;
const MIN_WIDTH = 820;
const MIN_HEIGHT = 600;

const settingsWindowStore = getDatastore("settings-window");
let cachedBounds: SettingsWindowBounds | null = null;

function clampBoundsToDisplay(raw: Partial<SettingsWindowBounds>): SettingsWindowBounds {
  const width = Math.max(MIN_WIDTH, typeof raw.width === "number" ? Math.round(raw.width) : DEFAULT_WIDTH);
  const height = Math.max(MIN_HEIGHT, typeof raw.height === "number" ? Math.round(raw.height) : DEFAULT_HEIGHT);

  if (typeof raw.x === "number" && typeof raw.y === "number") {
    const display = screen.getDisplayMatching({ x: raw.x, y: raw.y, width, height });
    const area = display.workArea;
    const clampedWidth = Math.min(width, area.width);
    const clampedHeight = Math.min(height, area.height);
    const x = Math.min(Math.max(raw.x, area.x), area.x + area.width - clampedWidth);
    const y = Math.min(Math.max(raw.y, area.y), area.y + area.height - clampedHeight);
    return { width: clampedWidth, height: clampedHeight, x, y };
  }

  return { width, height };
}

void settingsWindowStore
  .get<SettingsWindowBounds>("bounds")
  .then((saved) => {
    if (saved) cachedBounds = saved;
  })
  .catch(() => {});

export class SettingsWindow extends BaseWindow {
  constructor() {
    const initial = cachedBounds
      ? clampBoundsToDisplay(cachedBounds)
      : { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    const hasPos = typeof initial.x === "number" && typeof initial.y === "number";

    const browserWindow = new BrowserWindow({
      title: "Lumi Settings",
      width: initial.width,
      minWidth: MIN_WIDTH,
      height: initial.height,
      minHeight: MIN_HEIGHT,
      x: initial.x,
      y: initial.y,

      center: !hasPos,
      show: false,
      frame: false,
      roundedCorners: true,

      // On Linux, "hidden" combined with frame:false prevents
      // ready-to-show from firing. Match BrowserWindow's pattern and
      // leave it undefined on Linux.
      titleBarStyle:
        process.platform === "darwin" ? "hiddenInset" : process.platform === "win32" ? "hidden" : undefined,
      titleBarOverlay: {
        height: 40,
        symbolColor: nativeTheme.shouldUseDarkColors ? "white" : "black",
        color: "rgba(0,0,0,0)"
      },

      // Match BrowserWindow's webPreferences so the renderer initializes
      // identically on all platforms (especially Linux where missing
      // sandbox/contextIsolation can prevent ready-to-show from firing).
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true
      },

      // Explicit background color ensures the compositor has an initial paint
      // on Linux, which is required for ready-to-show to fire for frameless
      // windows.
      backgroundColor: process.platform === "darwin" ? "#00000000" : "#000000",
      ...(process.platform === "darwin"
        ? {
            visualEffectState: "followWindow",
            vibrancy: "under-window"
          }
        : {})
    });

    super("settings", browserWindow, { deferShowUntilAfterLoad: true });

    // Apply persisted bounds if cache wasn't ready at constructor invocation.
    if (!cachedBounds) {
      void settingsWindowStore
        .get<SettingsWindowBounds>("bounds")
        .then((saved) => {
          if (!saved || this.destroyed || browserWindow.isDestroyed()) return;
          cachedBounds = saved;
          const clamped = clampBoundsToDisplay(saved);
          browserWindow.setBounds(clamped);
          if (typeof clamped.x !== "number") browserWindow.center();
        })
        .catch(() => {});
    }

    let saveBoundsTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSaveBounds = () => {
      if (this.destroyed || browserWindow.isDestroyed() || browserWindow.isMinimized()) return;
      if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
      saveBoundsTimer = setTimeout(() => {
        if (this.destroyed || browserWindow.isDestroyed()) return;
        const b = browserWindow.getBounds();
        cachedBounds = b;
        void settingsWindowStore.set("bounds", b).catch(() => {});
      }, 250);
    };

    browserWindow.on("resize", scheduleSaveBounds);
    browserWindow.on("move", scheduleSaveBounds);
    browserWindow.on("closed", () => {
      if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    });

    // Support native Cmd/Ctrl+W close inside Settings window.
    browserWindow.webContents.on("before-input-event", (event, input) => {
      if (
        input.type === "keyDown" &&
        (input.meta || input.control) &&
        !input.shift &&
        !input.alt &&
        input.key.toLowerCase() === "w"
      ) {
        event.preventDefault();
        browserWindow.close();
      }
    });

    // Wait for default session (and its protocol handlers) to be ready
    // before loading the lumi-internal:// URL, matching the pattern used
    // by BrowserWindow and OnboardingWindow. Without this, the loadURL
    // call can fail on Linux if the protocol hasn't been registered yet.
    sessionsController.whenDefaultSessionReady().then(() => {
      browserWindow.loadURL("lumi-internal://settings/");
    });

    // Fallback: On Linux, ready-to-show may never fire for frameless
    // windows. If did-finish-load fires but the window still isn't
    // visible after a short delay, force-unblock the show() call by
    // emitting "loaded" so that waitUntil("loaded") resolves.
    if (process.platform === "linux") {
      browserWindow.webContents.once("did-finish-load", () => {
        setTimeout(() => {
          if (!this.destroyed && !browserWindow.isDestroyed() && !browserWindow.isVisible()) {
            this.emit("loaded");
          }
        }, 200);
      });
    }
  }
}
