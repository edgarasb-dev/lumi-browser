import { Tab } from "./tab";
import { BrowserWindow } from "@/controllers/windows-controller/types";
import type { WebContents } from "electron";

/**
 * Pre-sleep state stored in memory so the serialization layer
 * can persist the "real" URL/nav history even while the tab is asleep
 * (webContents is destroyed during sleep).
 */
export interface PreSleepState {
  url: string;
  navHistory: Electron.NavigationEntry[];
  navHistoryIndex: number;
}

/**
 * Manages tab lifecycle transitions: sleep/wake, fullscreen, and picture-in-picture.
 *
 * Design notes:
 * - Owns the pre-sleep state snapshot so serialization can access the "real" data
 * - Reads tab state but mutates it only through tab.updateStateProperty()
 * - Does NOT know about persistence or the controller
 *
 * Sleep/wake now destroys and recreates the WebContentsView entirely,
 * saving ~20-50MB RAM per sleeping tab compared to the old approach
 * of navigating to about:blank?sleep=true.
 */
export class TabLifecycleManager {
  /** Snapshot of URL/nav state taken before the tab goes to sleep */
  public preSleepState: PreSleepState | null = null;

  /** Disconnect functions for window fullscreen lifecycle listeners */
  private disconnectEnterFullScreen: (() => void) | null = null;
  private disconnectLeaveFullScreen: (() => void) | null = null;

  /** Tracks macOS OS fullscreen transition so early exits are queued rather than dropped by AppKit */
  private isEnteringOsFullScreen: boolean = false;
  private exitOsAfterEnter: boolean = false;

  /** Cancelable cleanup timers for HTML fullscreen exit and bounds nudging */
  private boundsNudgeTimer: NodeJS.Timeout | null = null;
  private boundsRestoreTimer: NodeJS.Timeout | null = null;
  private exitRetryTimer: NodeJS.Timeout | null = null;

  constructor(private readonly tab: Tab) {}

  // --- Sleep / Wake ---

  /**
   * Puts the tab to sleep to save resources.
   * Captures a snapshot of the current URL and navigation history,
   * then destroys the WebContentsView entirely.
   *
   * @param knownPreSleepState - If provided, use this as the pre-sleep state
   *   instead of reading from the tab. Used when constructing sleeping tabs
   *   from persisted data where webContents doesn't exist.
   */
  putToSleep(knownPreSleepState?: PreSleepState): void {
    if (this.tab.asleep) return;

    // Capture pre-sleep state before anything changes
    if (knownPreSleepState) {
      // Use the explicitly provided state (e.g. from restoration data)
      this.preSleepState = knownPreSleepState;
    } else {
      this.tab.updateTabState(); // ensure state is fresh

      this.preSleepState = {
        url: this.tab.url,
        navHistory: [...this.tab.navHistory],
        navHistoryIndex: this.tab.navHistoryIndex
      };
    }

    this.tab.updateStateProperty("asleep", true);

    this.disconnectFullScreenListener();

    // Destroy the view and webContents to free resources
    this.tab.teardownView();
  }

  /**
   * Wakes a sleeping tab by recreating the WebContentsView and restoring
   * navigation history from the pre-sleep state snapshot.
   */
  wakeUp(): void {
    if (!this.tab.asleep) return;

    const window = this.tab.getWindow();

    // Recreate view, webContents, listeners, extensions
    this.tab.initializeView();

    // Add view to window's LayerManager
    this.tab.setWindow(window);

    // Re-setup fullscreen listeners on the new webContents
    this.setupFullScreenListeners(window);

    // Mark as awake
    this.tab.updateStateProperty("asleep", false);

    // Restore navigation history from pre-sleep state
    if (this.preSleepState) {
      this.tab.restoreNavigationHistory(this.preSleepState.navHistory, this.preSleepState.navHistoryIndex);
      this.preSleepState = null;
    }

    // Apply background color for the restored URL (the "updated" listener
    // won't fire because this.url was already set during sleep construction,
    // so updateTabState() sees no URL change).
    this.tab.applyUrlBackground();
  }

  // --- Fullscreen ---

  private clearExitCleanupTimers(): void {
    if (this.boundsNudgeTimer) {
      clearTimeout(this.boundsNudgeTimer);
      this.boundsNudgeTimer = null;
    }
    if (this.boundsRestoreTimer) {
      clearTimeout(this.boundsRestoreTimer);
      this.boundsRestoreTimer = null;
    }
    if (this.exitRetryTimer) {
      clearTimeout(this.exitRetryTimer);
      this.exitRetryTimer = null;
    }
  }

