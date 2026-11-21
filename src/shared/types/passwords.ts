export interface SavedPasswordSummary {
  id: string;
  profileId: string;
  origin: string;
  host: string;
  actionUrl: string | null;
  username: string;
  title: string | null;
  note: string | null;
  timesUsed: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
}

export interface SavePasswordInput {
  id?: string;
  origin: string;
  username: string;
  password: string;
  title?: string | null;
  note?: string | null;
  actionUrl?: string | null;
}

export interface RevealPasswordResult {
  authenticated: boolean;
  password?: string;
  error?: string;
}

export interface CopyPasswordResult {
  authenticated: boolean;
  copied: boolean;
  error?: string;
}

export interface NeverSaveSiteEntry {
  id: string;
  profileId: string;
  host: string;
  createdAt: number;
}

export interface PasswordCsvImportResult {
  canceled: boolean;
  filePath?: string;
  imported: number;
  updated: number;
  skipped: number;
  error?: string;
}

export interface PasswordCsvExportResult {
  canceled: boolean;
  authenticated: boolean;
  filePath?: string;
  exported: number;
  error?: string;
}

export interface PasswordGeneratorOptions {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
}

export interface SiteCredentialMatch {
  id: string;
  origin: string;
  host: string;
  username: string;
  title: string | null;
  lastUsedAt: number | null;
}

export interface SiteAutofillSuggestionsResult {
  autofillEnabled: boolean;
  siteHost: string;
  credentials: SiteCredentialMatch[];
}

export interface FilledCredentialPayload {
  id: string;
  username: string;
  password: string;
}

export interface PendingPasswordSavePrompt {
  promptId: string;
  tabId: number;
  profileId: string;
  origin: string;
  host: string;
  username: string;
  password: string;
  mode: "save" | "update";
  existingId?: string;
  createdAt: number;
}

export interface PasswordManagerStatus {
  encryptionAvailable: boolean;
  touchIdAvailable: boolean;
}
