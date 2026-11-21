import crypto from "crypto";
import { sendMessageToListeners } from "@/ipc/listeners-manager";
import { profilesController } from "@/controllers/profiles-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { getSettingValueById } from "@/saving/settings";
import {
  addNeverSaveSite,
  decryptSavedPasswordRow,
  findExactCredential,
  isSiteNeverSaved,
  saveOrUpdatePassword,
  touchSavedPasswordUsage
} from "@/saving/passwords";
import { isPasswordEncryptionAvailable } from "@/modules/passwords/crypto";
import { extractCredentialHost, getRegistrableDomain, normalizeCredentialOrigin } from "@/modules/passwords/utils";
import type { PendingPasswordSavePrompt } from "~/types/passwords";

const pendingByTab = new Map<number, PendingPasswordSavePrompt>();
const subscribedTabIds = new Set<number>();

function broadcastPendingPrompts(): void {
  sendMessageToListeners("passwords:on-pending-save-prompts-updated", getAllPendingPasswordSavePrompts());
}

export function getAllPendingPasswordSavePrompts(): PendingPasswordSavePrompt[] {
  return Array.from(pendingByTab.values());
}

function clearPromptForTab(tabId: number): void {
  if (!pendingByTab.delete(tabId)) return;
  broadcastPendingPrompts();
}

function ensureTabListeners(tabId: number): void {
  if (subscribedTabIds.has(tabId)) return;
  const tab = tabsController.getTabById(tabId);
  const wc = tab?.webContents;
  if (!tab || !wc) return;

  subscribedTabIds.add(tabId);

  const handleNavigate = (_event: Electron.Event, nextUrl: string) => {
    const prompt = pendingByTab.get(tabId);
    if (!prompt) return;
    const nextHost = extractCredentialHost(nextUrl);
    if (!nextHost) {
      clearPromptForTab(tabId);
      return;
    }
    // Keep the prompt alive across same-site post-login redirects (e.g. /login -> /home).
    if (getRegistrableDomain(nextHost) !== getRegistrableDomain(prompt.host)) {
      clearPromptForTab(tabId);
    }
  };

  wc.on("did-navigate", handleNavigate);
  wc.once("destroyed", () => {
    wc.removeListener("did-navigate", handleNavigate);
    subscribedTabIds.delete(tabId);
    clearPromptForTab(tabId);
  });
}

export async function recordPasswordCandidateSubmission(
  tabId: number,
  pageUrl: string,
  username: string,
  password: string
): Promise<void> {
  if (!password) return;
  if (!isPasswordEncryptionAvailable()) return;
  if (getSettingValueById("passwordsOfferSave") === false) return;

  const tab = tabsController.getTabById(tabId);
  if (!tab) return;

  const profileId = tab.profileId;
  const profile = await profilesController.get(profileId);
  if (profile?.ephemeral) return;

  const origin = normalizeCredentialOrigin(pageUrl);
  if (!origin) return;
  const host = extractCredentialHost(origin);
  if (!host) return;
  if (isSiteNeverSaved(profileId, origin)) return;

  const normalizedUser = username.trim();
  const existing = findExactCredential(profileId, origin, normalizedUser);
  if (existing) {
    try {
      if (decryptSavedPasswordRow(existing) === password) {
        touchSavedPasswordUsage(profileId, existing.id);
        return;
      }
    } catch {
      // Offer update if existing ciphertext cannot be read cleanly
    }
  }

  ensureTabListeners(tabId);

  const prompt: PendingPasswordSavePrompt = {
    promptId: crypto.randomUUID(),
    tabId,
    profileId,
    origin,
    host,
    username: normalizedUser,
    password,
    mode: existing ? "update" : "save",
    existingId: existing?.id,
    createdAt: Date.now()
  };

  pendingByTab.set(tabId, prompt);
  broadcastPendingPrompts();
}

export function acceptPendingSavePrompt(promptId: string, username: string, password: string): boolean {
  for (const [tabId, prompt] of pendingByTab.entries()) {
    if (prompt.promptId !== promptId) continue;
    saveOrUpdatePassword(prompt.profileId, {
      id: prompt.existingId,
      origin: prompt.origin,
      username,
      password
    });
    pendingByTab.delete(tabId);
    broadcastPendingPrompts();
    return true;
  }
  return false;
}

export function dismissPendingSavePrompt(promptId: string, neverForSite: boolean): boolean {
  for (const [tabId, prompt] of pendingByTab.entries()) {
    if (prompt.promptId !== promptId) continue;
    if (neverForSite) {
      addNeverSaveSite(prompt.profileId, prompt.origin);
    }
    pendingByTab.delete(tabId);
    broadcastPendingPrompts();
    return true;
  }
  return false;
}