  private scheduleBoundsNudge(delayMs = 800): void {
    if (this.boundsNudgeTimer) {
      clearTimeout(this.boundsNudgeTimer);
      this.boundsNudgeTimer = null;
    }
    if (this.boundsRestoreTimer) {
      clearTimeout(this.boundsRestoreTimer);
      this.boundsRestoreTimer = null;
    }

    const view = this.tab.view;
    if (!view) return;

    this.boundsNudgeTimer = setTimeout(() => {
      this.boundsNudgeTimer = null;
      const isViewValid = () => !this.tab.fullScreen && this.tab.view === view && this.tab.visible;
      if (!isViewValid()) return;

      const bounds = view.getBounds();
      if (bounds.width <= 1) return;
      const newBounds = { ...bounds, width: bounds.width - 1 };
      view.setBounds(newBounds);

      this.boundsRestoreTimer = setTimeout(() => {
        this.boundsRestoreTimer = null;
        if (!isViewValid()) return;

        const currentBounds = view.getBounds();
        if (newBounds.width !== currentBounds.width) return;
        if (newBounds.height !== currentBounds.height) return;
        if (newBounds.x !== currentBounds.x) return;
        if (newBounds.y !== currentBounds.y) return;
        view.setBounds(bounds);
      }, 50);
    }, delayMs);
  }

  private async exitHtmlFullscreenInFrames(
    webContents: WebContents
  ): Promise<{ hadFullscreen: boolean; stillFullscreen: boolean }> {
    if (webContents.isDestroyed()) {
      return { hadFullscreen: false, stillFullscreen: false };
    }

    let hadFullscreen = false;
    let stillFullscreen = false;

    const frames = webContents.mainFrame ? webContents.mainFrame.framesInSubtree : [];
    for (const frame of frames) {
      if (frame.isDestroyed()) continue;
      try {
        const result = (await frame.executeJavaScript(
          `(() => {
            if (!document.fullscreenElement) return { had: false, still: false };
            try {
              const res = document.exitFullscreen();
              if (res && typeof res.then === "function") {
                return res.then(
                  () => ({ had: true, still: Boolean(document.fullscreenElement) }),
                  () => ({ had: true, still: Boolean(document.fullscreenElement) })
                );
              }
            } catch {
              return { had: true, still: Boolean(document.fullscreenElement) };
            }
            return { had: true, still: Boolean(document.fullscreenElement) };
          })()`,
          true
        )) as { had: boolean; still: boolean } | undefined;

        if (result?.had) hadFullscreen = true;
        if (result?.still) stillFullscreen = true;
      } catch {
        // Ignore destroyed/navigating frames during fullscreen teardown.
      }
    }

    return { hadFullscreen, stillFullscreen };
  }

  private exitHtmlFullscreenWithVerification(attempt = 0): void {
    if (this.exitRetryTimer) {
      clearTimeout(this.exitRetryTimer);
      this.exitRetryTimer = null;
    }

    const webContents = this.tab.webContents;
    if (this.tab.fullScreen || !webContents || webContents.isDestroyed()) return;

    void this.exitHtmlFullscreenInFrames(webContents).then(({ hadFullscreen, stillFullscreen }) => {
      if (this.tab.fullScreen || this.tab.webContents !== webContents || webContents.isDestroyed()) return;

      if (hadFullscreen && !stillFullscreen) {
        this.scheduleBoundsNudge(150);
      }

      if (stillFullscreen && attempt < 3) {
        const delays = [150, 400, 850];
        this.exitRetryTimer = setTimeout(() => {
          this.exitRetryTimer = null;
          this.exitHtmlFullscreenWithVerification(attempt + 1);
        }, delays[attempt] ?? 850);
      }
    });
  }

  /**
   * Ensures a visible non-fullscreen tab does not remain stuck with an active HTML
   * fullscreen element (e.g. if exitFullscreen ran while the view was hidden or mid-transition).
   */
  public ensureExitedHtmlFullscreenIfNeeded(): void {
    if (!this.tab.fullScreen) {
      this.exitHtmlFullscreenWithVerification();
    }
  }

  /**
   * Enters or exits fullscreen for this tab.
   * Coordinates with the Electron BrowserWindow fullscreen state.
   */
  setFullScreen(isFullScreen: boolean): boolean {
    const updated = this.tab.updateStateProperty("fullScreen", isFullScreen);
    const window = this.tab.getWindow();
    const electronWindow = window.browserWindow;

    if (isFullScreen) {
      this.clearExitCleanupTimers();
      this.exitOsAfterEnter = false;
      if (!updated) return false;
      if (window.destroyed) return false;

      if (!electronWindow.fullScreen) {
        this.isEnteringOsFullScreen = true;
        electronWindow.setFullScreen(true);
      }

      // Notify the tab so layout can be updated
      this.tab.emit("fullscreen-changed", true);
      return true;
    }

    // Always clean up OS transition / HTML fullscreen even if `tab.fullScreen` was already `false`,
    // otherwise exiting OS fullscreen after an early state reset leaves `document.fullscreenElement`
    // expanded inside the non-fullscreen WebContentsView.
    if (!window.destroyed) {
      if (this.isEnteringOsFullScreen) {
        this.exitOsAfterEnter = true;
      } else if (electronWindow.fullScreen) {
        electronWindow.setFullScreen(false);
      }
    }

    this.exitHtmlFullscreenWithVerification();

    if (!updated) return false;

    this.scheduleBoundsNudge(800);

    // Notify the tab so layout can be updated
    this.tab.emit("fullscreen-changed", false);

    return true;
  }

