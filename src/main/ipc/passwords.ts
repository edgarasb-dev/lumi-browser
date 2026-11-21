import fs from "fs/promises";
import { BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { profilesController } from "@/controllers/profiles-controller";
import { spacesController } from "@/controllers/spaces-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { getSettingValueById } from "@/saving/settings";
import { authenticatePasswordAccess, getPasswordManagerStatus } from "@/modules/passwords/auth";
import { parsePasswordsCsv, serializePasswordsCsv } from "@/modules/passwords/csv";
import { generateStrongPassword } from "@/modules/passwords/generator";
import {
  acceptPendingSavePrompt,
  dismissPendingSavePrompt,
  getAllPendingPasswordSavePrompts,
  recordPasswordCandidateSubmission
} from "@/modules/passwords/pending-prompts";
import { doHostsMatchForAutofill, extractCredentialHost, normalizeCredentialOrigin } from "@/modules/passwords/utils";
import {
  decryptSavedPasswordRow,
  deleteSavedPassword,
  exportDecryptedCredentialsForProfile,
  getMatchingCredentialsForUrl,
  getSavedPasswordRowById,
  importCredentialsBatch,
  listNeverSaveSites,
  listSavedPasswordsForProfile,
  removeNeverSaveSite,
  saveOrUpdatePassword,
  touchSavedPasswordUsage
} from "@/saving/passwords";
import type {
  FilledCredentialPayload,
  PasswordGeneratorOptions,
  SavePasswordInput,
  SiteAutofillSuggestionsResult
} from "~/types/passwords";

async function resolveActiveProfileId(sender: Electron.WebContents, requestedProfileId?: string): Promise<string> {
  if (requestedProfileId) {
    return requestedProfileId;
  }
  const tab = tabsController.getTabByWebContents(sender);
  if (tab?.profileId) return tab.profileId;

  const win = browserWindowsController.getWindowFromWebContents(sender);
  if (win?.currentSpaceId) {
    const space = await spacesController.get(win.currentSpaceId);
    if (space?.profileId) return space.profileId;
  }

  const profiles = await profilesController.getAll();
  return profiles.find((p) => !p.internal)?.id ?? "main";
}

function getAuthenticatedWebOriginUrl(senderFrame: Electron.WebFrameMain | null): string | null {
  if (!senderFrame) return null;
  try {
    return normalizeCredentialOrigin(senderFrame.url);
  } catch {
    return null;
  }
}

// --- Privileged "app" channels (exposed via lumi.passwords only to lumi:/lumi-internal: UI) ---

ipcMain.handle("passwords:get-status", async () => {
  return getPasswordManagerStatus();
});

ipcMain.handle("passwords:list", async (event, profileId?: string) => {
  const pid = await resolveActiveProfileId(event.sender, profileId);
  return listSavedPasswordsForProfile(pid);
});

ipcMain.handle("passwords:get-for-site", async (event, url: string, profileId?: string) => {
  const pid = await resolveActiveProfileId(event.sender, profileId);
  return getMatchingCredentialsForUrl(pid, url);
});

ipcMain.handle("passwords:reveal", async (event, id: string, profileId?: string) => {
  const pid = await resolveActiveProfileId(event.sender, profileId);
  const row = getSavedPasswordRowById(pid, id);
  if (!row) {
    return { authenticated: false, error: "Credential not found" };
  }

  const auth = await authenticatePasswordAccess(`reveal the password for ${row.username || row.host}`);
  if (!auth.authenticated) {
    return { authenticated: false, error: auth.error ?? "Authentication cancelled" };
  }

  return {
    authenticated: true,
    password: decryptSavedPasswordRow(row)
  };
});

ipcMain.handle("passwords:copy", async (event, id: string, profileId?: string) => {
  const pid = await resolveActiveProfileId(event.sender, profileId);
  const row = getSavedPasswordRowById(pid, id);
  if (!row) {
    return { authenticated: false, copied: false, error: "Credential not found" };
  }

  const auth = await authenticatePasswordAccess(`copy the password for ${row.username || row.host}`);
  if (!auth.authenticated) {
    return { authenticated: false, copied: false, error: auth.error ?? "Authentication cancelled" };
  }

  clipboard.writeText(decryptSavedPasswordRow(row));
  return { authenticated: true, copied: true };
});

ipcMain.handle("passwords:save", async (event, input: SavePasswordInput, profileId?: string) => {
  const pid = await resolveActiveProfileId(event.sender, profileId);
  return saveOrUpdatePassword(pid, input);
});

ipcMain.handle("passwords:delete", async (event, id: string, profileId?: string) => {
  const pid = await resolveActiveProfileId(event.sender, profileId);
  return deleteSavedPassword(pid, id);
});

ipcMain.handle("passwords:generate", async (_event, options?: PasswordGeneratorOptions) => {
  return generateStrongPassword(options);
});

ipcMain.handle("passwords:import-csv", async (event, profileId?: string) => {
  const pid = await resolveActiveProfileId(event.sender, profileId);
  const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
  const dialogOptions: Electron.OpenDialogOptions = {
    title: "Import Passwords from CSV",
    properties: ["openFile"],
    filters: [{ name: "CSV Files", extensions: ["csv", "txt"] }]
  };
  const result = owner ? await dialog.showOpenDialog(owner, dialogOptions) : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, imported: 0, updated: 0, skipped: 0 };
  }

  const filePath = result.filePaths[0]!;
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = parsePasswordsCsv(raw);
    const stats = importCredentialsBatch(
      pid,
      parsed.map((r) => ({
        originUrl: r.url,
        username: r.username,
        password: r.password,
        title: r.title,
        note: r.note
      })),
      { overwriteExisting: false }
    );
    return { canceled: false, filePath, ...stats };
  } catch (err) {
    return {
      canceled: false,
      filePath,
      imported: 0,
      updated: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : String(err)
    };
  }
});

