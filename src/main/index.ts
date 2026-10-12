import { debugPrint } from "@/modules/output";
import { app } from "electron";

// Set application name early so all native dialogs, dock, and menus show Lumi
app.name = "Lumi";
app.setName("Lumi");

function printHeader() {
  console.log("\x1b[34m%s\x1b[0m", "--- Lumi Browser ---");

  if (app.isPackaged) {
    console.log("\x1b[32m%s\x1b[0m", `Production Build (${app.getVersion()})`);
  } else {
    console.log("\x1b[31m%s\x1b[0m", `Development Build (${app.getVersion()})`);
  }

  console.log("");
}

function initializeApp() {
  const gotTheLock = app.requestSingleInstanceLock();
  debugPrint("INITIALIZATION", "gotTheLock", gotTheLock);

  if (!gotTheLock) {
    return false;
  }

  // Disable FedCM (Google One Tap, which doesn't work as the native prompt never shows in Electron)
  app.commandLine.appendSwitch("--disable-features", "FedCm");

  // Print header
  printHeader();

  // Import everything
  import("@/browser").catch((err) => {
    console.error("FATAL ERROR IN import('@/browser'):", err);
  });

  return true;
}

// Start the application
const initialized = initializeApp();
if (!initialized) {
  app.quit();
}
