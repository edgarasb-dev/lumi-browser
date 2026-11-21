import { systemPreferences } from "electron";
import { isPasswordEncryptionAvailable } from "@/modules/passwords/crypto";
import type { PasswordManagerStatus } from "~/types/passwords";

export interface PasswordAuthResult {
  authenticated: boolean;
  error?: string;
}

export function getPasswordManagerStatus(): PasswordManagerStatus {
  const encryptionAvailable = isPasswordEncryptionAvailable();
  let touchIdAvailable = false;

  try {
    touchIdAvailable = process.platform === "darwin" && systemPreferences.canPromptTouchID();
  } catch {
    touchIdAvailable = false;
  }

  return { encryptionAvailable, touchIdAvailable };
}

/**
 * Prompts macOS Touch ID / Apple Watch authentication when supported.
 * On platforms or Macs without Touch ID hardware, resolves `{ authenticated: true }`.
 */
export async function authenticatePasswordAccess(reason: string): Promise<PasswordAuthResult> {
  if (process.platform !== "darwin") {
    return { authenticated: true };
  }

  let canPrompt = false;
  try {
    canPrompt = systemPreferences.canPromptTouchID();
  } catch {
    canPrompt = false;
  }

  if (!canPrompt) {
    return { authenticated: true };
  }

  try {
    await systemPreferences.promptTouchID(reason);
    return { authenticated: true };
  } catch (error) {
    return {
      authenticated: false,
      error: error instanceof Error ? error.message : "Authentication cancelled"
    };
  }
}
