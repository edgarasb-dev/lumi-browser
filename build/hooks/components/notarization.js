import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

let createdApiKeyPath = null;
let exitCleanupRegistered = false;

function cleanupCreatedKeySync() {
  if (!createdApiKeyPath) return;
  try {
    fsSync.rmSync(createdApiKeyPath, { force: true });
  } catch {
    // ignore cleanup failures on process exit
  }
  if (process.env["APPLE_API_KEY"] === createdApiKeyPath) {
    delete process.env["APPLE_API_KEY"];
  }
  createdApiKeyPath = null;
}

/** @type {() => Promise<void>} */
async function createNotarizationApiKeyFile() {
  console.log("\nCreating notarization API key file");

  const apiKey = process.env["APPLE_API_KEY_DATA"];
  if (apiKey) {
    console.log("API key found");

    const tempDir = os.tmpdir();
    const randomStr = crypto.randomBytes(8).toString("hex");
    const fileName = `notarization_auth_key_${randomStr}.p8`;
    const tempFilePath = path.join(tempDir, fileName);

    await fs.writeFile(tempFilePath, apiKey, { mode: 0o600 });

    createdApiKeyPath = tempFilePath;
    process.env["APPLE_API_KEY"] = tempFilePath;
    if (!exitCleanupRegistered) {
      exitCleanupRegistered = true;
      process.once("exit", cleanupCreatedKeySync);
    }
    console.log(`\nAPI key file created at ${tempFilePath}`);
  } else {
    console.log("No API key found");
  }
}

/** @type {() => Promise<void>} */
async function cleanupNotarizationApiKeyFile() {
  if (!createdApiKeyPath) return;
  const targetPath = createdApiKeyPath;
  createdApiKeyPath = null;
  if (process.env["APPLE_API_KEY"] === targetPath) {
    delete process.env["APPLE_API_KEY"];
  }
  await fs.rm(targetPath, { force: true }).catch(() => {});
}

export { createNotarizationApiKeyFile, cleanupNotarizationApiKeyFile };
