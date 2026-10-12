import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export function patchElectronDevApp(): void {
  if (process.platform !== "darwin") {
    return;
  }

  const appDir = path.resolve("node_modules/electron/dist/Electron.app");
  if (!fs.existsSync(appDir)) {
    return;
  }

  const iconSrc = path.resolve("build/icon.icns");
  const iconDest = path.join(appDir, "Contents/Resources/electron.icns");
  if (fs.existsSync(iconSrc)) {
    try {
      fs.copyFileSync(iconSrc, iconDest);
    } catch {
      // Ignore copy error
    }
  }

  const infoPlistPath = path.join(appDir, "Contents/Info.plist");
  if (fs.existsSync(infoPlistPath)) {
    try {
      let plist = fs.readFileSync(infoPlistPath, "utf-8");
      plist = plist.replace(
        /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
        "<key>CFBundleDisplayName</key>\n\t<string>Lumi</string>"
      );
      plist = plist.replace(
        /<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/,
        "<key>CFBundleName</key>\n\t<string>Lumi</string>"
      );
      fs.writeFileSync(infoPlistPath, plist, "utf-8");
    } catch {
      // Ignore plist update error
    }
  }

  try {
    execSync(`xattr -cr "${appDir}"`, { stdio: "ignore" });
    execSync(`codesign --force --deep --sign - "${appDir}"`, { stdio: "ignore" });
    execSync(`touch "${appDir}"`, { stdio: "ignore" });
  } catch {
    // Ignore codesign errors
  }
}

if (import.meta.main) {
  patchElectronDevApp();
  console.log("Patched Electron dev app with Lumi identity.");
}
