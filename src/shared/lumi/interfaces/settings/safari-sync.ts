import type { IPCListener } from "~/lumi/types";
import type {
  ICloudSyncConfig,
  LocalCompanionConfig,
  SafariDiscoveryResult,
  SafariImportOptions,
  SafariImportResult,
  SafariLiveSyncConfig,
  SafariSyncState
} from "~/types/safari-sync";

export interface LumiSafariSyncAPI {
  getState: () => Promise<SafariSyncState>;
  onStateChanged: IPCListener<[SafariSyncState]>;

  // Option C: macOS Safari Bridge
  discoverSafari: (customBookmarksFilePath?: string) => Promise<SafariDiscoveryResult>;
  pickBookmarksFile: () => Promise<string | null>;
  importFromSafari: (options: SafariImportOptions) => Promise<SafariImportResult>;
  openInSafari: (url: string) => Promise<boolean>;
  updateSafariLiveSync: (updates: Partial<SafariLiveSyncConfig>) => Promise<SafariSyncState>;
  syncSafariOpenTabsNow: () => Promise<{ importedCount: number; error?: string }>;
  openMacPrivacySettings: (pane: "automation" | "full-disk-access") => Promise<boolean>;

  // Option A: iCloud Drive Encrypted Sync
  updateICloudConfig: (updates: Partial<ICloudSyncConfig>) => Promise<SafariSyncState>;
  setICloudPassphrase: (passphrase: string) => Promise<{ success: boolean; error?: string }>;
  generateICloudPassphrase: () => Promise<string>;
  revealICloudPassphrase: () => Promise<string | null>;
  pickICloudDirectory: () => Promise<string | null>;
  revealICloudDirectory: () => Promise<boolean>;
  syncICloudNow: () => Promise<{ success: boolean; error?: string }>;
  openRemoteDeviceTab: (url: string, spaceId?: string) => Promise<boolean>;
  openAllRemoteDeviceTabs: (deviceId: string, createSpace?: boolean) => Promise<number>;

  // Option B: Local Wi-Fi & Bonjour Companion Server
  updateCompanionConfig: (updates: Partial<LocalCompanionConfig>) => Promise<SafariSyncState>;
  regenerateCompanionPairing: () => Promise<SafariSyncState>;

  // Sync Inbox Actions
  openInboxLink: (linkId: string, spaceId?: string) => Promise<boolean>;
  saveInboxLinkToFavourites: (linkId: string) => Promise<boolean>;
  dismissInboxLink: (linkId: string) => Promise<boolean>;
  clearInbox: () => Promise<boolean>;
}
