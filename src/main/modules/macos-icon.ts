/**
 * macOS Liquid Glass icon synchronization.
 *
 * Packaged builds render the native Liquid Glass icon from `Assets.car` (`AppIcon`).
 * In development builds (running inside unbundled Electron.app), this keeps the
 * Dock icon synchronized with macOS Light / Dark appearance.
 */

import { app, nativeTheme } from "electron";
import fs from "fs";
import path from "path";
import { NobjcLibrary, NobjcObject } from "objc-js";
import { debugError, debugPrint } from "@/modules/output";
import { LUMI_DATA_DIR } from "@/modules/paths";

let AppKit: NobjcLibrary | null = null;
let Foundation: NobjcLibrary | null = null;
let NSApplication: NobjcObject | null = null;
let NSWorkspace: NobjcObject | null = null;
let NSString: NobjcObject | null = null;

if (process.platform === "darwin") {
  try {
    AppKit = new NobjcLibrary("/System/Library/Frameworks/AppKit.framework/AppKit");
    Foundation = new NobjcLibrary("/System/Library/Frameworks/Foundation.framework/Foundation");
    NSApplication = AppKit.NSApplication ?? null;
    NSWorkspace = AppKit.NSWorkspace ?? null;
    NSString = Foundation.NSString ?? null;
  } catch (err) {
    debugError("ICONS", "macOS: failed to initialize objc-js libraries:", err);
  }
}

function getAppBundlePath(): string | null {
  let current = app.getAppPath();
  while (current !== "/" && current !== ".") {
    if (current.endsWith(".app")) {
      return current;
    }
    current = path.dirname(current);
  }
  return null;
}

function resetDockIconToDefault(): void {
  if (!NSApplication) return;
  try {
    const sharedApp = NSApplication.sharedApplication();
    const dockTile = sharedApp.dockTile();
    dockTile.setContentView$(null);
    dockTile.display();
    sharedApp.setApplicationIconImage$(null);
    debugPrint("ICONS", "macOS: reset Dock icon to default Liquid Glass bundle icon");
  } catch (err) {
    debugError("ICONS", "macOS: resetDockIconToDefault failed:", err);
  }
}

function cleanupLegacyCustomIconState(): void {
  const legacySharedFile = path.join(LUMI_DATA_DIR, "dock-tile-icon-path");
  const legacyIconsDir = path.join(LUMI_DATA_DIR, "icons");
  const hasLegacyFiles = fs.existsSync(legacySharedFile) || fs.existsSync(legacyIconsDir);
  if (!hasLegacyFiles) return;

  try {
    if (fs.existsSync(legacySharedFile)) {
      fs.unlinkSync(legacySharedFile);
    }
    if (fs.existsSync(legacyIconsDir)) {
      fs.rmSync(legacyIconsDir, { recursive: true, force: true });
    }
  } catch (err) {
    debugError("ICONS", "macOS: failed cleaning up legacy icon files:", err);
  }

  const bundlePath = getAppBundlePath();
  if (bundlePath && NSWorkspace && NSString) {
    try {
      const bundleNSPath = NSString.stringWithUTF8String$(bundlePath);
      if (bundleNSPath) {
        NSWorkspace.sharedWorkspace().setIcon$forFile$options$(null, bundleNSPath, 0);
        debugPrint("ICONS", "macOS: cleared legacy custom Finder icon on bundle");
      }
    } catch (err) {
      debugError("ICONS", "macOS: clearFinderIcon failed:", err);
    }
  }
}

/**
 * Synchronizes the macOS Dock icon with the current system appearance (Light / Dark).
 * In packaged builds, clears any custom overrides so macOS renders the native `Assets.car` Liquid Glass icon.
 * In development builds, applies the dynamic Light or Dark icon according to `nativeTheme`.
 */
export function syncLiquidGlassAppearance(): void {
  try {
    if (app.isPackaged) {
      cleanupLegacyCustomIconState();
      resetDockIconToDefault();
      return;
    }

    const iconName = nativeTheme.shouldUseDarkColors ? "icon_dark.png" : "icon_light.png";
    const appPath = app.getAppPath();
    const candidatePaths = [
      path.join(appPath, "build", iconName),
      path.join(appPath, "build", "icon.png"),
      path.join(process.cwd(), "build", iconName),
      path.join(process.cwd(), "build", "icon.png")
    ];
    const iconFile = candidatePaths.find((p) => fs.existsSync(p));

    if (iconFile && app.dock) {
      app.dock.setIcon(iconFile);
      debugPrint("ICONS", "macOS: set app.dock.setIcon to", iconFile);
    }
  } catch (err) {
    debugError("ICONS", "macOS: syncLiquidGlassAppearance failed:", err);
  }
}
