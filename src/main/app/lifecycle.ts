import { app } from "electron";
import { handleOpenUrl } from "@/app/urls";
import { hasCompletedOnboarding } from "@/saving/onboarding";
import { windowsController } from "@/controllers/windows-controller";
import { openBrowserWindowOnActivate } from "@/saving/tabs/pinned-session";

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
      const activated = windowsController.activateWindows();
      if (!activated) {
        const completed = await hasCompletedOnboarding();
        if (completed) {
          await openBrowserWindowOnActivate();
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
