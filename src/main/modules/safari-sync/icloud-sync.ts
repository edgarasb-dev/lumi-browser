import fs from "fs";
import fsPromises from "fs/promises";
import os from "os";
import path from "path";
import { debugError, debugPrint } from "@/modules/output";
import { decryptSyncSnapshot, encryptSyncSnapshot } from "@/modules/safari-sync/crypto";
import { isHttpOrHttpsUrl } from "@/modules/safari-sync/safari-bridge";
import { buildSyncSnapshot } from "@/modules/safari-sync/snapshot";
import { addFavouritesBatch } from "@/saving/favourites";
import { importBrowsingHistoryEntries } from "@/saving/history/browsing-history";
import { appendSyncActivity, getStoredPassphrase, loadSafariSyncData, saveSafariSyncData } from "@/saving/safari-sync";
import type { RemoteDeviceSnapshotSummary } from "~/types/safari-sync";

export function getDefaultICloudDriveRoot(): string {
  return path.join(os.homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs");
}

export function resolveICloudSyncDirectory(customDirectory?: string): string {
  if (customDirectory && customDirectory.trim()) {
    return customDirectory.trim();
  }
  return path.join(getDefaultICloudDriveRoot(), "Lumi");
}

export function isICloudDriveAvailable(customDirectory?: string): boolean {
  if (customDirectory && customDirectory.trim()) {
    return true;
  }
  if (process.platform !== "darwin") {
    return false;
  }
  return fs.existsSync(getDefaultICloudDriveRoot());
}

export interface ReceivedInboxDrop {
  url: string;
  title: string;
  sourceDevice: string;
}

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fsPromises.mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fsPromises.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  await fsPromises.rename(tempPath, filePath);
}

function extractLinksFromDropContent(rawContent: string, ext: string): ReceivedInboxDrop[] {
  const results: ReceivedInboxDrop[] = [];
  const trimmed = rawContent.trim();
  if (!trimmed) return results;

  if (ext === ".json") {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (typeof item === "string" && isHttpOrHttpsUrl(item.trim())) {
          results.push({
            url: item.trim(),
            title: item.trim(),
            sourceDevice: "iOS Shortcut"
          });
        } else if (item && typeof item === "object") {
          const obj = item as { url?: unknown; title?: unknown; sourceDevice?: unknown; device?: unknown };
          if (typeof obj.url === "string" && isHttpOrHttpsUrl(obj.url.trim())) {
            results.push({
              url: obj.url.trim(),
              title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : obj.url.trim(),
              sourceDevice:
                typeof obj.sourceDevice === "string" && obj.sourceDevice.trim()
                  ? obj.sourceDevice.trim()
                  : typeof obj.device === "string" && obj.device.trim()
                    ? obj.device.trim()
                    : "iCloud Shortcut"
            });
          }
        }
      }
      return results;
    } catch {
      // Fall through to line extraction
    }
  }

  for (const line of trimmed.split(/\r?\n/)) {
    const candidate = line.trim();
    if (isHttpOrHttpsUrl(candidate)) {
      results.push({
        url: candidate,
        title: candidate,
        sourceDevice: "iCloud Drop"
      });
    }
  }

  return results;
}

