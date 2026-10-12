import { app, BrowserWindow } from "electron";
import { handleOpenUrl } from "@/app/urls";
import { hasCompletedOnboarding } from "@/saving/onboarding";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";

export function setupAppLifecycle() {
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
      return;
    }

    hasCompletedOnboarding().then((completed) => {
      if (!completed) {
        app.quit();
      }
    });
  });

  app.whenReady().then(() => {
    app.on("activate", async () => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length === 0) {
        const completed = await hasCompletedOnboarding();
        if (completed) {
          browserWindowsController.create();
        }
      } else {
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.show();
            win.focus();
          }
        }
      }
    });
  });

  app.on("open-url", async (_event, url) => {
    handleOpenUrl(false, url);
  });

  app.on("continue-activity", (_event, type, _userInfo, details) => {
    if (type === "NSUserActivityTypeBrowsingWeb" && details.webpageURL) {
      handleOpenUrl(false, details.webpageURL);
    }
  });
}