ipcMain.handle("passwords:export-csv", async (event, profileId?: string) => {
  const pid = await resolveActiveProfileId(event.sender, profileId);
  const auth = await authenticatePasswordAccess("export your saved passwords to a CSV file");
  if (!auth.authenticated) {
    return {
      canceled: false,
      authenticated: false,
      exported: 0,
      error: auth.error ?? "Authentication cancelled"
    };
  }

  const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
  const dialogOptions: Electron.SaveDialogOptions = {
    title: "Export Saved Passwords",
    defaultPath: "lumi-passwords.csv",
    filters: [{ name: "CSV Files", extensions: ["csv"] }]
  };
  const result = owner ? await dialog.showSaveDialog(owner, dialogOptions) : await dialog.showSaveDialog(dialogOptions);

  if (result.canceled || !result.filePath) {
    return { canceled: true, authenticated: true, exported: 0 };
  }

  try {
    const records = exportDecryptedCredentialsForProfile(pid);
    const csv = serializePasswordsCsv(records);
    await fs.writeFile(result.filePath, csv, "utf8");
    return { canceled: false, authenticated: true, filePath: result.filePath, exported: records.length };
  } catch (err) {
    return {
      canceled: false,
      authenticated: true,
      filePath: result.filePath,
      exported: 0,
      error: err instanceof Error ? err.message : String(err)
    };
  }
});

ipcMain.handle("passwords:list-never-save", async (event, profileId?: string) => {
  const pid = await resolveActiveProfileId(event.sender, profileId);
  return listNeverSaveSites(pid);
});

ipcMain.handle("passwords:remove-never-save", async (event, id: string, profileId?: string) => {
  const pid = await resolveActiveProfileId(event.sender, profileId);
  return removeNeverSaveSite(pid, id);
});

ipcMain.handle("passwords:get-pending-save-prompts", async () => {
  return getAllPendingPasswordSavePrompts();
});

ipcMain.handle("passwords:accept-save-prompt", async (_event, promptId: string, username: string, password: string) => {
  return acceptPendingSavePrompt(promptId, username, password);
});

ipcMain.handle("passwords:dismiss-save-prompt", async (_event, promptId: string, neverForSite: boolean) => {
  return dismissPendingSavePrompt(promptId, neverForSite);
});

ipcMain.handle("passwords:fill-in-tab", async (_event, tabId: number, credentialId: string) => {
  const tab = tabsController.getTabById(tabId);
  const wc = tab?.webContents;
  if (!tab || tab.isDestroyed || !wc) return false;

  const pageUrl = wc.getURL();
  const pageHost = extractCredentialHost(pageUrl);
  if (!pageHost) return false;

  const row = getSavedPasswordRowById(tab.profileId, credentialId);
  if (!row || !doHostsMatchForAutofill(row.host, pageHost)) return false;

  touchSavedPasswordUsage(tab.profileId, row.id);
  wc.send("passwords:fill-active-frame", {
    username: row.username,
    password: decryptSavedPasswordRow(row)
  });
  return true;
});

ipcMain.handle("passwords:fill-generated-in-tab", async (_event, tabId: number, password: string) => {
  const tab = tabsController.getTabById(tabId);
  const wc = tab?.webContents;
  if (!tab || tab.isDestroyed || !wc) return false;
  wc.send("passwords:fill-generated-active-frame", password);
  return true;
});

// --- Web Page Preload Channels (scoped strictly to senderFrame's origin; never exposed to page JS) ---

ipcMain.handle("passwords:page-suggestions", async (event): Promise<SiteAutofillSuggestionsResult> => {
  const autofillEnabled = getSettingValueById("passwordsAutofill") !== false;
  const origin = getAuthenticatedWebOriginUrl(event.senderFrame);
  if (!origin || !autofillEnabled) {
    return { autofillEnabled, siteHost: "", credentials: [] };
  }

  const tab = tabsController.getTabByWebContents(event.sender);
  if (!tab) {
    return { autofillEnabled, siteHost: "", credentials: [] };
  }

  const credentials = getMatchingCredentialsForUrl(tab.profileId, origin);
  return {
    autofillEnabled,
    siteHost: extractCredentialHost(origin),
    credentials
  };
});

ipcMain.handle("passwords:page-fill", async (event, credentialId: string): Promise<FilledCredentialPayload | null> => {
  const origin = getAuthenticatedWebOriginUrl(event.senderFrame);
  if (!origin) return null;

  const tab = tabsController.getTabByWebContents(event.sender);
  if (!tab) return null;

  const row = getSavedPasswordRowById(tab.profileId, credentialId);
  const frameHost = extractCredentialHost(origin);
  if (!row || !frameHost || !doHostsMatchForAutofill(row.host, frameHost)) {
    return null;
  }

  touchSavedPasswordUsage(tab.profileId, row.id);
  return {
    id: row.id,
    username: row.username,
    password: decryptSavedPasswordRow(row)
  };
});

ipcMain.handle("passwords:page-generate", async (event): Promise<string | null> => {
  const origin = getAuthenticatedWebOriginUrl(event.senderFrame);
  if (!origin) return null;
  return generateStrongPassword();
});

ipcMain.on("passwords:page-candidate-submit", (event, payload: { username?: string; password?: string }) => {
  const origin = getAuthenticatedWebOriginUrl(event.senderFrame);
  if (!origin || !payload?.password) return;
  const tab = tabsController.getTabByWebContents(event.sender);
  if (!tab) return;

  void recordPasswordCandidateSubmission(tab.id, origin, String(payload.username ?? ""), String(payload.password));
});
