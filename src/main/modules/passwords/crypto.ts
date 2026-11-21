import { safeStorage } from "electron";

const FORMAT_SAFE_STORAGE = 0x01;

export class PasswordEncryptionUnavailableError extends Error {
  constructor(
    message = "OS Keychain / Keyring encryption is unavailable. Lumi refuses to store plaintext passwords; unlock your OS keyring and try again."
  ) {
    super(message);
    this.name = "PasswordEncryptionUnavailableError";
  }
}

/**
 * Verifies real OS-backed Safe Storage is active.
 * Rejects Linux `basic_text` / `unknown` fallback backends so secrets never fall back
 * to hardcoded or unencrypted storage.
 */
export function isPasswordEncryptionAvailable(): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return false;
    }
    if (process.platform === "linux" && typeof safeStorage.getSelectedStorageBackend === "function") {
      const backend = safeStorage.getSelectedStorageBackend();
      if (backend === "basic_text" || backend === "unknown") {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function encryptPasswordSecret(plaintext: string): Buffer {
  if (!isPasswordEncryptionAvailable()) {
    throw new PasswordEncryptionUnavailableError();
  }
  const encrypted = safeStorage.encryptString(plaintext);
  return Buffer.concat([Buffer.from([FORMAT_SAFE_STORAGE]), encrypted]);
}

export function decryptPasswordSecret(payload: Buffer): string {
  if (payload.length === 0) return "";
  if (!isPasswordEncryptionAvailable()) {
    throw new PasswordEncryptionUnavailableError(
      "OS Keychain / Keyring is locked or unavailable to decrypt saved passwords."
    );
  }

  const marker = payload[0];
  const body = payload.subarray(1);

  if (marker === FORMAT_SAFE_STORAGE) {
    return safeStorage.decryptString(body);
  }
  if (marker === 0x00) {
    throw new Error("Refusing to read unencrypted password entry.");
  }

  // Legacy raw safeStorage payload compatibility (without version prefix byte)
  return safeStorage.decryptString(payload);
}
