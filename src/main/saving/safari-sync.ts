import { getDatastore } from "@/saving/datastore";
import { safeStorage } from "electron";
import { randomUUID } from "crypto";
import os from "os";
import { generatePairingCode, generatePairingToken } from "@/modules/safari-sync/crypto";
import type {
  ICloudSyncConfig,
  LocalCompanionConfig,
  RemoteDeviceSnapshotSummary,
  SafariLiveSyncConfig,
  SyncActivityEntry,
  SyncInboxLink
} from "~/types/safari-sync";

export interface PendingOnboardingTab {
  url: string;
  title: string;
  profileId: string;
  spaceId: string;
}

export interface PersistedSafariSyncData {
  deviceId: string;
  deviceName: string;
  safariLiveSync: SafariLiveSyncConfig;
  icloudConfig: ICloudSyncConfig;
  icloudPassphraseCiphertext?: string;
  icloudPassphrasePlainFallback?: string;
  icloudLastSyncedAt?: number;
  icloudLastError?: string;
  remoteDevices: RemoteDeviceSnapshotSummary[];
  companionConfig: LocalCompanionConfig;
  companionPairingToken: string;
  companionPairingCode: string;
  inbox: SyncInboxLink[];
  recentActivity: SyncActivityEntry[];
  pendingOnboardingTabs: PendingOnboardingTab[];
}

const SafariSyncDataStore = getDatastore("safari-sync");

function createDefaultData(): PersistedSafariSyncData {
  const host = os.hostname().replace(/\.local$/i, "") || "Lumi Desktop";
  return {
    deviceId: randomUUID(),
    deviceName: host,
    safariLiveSync: {
      enabled: false,
      pollIntervalSec: 15,
      lastImportedCount: 0
    },
    icloudConfig: {
      enabled: false,
      autoSync: true,
      syncIntervalSec: 60,
      mergeRemoteFavourites: true,
      mergeRemoteHistory: false,
      autoOpenInboxLinks: false
    },
    remoteDevices: [],
    companionConfig: {
      enabled: false,
      port: 48123,
      advertiseBonjour: true,
      bonjourName: `Lumi on ${host}`,
      autoOpenReceivedLinks: false
    },
    companionPairingToken: generatePairingToken(),
    companionPairingCode: generatePairingCode(),
    inbox: [],
    recentActivity: [],
    pendingOnboardingTabs: []
  };
}

let cachedData: PersistedSafariSyncData | null = null;
let loadingPromise: Promise<PersistedSafariSyncData> | null = null;

function mergeWithDefaults(raw: Partial<PersistedSafariSyncData>): PersistedSafariSyncData {
  const defaults = createDefaultData();
  return {
    deviceId: raw.deviceId || defaults.deviceId,
    deviceName: raw.deviceName || defaults.deviceName,
    safariLiveSync: {
      ...defaults.safariLiveSync,
      ...(raw.safariLiveSync || {})
    },
    icloudConfig: {
      ...defaults.icloudConfig,
      ...(raw.icloudConfig || {})
    },
    icloudPassphraseCiphertext: raw.icloudPassphraseCiphertext,
    icloudPassphrasePlainFallback: raw.icloudPassphrasePlainFallback,
    icloudLastSyncedAt: raw.icloudLastSyncedAt,
    icloudLastError: raw.icloudLastError,
    remoteDevices: Array.isArray(raw.remoteDevices) ? raw.remoteDevices : [],
    companionConfig: {
      ...defaults.companionConfig,
      ...(raw.companionConfig || {})
    },
    companionPairingToken: raw.companionPairingToken || defaults.companionPairingToken,
    companionPairingCode: raw.companionPairingCode || defaults.companionPairingCode,
    inbox: Array.isArray(raw.inbox) ? raw.inbox : [],
    recentActivity: Array.isArray(raw.recentActivity) ? raw.recentActivity : [],
    pendingOnboardingTabs: Array.isArray(raw.pendingOnboardingTabs) ? raw.pendingOnboardingTabs : []
  };
}

export async function loadSafariSyncData(): Promise<PersistedSafariSyncData> {
  if (cachedData) return cachedData;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const stored = await SafariSyncDataStore.get<Partial<PersistedSafariSyncData>>("state");
      cachedData = mergeWithDefaults(stored || {});
      if (!stored || !stored.deviceId || !stored.companionPairingToken) {
        await SafariSyncDataStore.set("state", cachedData);
      }
    } catch {
      cachedData = createDefaultData();
    }
    return cachedData;
  })();

  return loadingPromise;
}

export async function saveSafariSyncData(
  updater: (current: PersistedSafariSyncData) => PersistedSafariSyncData | void
): Promise<PersistedSafariSyncData> {
  const current = await loadSafariSyncData();
  const next = updater(current) || current;
  cachedData = next;
  await SafariSyncDataStore.set("state", cachedData);
  return cachedData;
}

export function getStoredPassphrase(data: PersistedSafariSyncData): string | null {
  if (data.icloudPassphraseCiphertext) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const buf = Buffer.from(data.icloudPassphraseCiphertext, "base64");
        return safeStorage.decryptString(buf);
      }
    } catch {
      // Fallback below
    }
  }
  return data.icloudPassphrasePlainFallback ?? null;
}

export async function setStoredPassphrase(passphrase: string): Promise<void> {
  const trimmed = passphrase.trim();
  await saveSafariSyncData((data) => {
    if (!trimmed) {
      delete data.icloudPassphraseCiphertext;
      delete data.icloudPassphrasePlainFallback;
      return;
    }

    if (safeStorage.isEncryptionAvailable()) {
      data.icloudPassphraseCiphertext = safeStorage.encryptString(trimmed).toString("base64");
      delete data.icloudPassphrasePlainFallback;
    } else {
      data.icloudPassphrasePlainFallback = trimmed;
      delete data.icloudPassphraseCiphertext;
    }
  });
}

export async function appendSyncActivity(
  channel: SyncActivityEntry["channel"],
  message: string,
  level: SyncActivityEntry["level"] = "info"
): Promise<void> {
  await saveSafariSyncData((data) => {
    data.recentActivity = [
      {
        id: randomUUID(),
        timestamp: Date.now(),
        channel,
        message,
        level
      },
      ...data.recentActivity
    ].slice(0, 40);
  });
}
