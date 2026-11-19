import { windowsController } from "@/controllers/windows-controller";
import { debugError, debugPrint } from "@/modules/output";
import { PATHS } from "@/modules/paths";
import { app, nativeImage, type NativeImage } from "electron";
import fs from "fs";
import path from "path";

let defaultLinuxIcon: NativeImage | null = null;

function applyLinuxIconToAllWindows(): void {
  if (!defaultLinuxIcon) return;
  const windows = windowsController.getAllWindows();
  for (const window of windows) {
    if (!window.destroyed && !window.browserWindow.isDestroyed()) {
      window.browserWindow.setIcon(defaultLinuxIcon);
    }
  }
}

/**
 * Sets the default Lumi Browser window icon on Linux using `assets/public/icons/default.png`.
 * macOS uses the native Liquid Glass `Assets.car` icon, and Windows uses the embedded EXE icon.
 */
export function setupLinuxWindowIcons(): void {
  if (process.platform !== "linux") return;

  const iconPath = path.join(PATHS.ASSETS, "public", "icons", "default.png");
  if (!fs.existsSync(iconPath)) {
    debugError("ICONS", `Default Linux icon not found: ${iconPath}`);
    return;
  }

  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    debugError("ICONS", `Failed to load default Linux icon from: ${iconPath}`);
    return;
  }

  defaultLinuxIcon = image;
  debugPrint("ICONS", "Loaded default Linux window icon:", iconPath);

  void app.whenReady().then(() => {
    applyLinuxIconToAllWindows();
  });

  windowsController.on("window-added", () => {
    applyLinuxIconToAllWindows();
  });
}
