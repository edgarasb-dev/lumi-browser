import { signAppWithVMP } from "./components/castlabs-evs.js";
import { createNotarizationApiKeyFile } from "./components/notarization.js";
import { copyAssetsCar } from "./components/macos.js";
import { compileDockTilePlugin } from "./components/dock-tile-plugin.js";
import fs from "fs";
import path from "path";
import childProcess from "child_process";

const vmpSignPlatforms = ["darwin"];

/** @type {(context: import("./types.js").PackContext) => void} */
export async function handler(context) {
  // Header
  console.log("\n---------");
  console.log("Executing afterPack hook");

  // Clear macOS extended attributes to prevent codesign failure
  if (process.platform === "darwin") {
    try {
      childProcess.execSync(`xattr -cr "${context.appOutDir}"`);
    } catch {
      // Ignore xattr errors
    }
  }

  // macOS needs to add the Assets.car containing the Liquid Glass icon
  if (process.platform === "darwin") {
    await copyAssetsCar(context.appOutDir)
      .then(() => true)
      .catch(() => false);
  }

  // macOS needs to compile and embed the NSDockTilePlugIn for persistent icons
  if (process.platform === "darwin") {
    await compileDockTilePlugin(context.appOutDir)
      .then(() => true)
      .catch(() => false);
  }

  // macOS needs to VMP-sign the app before signing it with Apple
  if (vmpSignPlatforms.includes(process.platform)) {
    await signAppWithVMP(context.appOutDir)
      .then(() => true)
      .catch(() => false);
  }

  // macOS needs to notarize the app with a path to APPLE_API_KEY
  if (process.platform === "darwin") {
    await createNotarizationApiKeyFile()
      .then(() => true)
      .catch(() => false);
  }

  // Non-macOS builds: strip the macOS-specific icon PNGs to reduce file size.
  // The macos-icons directory is only useful on darwin; remove its contents for
  // Windows and Linux targets.
  if (context.electronPlatformName !== "darwin") {
    const macosIconsDir = path.join(
      context.appOutDir,
      "resources",
      "app.asar.unpacked",
      "assets",
      "public",
      "macos-icons"
    );
    if (fs.existsSync(macosIconsDir)) {
      for (const file of fs.readdirSync(macosIconsDir)) {
        if (file.endsWith(".png")) {
          fs.unlinkSync(path.join(macosIconsDir, file));
        }
      }
      console.log("Removed macOS-specific icons from non-macOS build.");
    }
  }

  // Strip extended attributes (FinderInfo, resource forks) to satisfy codesign
  if (process.platform === "darwin") {
    try {
      childProcess.execSync(`xattr -cr "${context.appOutDir}"`);
    } catch {
      // Ignored if xattr is unavailable or fails on non-essential metadata
    }

    // When building without a commercial Apple certificate, ad-hoc sign the bundle
    // with clean entitlements so macOS marks it valid and seals all resources.
    if (!process.env.CSC_LINK && !process.env.CSC_NAME) {
      try {
        const appContents = fs.readdirSync(context.appOutDir);
        const appName = appContents.find((item) => item.endsWith(".app"));
        if (appName) {
          const appPath = path.join(context.appOutDir, appName);
          const entitlementsPath = path.join(process.cwd(), "build", "entitlements.mac.plist");
          console.log(`Ad-hoc signing ${appName} with entitlements...`);
          childProcess.execSync(`codesign --force --deep --sign - --entitlements "${entitlementsPath}" "${appPath}"`);
          console.log(`Successfully ad-hoc signed ${appName}`);
        }
      } catch (err) {
        console.error("Ad-hoc codesign failed:", err);
      }
    }
  }

  // Footer
  console.log("---------\n");
}

export default handler;
