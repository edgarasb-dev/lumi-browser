/**
 * macOS-specific icon helpers using objc-js + objcjs-types.
 *
 * Handles persistent icon changes across Dock, Finder, Spotlight, and Launchpad
 * using native macOS APIs — following the approach documented by Granola:
 * https://www.granola.ai/blog/so-you-think-its-easy-to-change-an-app-icon
 */

import { app, nativeTheme } from "electron";
import path from "path";
import fs from "fs";
import { debugError, debugPrint } from "@/modules/output";
import { LUMI_DATA_DIR } from "@/modules/paths";
import { NobjcLibrary, NobjcObject, callFunction } from "objc-js";

// Lazily initialize Objective-C frameworks to prevent issues on non-macOS or during testing
let AppKit: NobjcLibrary | null = null;
let Foundation: NobjcLibrary | null = null;
let NSApplication: NobjcObject | null = null;
let NSImage: NobjcObject | null = null;
let NSImageView: NobjcObject | null = null;
let NSWorkspace: NobjcObject | null = null;
let NSDistributedNotificationCenter: NobjcObject | null = null;
let NSString: NobjcObject | null = null;

if (process.platform === "darwin") {
  try {
    AppKit = new NobjcLibrary("/System/Library/Frameworks/AppKit.framework/AppKit");
    Foundation = new NobjcLibrary("/System/Library/Frameworks/Foundation.framework/Foundation");
    NSApplication = AppKit.NSApplication ?? null;
    NSImage = AppKit.NSImage ?? null;
    NSImageView = AppKit.NSImageView ?? null;
    NSWorkspace = AppKit.NSWorkspace ?? null;
    NSDistributedNotificationCenter = Foundation.NSDistributedNotificationCenter ?? null;
    NSString = Foundation.NSString ?? null;
  } catch (err) {
    debugError("ICONS", "macOS: failed to initialize objc-js libraries:", err);
  }
}

function NSStringFromString(str: string): NobjcObject {
  if (!NSString) {
    throw new Error("NSString unavailable (not on macOS or objc-js not loaded)");
  }
  const nsString = NSString.stringWithUTF8String$(str);
  if (!nsString) {
    throw new Error(`Failed to create NSString from string: ${str}`);
  }
  return nsString;
}

function NSClassFromString(aClassName: NobjcObject): NobjcObject | null {
  return callFunction("NSClassFromString", { returns: "#" }, aClassName) as NobjcObject | null;
}

// ---------------------------------------------------------------------------
// Shared-file path for DockTilePlugin communication
// ---------------------------------------------------------------------------

const SHARED_DIR = LUMI_DATA_DIR;
const SHARED_FILE = path.join(SHARED_DIR, "dock-tile-icon-path");
const DOCK_TILE_UPDATE_NOTIFICATIONS = ["dev.lumi.browser.dock-tile.update"];

// ---------------------------------------------------------------------------
// App-bundle path resolution
// ---------------------------------------------------------------------------

/**
 * Walk up from `app.getAppPath()` to the nearest `.app` directory.
 * Returns `null` in dev mode (no `.app` wrapper).
 */
