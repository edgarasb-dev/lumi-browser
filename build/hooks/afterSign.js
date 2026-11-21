import { signAppWithVMP } from "./components/castlabs-evs.js";
import { cleanupNotarizationApiKeyFile } from "./components/notarization.js";

const vmpSignPlatforms = ["win32"];

/** @type {(context: import("./types.js").PackContext) => void} */
export async function handler(context) {
  // Header
  console.log("\n---------");
  console.log("Executing afterSign hook");

  // Windows needs to VMP-sign the app after signing it with Windows
  if (vmpSignPlatforms.includes(process.platform) && process.env.SKIP_VMP !== "true") {
    await signAppWithVMP(context.appOutDir)
      .then(() => true)
      .catch(() => false);
  }

  // Remove any temporary notarization API key written in afterPack once macOS signing & notarization finish
  if (process.platform === "darwin") {
    await cleanupNotarizationApiKeyFile().catch(() => {});
  }

  // Footer
  console.log("---------\n");
}

export default handler;