export class ICloudSyncEngine {
  private isSyncingFlag = false;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private watchers: fs.FSWatcher[] = [];
  private watchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onInboxDrops: (drops: ReceivedInboxDrop[]) => Promise<void>,
    private readonly onStateMutated: () => void
  ) {}

  public get isSyncing(): boolean {
    return this.isSyncingFlag;
  }

  public async configureAutoSync(): Promise<void> {
    this.stop();
    const data = await loadSafariSyncData();
    if (!data.icloudConfig.enabled) {
      return;
    }

    const syncDir = resolveICloudSyncDirectory(data.icloudConfig.customDirectory);
    await this.setupWatchers(syncDir).catch((error) => {
      debugError("SAFARI_SYNC", "Failed to setup iCloud watchers:", error);
    });

    if (data.icloudConfig.autoSync) {
      const intervalMs = Math.max(15, data.icloudConfig.syncIntervalSec || 60) * 1000;
      this.syncTimer = setInterval(() => {
        void this.syncNow();
      }, intervalMs);
    }
  }

  public stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
      this.watchDebounceTimer = null;
    }
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch {
        // Ignore close errors
      }
    }
    this.watchers = [];
  }

  private async setupWatchers(syncDir: string): Promise<void> {
    const inboxDir = path.join(syncDir, "inbox");
    const devicesDir = path.join(syncDir, "devices");
    await fsPromises.mkdir(inboxDir, { recursive: true });
    await fsPromises.mkdir(devicesDir, { recursive: true });

    const scheduleSync = () => {
      if (this.watchDebounceTimer) clearTimeout(this.watchDebounceTimer);
      this.watchDebounceTimer = setTimeout(() => {
        void this.syncNow();
      }, 1500);
    };

    for (const dir of [inboxDir, devicesDir]) {
      try {
        const watcher = fs.watch(dir, { persistent: false }, (_eventType, filename) => {
          if (!filename) return;
          if (filename.endsWith(".tmp") || filename.startsWith(".")) return;
          scheduleSync();
        });
        this.watchers.push(watcher);
      } catch (error) {
        debugError("SAFARI_SYNC", `Could not watch directory ${dir}:`, error);
      }
    }
  }

  private async processInboxDrops(syncDir: string): Promise<number> {
    const inboxDir = path.join(syncDir, "inbox");
    const processedDir = path.join(inboxDir, "processed");
    await fsPromises.mkdir(inboxDir, { recursive: true });

    const entries = await fsPromises.readdir(inboxDir, { withFileTypes: true }).catch(() => []);
    const drops: ReceivedInboxDrop[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name.startsWith(".") || entry.name.endsWith(".tmp")) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext !== ".json" && ext !== ".txt") continue;

      const filePath = path.join(inboxDir, entry.name);
      try {
        const content = await fsPromises.readFile(filePath, "utf8");
        const parsed = extractLinksFromDropContent(content, ext);
        drops.push(...parsed);

        await fsPromises.mkdir(processedDir, { recursive: true });
        const destName = `${Date.now()}-${entry.name}`;
        await fsPromises.rename(filePath, path.join(processedDir, destName));
      } catch (error) {
        debugError("SAFARI_SYNC", `Failed processing iCloud inbox file ${entry.name}:`, error);
      }
    }

    if (drops.length > 0) {
      await this.onInboxDrops(drops);
    }

    return drops.length;
  }

  public async syncNow(): Promise<{ success: boolean; error?: string }> {
    if (this.isSyncingFlag) {
      return { success: false, error: "Sync is already in progress." };
    }

    const data = await loadSafariSyncData();
    const passphrase = getStoredPassphrase(data);
    if (!passphrase) {
      const error = "Set an encryption passphrase before syncing to iCloud Drive.";
      await saveSafariSyncData((curr) => {
        curr.icloudLastError = error;
      });
      this.onStateMutated();
      return { success: false, error };
    }

    const syncDir = resolveICloudSyncDirectory(data.icloudConfig.customDirectory);
    if (!isICloudDriveAvailable(data.icloudConfig.customDirectory)) {
      const error = "iCloud Drive directory was not found. Select a custom sync directory or enable iCloud Drive.";
      await saveSafariSyncData((curr) => {
        curr.icloudLastError = error;
      });
      this.onStateMutated();
      return { success: false, error };
    }

    this.isSyncingFlag = true;
    this.onStateMutated();

    try {
      const devicesDir = path.join(syncDir, "devices");
      await fsPromises.mkdir(devicesDir, { recursive: true });

      // 1. Ingest any links dropped by iOS Shortcuts into inbox/
      const inboxCount = await this.processInboxDrops(syncDir);

      // 2. Write local device encrypted snapshot + canonical latest snapshot
      const snapshot = await buildSyncSnapshot();
      const envelope = await encryptSyncSnapshot(snapshot, passphrase);
      await atomicWriteJson(path.join(devicesDir, `${snapshot.deviceId}.enc.json`), envelope);
      await atomicWriteJson(path.join(syncDir, "lumi-sync-state.enc.json"), envelope);

      // 3. Read and decrypt remote device snapshots
      const deviceFiles = await fsPromises.readdir(devicesDir, { withFileTypes: true }).catch(() => []);
      const remoteDevices: RemoteDeviceSnapshotSummary[] = [];
      const remoteFavouritesToMerge: Array<{ title: string; url: string; createdAt?: number }> = [];
      const remoteHistoryToMerge: Array<{ url: string; title: string; visitTime: number; visitCount?: number }> = [];
      const decryptErrors: string[] = [];

      for (const file of deviceFiles) {
        if (!file.isFile() || !file.name.endsWith(".enc.json")) continue;
        const deviceId = file.name.replace(/\.enc\.json$/, "");
        if (deviceId === snapshot.deviceId) continue;

        try {
          const raw = await fsPromises.readFile(path.join(devicesDir, file.name), "utf8");
          const parsedEnv = JSON.parse(raw) as unknown;
          const remote = await decryptSyncSnapshot(parsedEnv, passphrase);

          remoteDevices.push({
            deviceId: remote.deviceId,
            deviceName: remote.deviceName,
            platform: remote.platform,
            exportedAt: remote.exportedAt,
            openTabs: remote.openTabs.slice(0, 100),
            favouritesCount: remote.favourites.length,
            historyCount: remote.recentHistory.length
          });

          if (data.icloudConfig.mergeRemoteFavourites) {
            for (const fav of remote.favourites) {
              remoteFavouritesToMerge.push({
                title: fav.title,
                url: fav.url,
                createdAt: fav.createdAt
              });
            }
          }

          if (data.icloudConfig.mergeRemoteHistory) {
            for (const hist of remote.recentHistory) {
              remoteHistoryToMerge.push({
                url: hist.url,
                title: hist.title,
                visitTime: hist.lastVisitTime,
                visitCount: hist.visitCount
              });
            }
          }
        } catch (err) {
          decryptErrors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      remoteDevices.sort((a, b) => b.exportedAt - a.exportedAt);

      let mergedFavs = 0;
      if (remoteFavouritesToMerge.length > 0) {
        mergedFavs = await addFavouritesBatch(remoteFavouritesToMerge);
      }

      let mergedHistory = 0;
      if (remoteHistoryToMerge.length > 0) {
        mergedHistory = importBrowsingHistoryEntries("main", remoteHistoryToMerge);
      }

      await saveSafariSyncData((curr) => {
        curr.remoteDevices = remoteDevices;
        curr.icloudLastSyncedAt = Date.now();
        curr.icloudLastError = decryptErrors.length > 0 ? decryptErrors[0] : undefined;
      });

      const details = [
        `${snapshot.openTabs.length} tabs`,
        `${remoteDevices.length} peer device${remoteDevices.length === 1 ? "" : "s"}`
      ];
      if (inboxCount > 0) details.push(`${inboxCount} inbox link${inboxCount === 1 ? "" : "s"}`);
      if (mergedFavs > 0) details.push(`+${mergedFavs} favourites`);
      if (mergedHistory > 0) details.push(`+${mergedHistory} history`);

      await appendSyncActivity("icloud", `iCloud sync completed (${details.join(", ")})`, "success");
      debugPrint("SAFARI_SYNC", "iCloud sync finished:", details.join(", "));
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await saveSafariSyncData((curr) => {
        curr.icloudLastError = msg;
      });
      await appendSyncActivity("icloud", `iCloud sync failed: ${msg}`, "error");
      debugError("SAFARI_SYNC", "iCloud sync error:", msg);
      return { success: false, error: msg };
    } finally {
      this.isSyncingFlag = false;
      this.onStateMutated();
    }
  }
}