  /**
   * Binds OS window fullscreen listeners to the tab's current BrowserWindow.
   * Call on setup and whenever a tab moves to another window.
   */
  bindWindowFullScreenListeners(window: BrowserWindow): void {
    this.disconnectFullScreenListener();

    this.disconnectEnterFullScreen = window.connect("enter-full-screen", () => {
      this.isEnteringOsFullScreen = false;
      if (this.exitOsAfterEnter && !this.tab.fullScreen && !window.destroyed) {
        this.exitOsAfterEnter = false;
        if (window.browserWindow.fullScreen) {
          window.browserWindow.setFullScreen(false);
        }
      }
    });

    this.disconnectLeaveFullScreen = window.connect("leave-full-screen", () => {
      this.isEnteringOsFullScreen = false;
      this.exitOsAfterEnter = false;
      this.setFullScreen(false);
    });
  }

  /**
   * Sets up fullscreen event listeners on the tab's webContents and window.
   * Idempotent: disconnects previous listeners before registering new ones.
   * Called during tab initialization and on wake from sleep.
   */
  setupFullScreenListeners(window: BrowserWindow): void {
    const webContents = this.tab.webContents;
    if (!webContents) return;

    webContents.on("enter-html-full-screen", () => {
      this.setFullScreen(true);
    });

    webContents.on("leave-html-full-screen", () => {
      // Always update tab fullscreen state directly. Don't rely solely on
      // the indirect chain (electronWindow.setFullScreen(false) -> window
      // "leave-full-screen" event) because if the OS window is already not
      // fullscreen, that event never fires and the tab stays stuck.
      this.setFullScreen(false);
    });

    this.bindWindowFullScreenListeners(window);
  }

  private disconnectFullScreenListener(): void {
    if (this.disconnectEnterFullScreen) {
      this.disconnectEnterFullScreen();
      this.disconnectEnterFullScreen = null;
    }
    if (this.disconnectLeaveFullScreen) {
      this.disconnectLeaveFullScreen();
      this.disconnectLeaveFullScreen = null;
    }
  }

  // --- Picture-in-Picture ---

  /**
   * Attempts to exit picture-in-picture mode for this tab.
   * Used when a tab becomes visible again.
   */
  async exitPictureInPicture(): Promise<boolean> {
    const webContents = this.tab.webContents;
    if (!webContents) return false;

    // This function runs in the renderer context
    const exitPiP = function () {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
        return true;
      }
      return false;
    };

    try {
      const result = await webContents.executeJavaScript(`(${exitPiP})()`, true);
      if (result === true) {
        this.tab.updateStateProperty("isPictureInPicture", false);
        return true;
      }
    } catch (err) {
      console.error("PiP exit error:", err);
    }
    return false;
  }

  /**
   * Attempts to enter picture-in-picture mode for this tab.
   * Used when a tab becomes hidden but has playing video.
   */
  async enterPictureInPicture(): Promise<boolean> {
    const webContents = this.tab.webContents;
    if (!webContents) return false;

    // This function runs in the renderer context
    const enterPiP = async function () {
      const videos = Array.from(document.querySelectorAll("video")).filter(
        (video) => !video.paused && !video.ended && video.readyState > 2
      );

      if (videos.length > 0 && document.pictureInPictureElement !== videos[0]) {
        try {
          const video = videos[0];
          await video.requestPictureInPicture();

          const onLeavePiP = () => {
            setTimeout(() => {
              const goBackToTab = !video.paused && !video.ended;
              lumi.tabs.disablePictureInPicture(goBackToTab);
            }, 50);
            video.removeEventListener("leavepictureinpicture", onLeavePiP);
          };

          video.addEventListener("leavepictureinpicture", onLeavePiP);
          return true;
        } catch (e) {
          console.error("Failed to enter Picture in Picture mode:", e);
          return false;
        }
      }
      return null;
    };

    try {
      const result = await webContents.executeJavaScript(`(${enterPiP})()`, true);
      if (result === true) {
        this.tab.updateStateProperty("isPictureInPicture", true);
        return true;
      }
    } catch (err) {
      console.error("PiP enter error:", err);
    }
    return false;
  }

  // --- Cleanup ---

  /**
   * Called when the tab is being destroyed.
   * Handles cleanup of fullscreen state if needed.
   */
  onDestroy(): void {
    this.clearExitCleanupTimers();
    this.isEnteringOsFullScreen = false;
    this.exitOsAfterEnter = false;

    const window = this.tab.getWindow();
    if (!window.isEmitterDestroyed()) {
      this.disconnectFullScreenListener();
    } else {
      this.disconnectEnterFullScreen = null;
      this.disconnectLeaveFullScreen = null;
    }

    if (this.tab.fullScreen && !window.destroyed) {
      window.browserWindow.setFullScreen(false);
    }
  }
}
