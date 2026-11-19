import { signAppWithVMP } from "./components/castlabs-evs.js";
import { createNotarizationApiKeyFile } from "./components/notarization.js";
import { copyAssetsCar } from "./components/macos.js";
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