export function getAppBundlePath(): string | null {
  let current = app.getAppPath();
  while (current !== "/" && current !== ".") {
    if (current.endsWith(".app")) {
      return current;
    }
    current = path.dirname(current);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Finder / Spotlight / Launchpad icon
// ---------------------------------------------------------------------------

/**
 * Set a custom icon on the `.app` bundle so Finder, Spotlight, and Launchpad
 * display it.
 */
export function setFinderIcon(pngPath: string, appBundlePath: string): boolean {
  if (!NSImage || !NSWorkspace) {
    debugError("ICONS", "macOS: NSImage or NSWorkspace unavailable");
    return false;
  }

  try {
    const nsPath = NSStringFromString(pngPath);

    const image = NSImage.alloc().initWithContentsOfFile$(nsPath);
    if (!image) {
      debugError("ICONS", "macOS: failed to load NSImage from", pngPath);
      return false;
    }

    const bundleNSPath = NSStringFromString(appBundlePath);

    const ok = NSWorkspace.sharedWorkspace().setIcon$forFile$options$(image, bundleNSPath, 0);
    debugPrint("ICONS", `macOS: setIcon on bundle → ${ok}`);
    return !!ok;
  } catch (err) {
    debugError("ICONS", "macOS: setFinderIcon failed:", err);
    return false;
  }
}

/**
 * Clear the custom icon from the `.app` bundle so macOS falls back to the
 * native Liquid Glass icon in `Assets.car`.
 */
export function clearFinderIcon(appBundlePath: string): boolean {
  if (!NSWorkspace) {
    debugError("ICONS", "macOS: NSWorkspace unavailable");
    return false;
  }

  try {
    const bundleNSPath = NSStringFromString(appBundlePath);
    const ok = NSWorkspace.sharedWorkspace().setIcon$forFile$options$(null, bundleNSPath, 0);
    debugPrint("ICONS", `macOS: clearFinderIcon on bundle → ${ok}`);
    return !!ok;
  } catch (err) {
    debugError("ICONS", "macOS: clearFinderIcon failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Running Dock icon (via NSApplication)
// ---------------------------------------------------------------------------

/**
 * Set the running app's Dock tile to a custom image.
 */
export function setDockIcon(pngPath: string): boolean {
  if (!NSImage || !NSApplication || !NSImageView) {
    debugError("ICONS", "macOS: AppKit classes unavailable");
    return false;
  }

  try {
    const nsPath = NSStringFromString(pngPath);

    const image = NSImage.alloc().initWithContentsOfFile$(nsPath);
    if (!image) {
      debugError("ICONS", "macOS: failed to load NSImage for dock icon from", pngPath);
      return false;
    }

    const dockTile = NSApplication.sharedApplication().dockTile();

    // Set the dock tile's content view for crisp rendering
    const imageView = NSImageView.imageViewWithImage$(image);

    dockTile.setContentView$(imageView);

    dockTile.display();

    debugPrint("ICONS", "macOS: dock icon set via NSApplication");
    return true;
  } catch (err) {
    debugError("ICONS", "macOS: setDockIcon failed:", err);
    return false;
  }
}

/**
 * Reset the running Dock icon to the default bundle icon (Liquid Glass).
 * This clears the content view and reloads the icon from bundle resources.
 */
export function resetDockIconToDefault(): boolean {
  if (!NSApplication) {
    debugError("ICONS", "macOS: NSApplication unavailable");
    return false;
  }

  try {
    const dockTile = NSApplication.sharedApplication().dockTile();

    // For reset, we can't easily animate since we're removing the view
    // The bundle icon will appear immediately after clearing

    // Clear the dock tile content view so the bundle icon renders
    dockTile.setContentView$(null);

    dockTile.display();

    // Also clear the application icon image to force reload from bundle
    NSApplication.sharedApplication().setApplicationIconImage$(null);

    debugPrint("ICONS", "macOS: resetDockIconToDefault complete");
    return true;
  } catch (err) {
    debugError("ICONS", "macOS: resetDockIconToDefault failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dock cache invalidation (private SkyLight API)
// ---------------------------------------------------------------------------

/**
 * Force the Dock to flush its icon cache using the private
 * `SLSIconAppearanceConfiguration` API. This avoids `killall Dock`.
 *
 * Accessed via `NSClassFromString` since it's in the private SkyLight framework.
 */
export function invalidateDockCache(): boolean {
  try {
    const clsName = NSStringFromString("SLSIconAppearanceConfiguration");
    const cls = NSClassFromString(clsName);
    if (!cls) {
      debugPrint("ICONS", "macOS: SLSIconAppearanceConfiguration not available — skipping cache invalidation");
      return false;
    }

    const config = cls.fetchCurrentIconAppearanceConfiguration();
    if (!config) {
      debugPrint("ICONS", "macOS: fetchCurrentIconAppearanceConfiguration returned nil");
      return false;
    }

    config.save();
    debugPrint("ICONS", "macOS: Dock cache invalidated via SLSIconAppearanceConfiguration");
    return true;
  } catch (err) {
    debugError("ICONS", "macOS: invalidateDockCache failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shared file (DockTilePlugin communication)
// ---------------------------------------------------------------------------

/**
 * Write (or clear) the icon path that the NSDockTilePlugIn reads.
 *
 * - `iconPath` = absolute path to a PNG → plugin shows that icon
 * - `iconPath` = null → plugin shows default (Liquid Glass)
 */
export function writeIconChoiceToSharedFile(iconPath: string | null): void {
  try {
    fs.mkdirSync(SHARED_DIR, { recursive: true });

    if (iconPath) {
      fs.writeFileSync(SHARED_FILE, iconPath, "utf-8");
      debugPrint("ICONS", "macOS: wrote shared file →", iconPath);
    } else {
      // Empty file = default icon
      if (fs.existsSync(SHARED_FILE)) {
        fs.unlinkSync(SHARED_FILE);
      }
      debugPrint("ICONS", "macOS: cleared shared file");
    }
  } catch (err) {
    debugError("ICONS", "macOS: writeIconChoiceToSharedFile failed:", err);
  }
}

/**
 * Ask the DockTile plugin to reload the shared icon state immediately.
 */
export function notifyDockTilePluginUpdate(): void {
  if (!NSDistributedNotificationCenter) {
    debugError("ICONS", "macOS: NSDistributedNotificationCenter unavailable");
    return;
  }

  try {
    for (const name of DOCK_TILE_UPDATE_NOTIFICATIONS) {
      NSDistributedNotificationCenter.defaultCenter().postNotificationName$object$userInfo$deliverImmediately$(
        NSStringFromString(name),
        null,
        null,
        true
      );
    }
    debugPrint("ICONS", "macOS: posted Dock tile update notification");
  } catch (err) {
    debugError("ICONS", "macOS: failed to post Dock tile update notification:", err);
  }
}

/**
 * Synchronize macOS Dock icon with the current system appearance (Light / Dark).
 * In packaged builds, clears custom overrides so macOS renders the native Assets.car Liquid Glass icon.
 * In development builds, applies the dynamic Light or Dark icon according to nativeTheme.
 */
export function syncLiquidGlassAppearance(): void {
  try {
    if (app.isPackaged) {
      resetDockIconToDefault();
      return;
    }

    // In dev mode, check nativeTheme.shouldUseDarkColors
    const iconName = nativeTheme.shouldUseDarkColors ? "icon_dark.png" : "icon_light.png";
    const appPath = app.getAppPath();
    const candidatePaths = [
      path.join(appPath, "build", iconName),
      path.join(appPath, "build", "icon.png"),
      path.join(process.cwd(), "build", iconName),
      path.join(process.cwd(), "build", "icon.png")
    ];
    const iconFile = candidatePaths.find((p) => fs.existsSync(p));

    if (iconFile) {
      if (app.dock) {
        app.dock.setIcon(iconFile);
        debugPrint("ICONS", "macOS: set app.dock.setIcon to", iconFile);
      }
    }
  } catch (err) {
    debugError("ICONS", "macOS: syncLiquidGlassAppearance failed:", err);
  }
}
