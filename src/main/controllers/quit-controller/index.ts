// This controller executes quit handlers before letting the app quit.

import { app } from "electron";
import { canQuit } from "./handlers/can-quit";
import { beforeQuit } from "./handlers/before-quit";

type BeforeQuitHandlerState = "idle" | "running" | "completed";

class QuitController {
  public beforeQuitHandlerState: BeforeQuitHandlerState;
  private beforeQuitPrepCallbacks: Array<() => void | Promise<void>> = [];
  private inFlightBeforeQuit: Promise<boolean> | null = null;

  constructor() {
    this.beforeQuitHandlerState = "idle";
    this._handleBeforeQuit();
  }

  /**
   * Returns true if the app is in the process of quitting.
   * Used to prevent tabs from being added to "recently closed" during quit.
   */
  get isQuitting(): boolean {
    return this.beforeQuitHandlerState !== "idle";
  }

  public registerBeforeQuitPrep(callback: () => void | Promise<void>): void {
    this.beforeQuitPrepCallbacks.push(callback);
  }

  private async runBeforeQuitPreps(): Promise<void> {
    for (const callback of this.beforeQuitPrepCallbacks) {
      try {
        await callback();
      } catch (err) {
        console.error("[QuitController] Pre-quit prep callback failed:", err);
      }
    }
  }

  private runBeforeQuitOnce(): Promise<boolean> {
    if (this.beforeQuitHandlerState === "completed") {
      return Promise.resolve(true);
    }
    if (this.inFlightBeforeQuit) {
      return this.inFlightBeforeQuit;
    }

    this.beforeQuitHandlerState = "running";
    this.inFlightBeforeQuit = (async () => {
      try {
        await this.runBeforeQuitPreps();
        const result = await beforeQuit();
        if (result) {
          this.beforeQuitHandlerState = "completed";
          return true;
        }
        this.beforeQuitHandlerState = "idle";
        return false;
      } catch (err) {
        console.error("[QuitController] beforeQuit failed:", err);
        this.beforeQuitHandlerState = "completed";
        return true;
      } finally {
        this.inFlightBeforeQuit = null;
      }
    })();

    return this.inFlightBeforeQuit;
  }

  /**
   * Synchronously enters quitting mode, snapshots and flushes all open tabs/sessions
   * plus SQLite WAL before triggering updater restart (`app.quit` / `quitAndInstall`),
   * and marks quit prep completed so `before-quit` lets the updater exit immediately.
   */
  public async prepareForUpdateRestart(): Promise<boolean> {
    return this.runBeforeQuitOnce();
  }

  private _handleBeforeQuit() {
    app.on("before-quit", (event) => {
      if (this.beforeQuitHandlerState === "completed") {
        // Let the app quit normally
        return;
      }

      // Prevent the app from quitting if the handler is not completed
      event.preventDefault();

      // If the handler is idle and the app can quit, run it
      if (this.beforeQuitHandlerState === "idle" && canQuit()) {
        void this.runBeforeQuitOnce().then((result) => {
          if (result) {
            app.quit();
          }
        });
      }
    });
  }
}

export const quitController = new QuitController();
