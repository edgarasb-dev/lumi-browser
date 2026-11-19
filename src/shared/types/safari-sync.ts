export interface SafariOpenTab {
  windowIndex: number;
  tabIndex: number;
  title: string;
  url: string;
}

export interface SafariBookmarkItem {
  id: string;
  title: string;
  url: string;
  folderPath: string[];
  isReadingList: boolean;
  dateAdded?: number;
  previewText?: string;
}

export interface SafariHistoryItem {
  url: string;
  title: string;
  visitTime: number;
  visitCount: number;
}

export interface SafariDiscoveryResult {
  supported: boolean;
  safariInstalled: boolean;
  safariRunning: boolean;
  bookmarksReadable: boolean;
  historyReadable: boolean;
  automationError?: string;
  fullDiskAccessNeeded: boolean;
  customSourcePath?: string;
  counts: {
    openTabs: number;
    bookmarks: number;
    readingList: number;
    history: number;
  };
  openTabs: SafariOpenTab[];
  bookmarks: SafariBookmarkItem[];
  readingList: SafariBookmarkItem[];
  historyPreview: SafariHistoryItem[];
}

export interface SafariImportOptions {
  profileId: string;
  targetSpaceId?: string;
  createSafariSpace?: boolean;
  importOpenTabs: boolean;
  importBookmarks: boolean;
  importReadingListToFavourites: boolean;
  importReadingListAsTabs: boolean;
  importHistory: boolean;
  historyMaxDays?: number;
  selectedOpenTabUrls?: string[];
  customBookmarksFilePath?: string;
}

export interface SafariImportResult {
  success: boolean;
  tabsOpened: number;
  tabsQueuedForOnboarding: number;
  favouritesAdded: number;
  historyEntriesImported: number;
  targetSpaceId?: string;
  targetSpaceName?: string;
  errors: string[];
}

export interface SafariLiveSyncConfig {
  enabled: boolean;
  pollIntervalSec: number;
  targetSpaceId?: string;
  profileId?: string;
  lastSyncedAt?: number;
  lastImportedCount: number;
}

export interface SyncInboxLink {
  id: string;
  url: string;
  title: string;
  sourceDevice: string;
  sourceChannel: "companion" | "icloud-inbox" | "safari-bridge";
  receivedAt: number;
  status: "pending" | "opened" | "saved";
}

export interface SyncedOpenTabItem {
  uniqueId: string;
  spaceId: string;
  spaceName: string;
  title: string;
  url: string;
  lastActiveAt: number;
}

export interface SyncedFavouriteItem {
  id: string;
  title: string;
  url: string;
  createdAt: number;
}

export interface SyncedHistoryItem {
  url: string;
  title: string;
  visitCount: number;
  lastVisitTime: number;
}

export interface SyncSnapshotPayload {
  version: 1;
  deviceId: string;
  deviceName: string;
  platform: string;
  exportedAt: number;
  spaces: {
    id: string;
    profileId: string;
    name: string;
  }[];
  openTabs: SyncedOpenTabItem[];
  favourites: SyncedFavouriteItem[];
  recentHistory: SyncedHistoryItem[];
}

export interface RemoteDeviceSnapshotSummary {
  deviceId: string;
  deviceName: string;
  platform: string;
  exportedAt: number;
  openTabs: SyncedOpenTabItem[];
  favouritesCount: number;
  historyCount: number;
}

export interface ICloudSyncConfig {
  enabled: boolean;
  autoSync: boolean;
  syncIntervalSec: number;
  mergeRemoteFavourites: boolean;
  mergeRemoteHistory: boolean;
  autoOpenInboxLinks: boolean;
  customDirectory?: string;
}

export interface ICloudSyncStatus {
  config: ICloudSyncConfig;
  resolvedDirectory: string;
  icloudAvailable: boolean;
  hasPassphrase: boolean;
  isSyncing: boolean;
  lastSyncedAt?: number;
  lastError?: string;
  remoteDevices: RemoteDeviceSnapshotSummary[];
  iosShortcutRecipe: {
    inboxFolderPath: string;
    sampleJsonPayload: string;
  };
}

export interface LocalCompanionConfig {
  enabled: boolean;
  port: number;
  advertiseBonjour: boolean;
  bonjourName: string;
  autoOpenReceivedLinks: boolean;
}

export interface LocalCompanionStatus {
  config: LocalCompanionConfig;
  running: boolean;
  actualPort: number | null;
  bonjourActive: boolean;
  bonjourServiceType: string;
  urls: string[];
  bonjourUrl: string | null;
  primaryPairUrl: string | null;
  pairingCode: string;
  connectedClients: number;
  lastClientSeenAt?: number;
  lastError?: string;
}

export interface SyncActivityEntry {
  id: string;
  timestamp: number;
  channel: "safari" | "icloud" | "companion" | "inbox";
  message: string;
  level: "info" | "success" | "warning" | "error";
}

export interface SafariSyncState {
  platform: NodeJS.Platform;
  deviceId: string;
  deviceName: string;
  safariLiveSync: SafariLiveSyncConfig;
  icloud: ICloudSyncStatus;
  companion: LocalCompanionStatus;
  inbox: SyncInboxLink[];
  recentActivity: SyncActivityEntry[];
}
