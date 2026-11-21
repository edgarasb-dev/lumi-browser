import type {
  CopyPasswordResult,
  NeverSaveSiteEntry,
  PasswordCsvExportResult,
  PasswordCsvImportResult,
  PasswordGeneratorOptions,
  PasswordManagerStatus,
  PendingPasswordSavePrompt,
  RevealPasswordResult,
  SavedPasswordSummary,
  SavePasswordInput,
  SiteCredentialMatch
} from "~/types/passwords";

export interface LumiPasswordsAPI {
  getStatus: () => Promise<PasswordManagerStatus>;
  list: (profileId?: string) => Promise<SavedPasswordSummary[]>;
  getForSite: (url: string, profileId?: string) => Promise<SiteCredentialMatch[]>;
  reveal: (id: string, profileId?: string) => Promise<RevealPasswordResult>;
  copyPassword: (id: string, profileId?: string) => Promise<CopyPasswordResult>;
  save: (input: SavePasswordInput, profileId?: string) => Promise<SavedPasswordSummary>;
  delete: (id: string, profileId?: string) => Promise<boolean>;
  generate: (options?: PasswordGeneratorOptions) => Promise<string>;
  importCsv: (profileId?: string) => Promise<PasswordCsvImportResult>;
  exportCsv: (profileId?: string) => Promise<PasswordCsvExportResult>;
  listNeverSaveSites: (profileId?: string) => Promise<NeverSaveSiteEntry[]>;
  removeNeverSaveSite: (id: string, profileId?: string) => Promise<boolean>;

  // Browser UI save/update prompt actions & active tab credential fill
  getPendingSavePrompts: () => Promise<PendingPasswordSavePrompt[]>;
  onPendingSavePromptsUpdated: (callback: (prompts: PendingPasswordSavePrompt[]) => void) => () => void;
  acceptSavePrompt: (promptId: string, username: string, password: string) => Promise<boolean>;
  dismissSavePrompt: (promptId: string, neverForSite: boolean) => Promise<boolean>;
  fillCredentialInTab: (tabId: number, credentialId: string) => Promise<boolean>;
  fillGeneratedPasswordInTab: (tabId: number, password: string) => Promise<boolean>;
}
