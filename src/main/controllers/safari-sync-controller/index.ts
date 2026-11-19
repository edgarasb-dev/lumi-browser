import { app, dialog, shell } from "electron";
import { randomUUID } from "crypto";
import path from "path";
import { spacesController } from "@/controllers/spaces-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import type { BrowserWindow } from "@/controllers/windows-controller/types/browser";
import { debugError, debugPrint } from "@/modules/output";
import { CompanionServer, type CompanionIncomingLink } from "@/modules/safari-sync/companion-server";
import { generatePairingCode, generatePairingToken, generateStrongPassphrase } from "@/modules/safari-sync/crypto";
import {
  ICloudSyncEngine,
  isICloudDriveAvailable,
  resolveICloudSyncDirectory,
  type ReceivedInboxDrop
} from "@/modules/safari-sync/icloud-sync";
import {
  discoverSafariData,
  importFromSafari,
  isHttpOrHttpsUrl,
  openUrlInSafari,
  openUrlsInLumiSpace,
  probeSafariFullDiskAccess,
  readSafariOpenTabs,
  resolveOrCreateTargetSpace
} from "@/modules/safari-sync/safari-bridge";
import { TypedEventEmitter } from "@/modules/typed-event-emitter";
import { addFavourite, favouritesEmitter } from "@/saving/favourites";
import {
  appendSyncActivity,
  getStoredPassphrase,
  loadSafariSyncData,
  saveSafariSyncData,
  setStoredPassphrase
} from "@/saving/safari-sync";
import type {
  ICloudSyncConfig,
  LocalCompanionConfig,
  SafariDiscoveryResult,
  SafariImportOptions,
  SafariImportResult,
  SafariLiveSyncConfig,
  SafariSyncState,
  SyncInboxLink
} from "~/types/safari-sync";

type SafariSyncEvents = {
  "state-changed": [SafariSyncState];
};

class SafariSyncController extends TypedEventEmitter<SafariSyncEvents> {
  private icloudEngine: ICloudSyncEngine;
  private companionServer: CompanionServer;
  private safariLiveTimer: ReturnType<typeof setInterval> | null = null;
  private seenLiveSafariUrls: Set<string> = new Set();
  private stateEmitTimer: ReturnType<typeof setTimeout> | null = null;
  private wsBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
  private isShuttingDown = false;

  constructor() {
    super();

    this.icloudEngine = new ICloudSyncEngine(
      (drops) => this.handleICloudInboxDrops(drops),
      () => this.scheduleStateEmit()
    );

    this.companionServer = new CompanionServer(
      (link) => this.handleCompanionIncomingLink(link),
      () => this.scheduleStateEmit()
    );

    void app.whenReady().then(() => {
      void this.initialize();
    });
  }

  private async initialize(): Promise<void> {
    if (this.isShuttingDown) return;

    const data = await loadSafariSyncData();

    if (data.icloudConfig.enabled) {
      await this.icloudEngine.configureAutoSync();
    }

    if (data.companionConfig.enabled) {
      await this.companionServer.start();
    }

    if (data.safariLiveSync.enabled) {
      await this.configureSafariLiveSync();
    }

    const scheduleWsPush = () => {
      if (this.isShuttingDown) return;
      if (this.wsBroadcastTimer) clearTimeout(this.wsBroadcastTimer);
      this.wsBroadcastTimer = setTimeout(() => {
        void this.companionServer.broadcastState();
      }, 500);
    };

    tabsController.on("tab-created", scheduleWsPush);
    tabsController.on("tab-removed", scheduleWsPush);
    tabsController.on("current-space-changed", scheduleWsPush);
    favouritesEmitter.on("favourites-changed", scheduleWsPush);

    this.scheduleStateEmit();
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    if (this.safariLiveTimer) {
      clearInterval(this.safariLiveTimer);
      this.safariLiveTimer = null;
    }
    if (this.stateEmitTimer) {
      clearTimeout(this.stateEmitTimer);
      this.stateEmitTimer = null;
    }
    if (this.wsBroadcastTimer) {
      clearTimeout(this.wsBroadcastTimer);
      this.wsBroadcastTimer = null;
    }
    this.icloudEngine.stop();
    await this.companionServer.stop();
  }

  private scheduleStateEmit(): void {
    if (this.isShuttingDown) return;
    if (this.stateEmitTimer) clearTimeout(this.stateEmitTimer);
    this.stateEmitTimer = setTimeout(() => {
      void this.getState().then((state) => {
        this.emit("state-changed", state);
      });
    }, 60);
  }

  public async getState(): Promise<SafariSyncState> {
    const data = await loadSafariSyncData();
    const resolvedDir = resolveICloudSyncDirectory(data.icloudConfig.customDirectory);
    const passphrase = getStoredPassphrase(data);
    const companionSnapshot = this.companionServer.getStatusSnapshot();
    const urlsInfo = await this.companionServer.getUrls(data.companionPairingToken);

    const samplePayload = JSON.stringify(
      {
        url: "https://example.com",
        title: "Saved from iPhone",
        sourceDevice: "iPhone"
      },
      null,
      2
    );

    return {
      platform: process.platform,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      safariLiveSync: { ...data.safariLiveSync },
      icloud: {
        config: { ...data.icloudConfig },
        resolvedDirectory: resolvedDir,
        icloudAvailable: isICloudDriveAvailable(data.icloudConfig.customDirectory),
        hasPassphrase: Boolean(passphrase && passphrase.length >= 4),
        isSyncing: this.icloudEngine.isSyncing,
        lastSyncedAt: data.icloudLastSyncedAt,
        lastError: data.icloudLastError,
        remoteDevices: [...data.remoteDevices],
        iosShortcutRecipe: {
          inboxFolderPath: path.join(resolvedDir, "inbox"),
          sampleJsonPayload: samplePayload
        }
      },
      companion: {
        config: { ...data.companionConfig },
        running: companionSnapshot.running,
        actualPort: companionSnapshot.actualPort,
        bonjourActive: companionSnapshot.bonjourActive,
        bonjourServiceType: companionSnapshot.bonjourServiceType,
        urls: urlsInfo.urls,
        bonjourUrl: urlsInfo.bonjourUrl,
        primaryPairUrl: urlsInfo.primaryPairUrl,
        pairingCode: data.companionPairingCode,
        connectedClients: companionSnapshot.connectedClients,
        lastClientSeenAt: companionSnapshot.lastClientSeenAt,
        lastError: companionSnapshot.lastError
      },
      inbox: [...data.inbox],
      recentActivity: [...data.recentActivity]
    };
  }

  // --- Option C: Safari Bridge ---

  public async discoverSafari(customBookmarksFilePath?: string): Promise<SafariDiscoveryResult> {
    return discoverSafariData(customBookmarksFilePath);
  }

  public async pickBookmarksFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: "Select Safari Bookmarks File",
      properties: ["openFile"],
      filters: [
        { name: "Safari Bookmarks", extensions: ["plist", "html", "htm"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0] ?? null;
  }

  public async importFromSafari(options: SafariImportOptions): Promise<SafariImportResult> {
    const result = await importFromSafari(options);
    const parts: string[] = [];
    if (result.tabsOpened > 0) parts.push(`${result.tabsOpened} tabs`);
    if (result.tabsQueuedForOnboarding > 0) parts.push(`${result.tabsQueuedForOnboarding} queued tabs`);
    if (result.favouritesAdded > 0) parts.push(`${result.favouritesAdded} favourites`);
    if (result.historyEntriesImported > 0) parts.push(`${result.historyEntriesImported} history items`);

    if (parts.length > 0) {
      await appendSyncActivity(
        "safari",
        `Imported ${parts.join(", ")} from Safari into "${result.targetSpaceName || "Space"}"`,
        "success"
      );
    } else if (result.errors.length > 0) {
      await appendSyncActivity("safari", result.errors[0]!, "warning");
    }

    this.scheduleStateEmit();
    void this.companionServer.broadcastState();
    return result;
  }

  public async openInSafari(url: string): Promise<boolean> {
    const ok = await openUrlInSafari(url);
    if (ok) {
      await appendSyncActivity("safari", `Sent link to Safari: ${url}`, "info");
      this.scheduleStateEmit();
    }
    return ok;
  }

  public async updateSafariLiveSync(updates: Partial<SafariLiveSyncConfig>): Promise<SafariSyncState> {
    await saveSafariSyncData((data) => {
      data.safariLiveSync = {
        ...data.safariLiveSync,
        ...updates,
        pollIntervalSec: Math.max(
          5,
          Math.min(300, Number(updates.pollIntervalSec ?? data.safariLiveSync.pollIntervalSec) || 15)
        )
      };
    });

    await this.configureSafariLiveSync();
    const state = await this.getState();
    this.emit("state-changed", state);
    return state;
  }

  private async configureSafariLiveSync(): Promise<void> {
    if (this.safariLiveTimer) {
      clearInterval(this.safariLiveTimer);
      this.safariLiveTimer = null;
    }

    if (process.platform !== "darwin") return;
    const data = await loadSafariSyncData();
    if (!data.safariLiveSync.enabled) return;

    const pollMs = Math.max(5, data.safariLiveSync.pollIntervalSec || 15) * 1000;
    this.safariLiveTimer = setInterval(() => {
      void this.syncSafariOpenTabsNow(true);
    }, pollMs);
  }

  public async syncSafariOpenTabsNow(backgroundPoll = false): Promise<{ importedCount: number; error?: string }> {
    if (process.platform !== "darwin") {
      return { importedCount: 0, error: "Safari Live Sync is only available on macOS." };
    }

    const data = await loadSafariSyncData();
    const tabsRes = await readSafariOpenTabs();
    if (!tabsRes.running) {
      return { importedCount: 0 };
    }
    if (tabsRes.automationError) {
      if (!backgroundPoll) {
        await appendSyncActivity("safari", tabsRes.automationError, "warning");
        this.scheduleStateEmit();
      }
      return { importedCount: 0, error: tabsRes.automationError };
    }

    const windows = browserWindowsController
      .getWindows()
      .filter((w) => !w.destroyed && w.browserWindowType === "normal");
    if (windows.length === 0) {
      return { importedCount: 0 };
    }

    const profileId = data.safariLiveSync.profileId || "main";
    const resolved = await resolveOrCreateTargetSpace(
      profileId,
      data.safariLiveSync.targetSpaceId,
      !data.safariLiveSync.targetSpaceId
    );
    if (!resolved) {
      return { importedCount: 0, error: "No target Space available." };
    }

    const existingSpaceUrls = new Set(
      tabsController
        .getTabsInSpace(resolved.spaceId)
        .map((t) => t.url)
        .filter(Boolean)
    );

    const newItems = tabsRes.tabs.filter((t) => {
      if (existingSpaceUrls.has(t.url)) return false;
      if (backgroundPoll && this.seenLiveSafariUrls.has(t.url)) return false;
      return true;
    });

    for (const t of tabsRes.tabs) {
      this.seenLiveSafariUrls.add(t.url);
    }

    let importedCount = 0;
    if (newItems.length > 0) {
      const res = await openUrlsInLumiSpace({
        profileId: resolved.profileId,
        spaceId: resolved.spaceId,
        items: newItems.map((t) => ({ url: t.url, title: t.title })),
        activateFirst: !backgroundPoll
      });
      importedCount = res.openedNow;
    }

    await saveSafariSyncData((curr) => {
      curr.safariLiveSync.lastSyncedAt = Date.now();
      curr.safariLiveSync.lastImportedCount = importedCount;
    });

    if (importedCount > 0) {
      await appendSyncActivity(
        "safari",
        `Synced ${importedCount} open Safari tab${importedCount === 1 ? "" : "s"} to "${resolved.spaceName}"`,
        "success"
      );
    }

    this.scheduleStateEmit();
    return { importedCount };
  }

  public async openMacPrivacySettings(pane: "automation" | "full-disk-access"): Promise<boolean> {
    if (process.platform !== "darwin") return false;
    if (pane === "full-disk-access") {
      // Trigger direct main-process open()/readdir() syscalls on ~/Library/Safari so macOS
      // TCC logs the access attempt before System Settings opens.
      await probeSafariFullDiskAccess().catch(() => false);
    }
    const url =
      pane === "automation"
        ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
        : "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";
    try {
      await shell.openExternal(url);
      return true;
    } catch {
      return false;
    }
  }

  public revealAppBundle(): boolean {
    if (process.platform !== "darwin") return false;
    const bundlePath = app.isPackaged ? path.resolve(process.execPath, "..", "..", "..") : process.execPath;
    shell.showItemInFolder(bundlePath);
    return true;
  }

  // --- Option A: iCloud Drive Sync ---

  public async updateICloudConfig(updates: Partial<ICloudSyncConfig>): Promise<SafariSyncState> {
    await saveSafariSyncData((data) => {
      data.icloudConfig = {
        ...data.icloudConfig,
        ...updates,
        syncIntervalSec: Math.max(
          15,
          Math.min(3600, Number(updates.syncIntervalSec ?? data.icloudConfig.syncIntervalSec) || 60)
        )
      };
    });

    await this.icloudEngine.configureAutoSync();
    const updated = await loadSafariSyncData();
    if (updated.icloudConfig.enabled && getStoredPassphrase(updated)) {
      void this.icloudEngine.syncNow();
    }

    const state = await this.getState();
    this.emit("state-changed", state);
    return state;
  }

  public async setICloudPassphrase(passphrase: string): Promise<{ success: boolean; error?: string }> {
    const trimmed = passphrase.trim();
    if (trimmed.length > 0 && trimmed.length < 4) {
      return { success: false, error: "Passphrase must be at least 4 characters." };
    }
    await setStoredPassphrase(trimmed);
    await saveSafariSyncData((data) => {
      data.icloudLastError = undefined;
    });
    this.scheduleStateEmit();
    return { success: true };
  }

  public async generateICloudPassphrase(): Promise<string> {
    const generated = generateStrongPassphrase();
    await setStoredPassphrase(generated);
    await saveSafariSyncData((data) => {
      data.icloudLastError = undefined;
    });
    await appendSyncActivity("icloud", "Generated new AES-256 sync passphrase", "info");
    this.scheduleStateEmit();
    return generated;
  }

  public async revealICloudPassphrase(): Promise<string | null> {
    const data = await loadSafariSyncData();
    return getStoredPassphrase(data);
  }

  public async pickICloudDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: "Choose Sync Directory (iCloud Drive or Cloud Folder)",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const chosen = result.filePaths[0]!;
    await this.updateICloudConfig({ customDirectory: chosen });
    return chosen;
  }

  public async revealICloudDirectory(): Promise<boolean> {
    const data = await loadSafariSyncData();
    const dir = resolveICloudSyncDirectory(data.icloudConfig.customDirectory);
    try {
      await import("fs/promises").then((fsP) => fsP.mkdir(dir, { recursive: true }));
      const err = await shell.openPath(dir);
      return err === "";
    } catch {
      return false;
    }
  }

  public async syncICloudNow(): Promise<{ success: boolean; error?: string }> {
    return this.icloudEngine.syncNow();
  }

  public async openRemoteDeviceTab(url: string, spaceId?: string): Promise<boolean> {
    if (!isHttpOrHttpsUrl(url)) return false;
    const windows = browserWindowsController
      .getWindows()
      .filter((w) => !w.destroyed && w.browserWindowType === "normal");
    const targetWindow =
      browserWindowsController.getFocusedWindow() || windows[0] || (await browserWindowsController.create());
    const targetSpaceId = spaceId || targetWindow.currentSpaceId || (await spacesController.getLastUsed())?.id;
    if (!targetSpaceId) return false;
    const space = await spacesController.get(targetSpaceId);
    const tab = await tabsController.createTab(targetWindow.id, space?.profileId, targetSpaceId, undefined, { url });
    targetWindow.show(true);
    tabsController.activateTab(tab);
    return true;
  }

  public async openAllRemoteDeviceTabs(deviceId: string, createSpace = true): Promise<number> {
    const data = await loadSafariSyncData();
    const remote = data.remoteDevices.find((d) => d.deviceId === deviceId);
    if (!remote || remote.openTabs.length === 0) return 0;

    let targetProfileId = "main";
    let targetSpaceId: string | undefined;

    if (createSpace) {
      const spaceName = remote.deviceName.trim() || "Synced Device";
      const existingSpaces = await spacesController.getAllFromProfile(targetProfileId);
      const match = existingSpaces.find((s) => s.name.toLowerCase() === spaceName.toLowerCase());
      if (match) {
        targetSpaceId = match.id;
      } else {
        const created = await spacesController.create(targetProfileId, spaceName, {
          bgStartColor: "#6366F1",
          bgEndColor: "#8B5CF6"
        });
        if (created) {
          const refreshed = await spacesController.getAllFromProfile(targetProfileId);
          const createdSpace = refreshed.find((s) => s.name === spaceName);
          if (createdSpace) {
            targetSpaceId = createdSpace.id;
            await spacesController.update(targetProfileId, createdSpace.id, { icon: "Devices" }).catch(() => {});
          }
        }
      }
    }

    if (!targetSpaceId) {
      const last = await spacesController.getLastUsed();
      if (!last) return 0;
      targetProfileId = last.profileId;
      targetSpaceId = last.id;
    }

    const res = await openUrlsInLumiSpace({
      profileId: targetProfileId,
      spaceId: targetSpaceId,
      items: remote.openTabs.map((t) => ({ url: t.url, title: t.title })),
      activateFirst: true
    });

    await appendSyncActivity(
      "icloud",
      `Opened ${res.openedNow} synced tab${res.openedNow === 1 ? "" : "s"} from ${remote.deviceName}`,
      "success"
    );
    this.scheduleStateEmit();
    return res.openedNow;
  }

  // --- Option B: Local Wi-Fi / Bonjour Companion ---

  public async updateCompanionConfig(updates: Partial<LocalCompanionConfig>): Promise<SafariSyncState> {
    const prevData = await loadSafariSyncData();
    const nextConfig: LocalCompanionConfig = {
      ...prevData.companionConfig,
      ...updates,
      port: Math.max(1024, Math.min(65535, Number(updates.port ?? prevData.companionConfig.port) || 48123))
    };

    await saveSafariSyncData((data) => {
      data.companionConfig = nextConfig;
    });

    if (nextConfig.enabled) {
      await this.companionServer.start();
    } else {
      await this.companionServer.stop();
    }

    const state = await this.getState();
    this.emit("state-changed", state);
    return state;
  }

  public async regenerateCompanionPairing(): Promise<SafariSyncState> {
    await saveSafariSyncData((data) => {
      data.companionPairingToken = generatePairingToken();
      data.companionPairingCode = generatePairingCode();
    });
    await appendSyncActivity("companion", "Rotated companion pairing code & access token", "info");

    const data = await loadSafariSyncData();
    if (data.companionConfig.enabled) {
      await this.companionServer.start();
    }

    const state = await this.getState();
    this.emit("state-changed", state);
    return state;
  }

  // --- Incoming Links & Sync Inbox ---

  private async handleCompanionIncomingLink(link: CompanionIncomingLink): Promise<void> {
    const data = await loadSafariSyncData();
    let status: SyncInboxLink["status"] = "pending";

    if (link.mode === "open" || (link.mode === "inbox" && data.companionConfig.autoOpenReceivedLinks)) {
      await this.openRemoteDeviceTab(link.url, link.spaceId);
      status = "opened";
      await appendSyncActivity("companion", `Opened link from ${link.deviceName}: ${link.title}`, "success");
    } else if (link.mode === "favourite") {
      await addFavourite(link.title, link.url);
      status = "saved";
      await appendSyncActivity("companion", `Saved favourite from ${link.deviceName}: ${link.title}`, "success");
    } else {
      await appendSyncActivity("companion", `Received link in inbox from ${link.deviceName}: ${link.title}`, "info");
    }

    await saveSafariSyncData((curr) => {
      curr.inbox = [
        {
          id: randomUUID(),
          url: link.url,
          title: link.title,
          sourceDevice: link.deviceName,
          sourceChannel: "companion" as const,
          receivedAt: Date.now(),
          status
        },
        ...curr.inbox
      ].slice(0, 100);
    });

    this.scheduleStateEmit();
  }

  private async handleICloudInboxDrops(drops: ReceivedInboxDrop[]): Promise<void> {
    const data = await loadSafariSyncData();
    const autoOpen = data.icloudConfig.autoOpenInboxLinks;

    const newLinks: SyncInboxLink[] = [];
    for (const drop of drops) {
      let status: SyncInboxLink["status"] = "pending";
      if (autoOpen) {
        const opened = await this.openRemoteDeviceTab(drop.url);
        if (opened) status = "opened";
      }
      newLinks.push({
        id: randomUUID(),
        url: drop.url,
        title: drop.title,
        sourceDevice: drop.sourceDevice,
        sourceChannel: "icloud-inbox",
        receivedAt: Date.now(),
        status
      });
    }

    await saveSafariSyncData((curr) => {
      curr.inbox = [...newLinks, ...curr.inbox].slice(0, 100);
    });

    if (newLinks.length > 0) {
      await appendSyncActivity(
        "inbox",
        `Received ${newLinks.length} link${newLinks.length === 1 ? "" : "s"} from iCloud Shortcut inbox`,
        "success"
      );
      this.scheduleStateEmit();
    }
  }

  public async openInboxLink(linkId: string, spaceId?: string): Promise<boolean> {
    const data = await loadSafariSyncData();
    const item = data.inbox.find((entry) => entry.id === linkId);
    if (!item) return false;

    const ok = await this.openRemoteDeviceTab(item.url, spaceId);
    if (!ok) return false;

    await saveSafariSyncData((curr) => {
      const target = curr.inbox.find((entry) => entry.id === linkId);
      if (target) target.status = "opened";
    });
    this.scheduleStateEmit();
    return true;
  }

  public async saveInboxLinkToFavourites(linkId: string): Promise<boolean> {
    const data = await loadSafariSyncData();
    const item = data.inbox.find((entry) => entry.id === linkId);
    if (!item) return false;

    await addFavourite(item.title, item.url);
    await saveSafariSyncData((curr) => {
      const target = curr.inbox.find((entry) => entry.id === linkId);
      if (target) target.status = "saved";
    });
    await appendSyncActivity("inbox", `Saved "${item.title}" to Favourites`, "success");
    this.scheduleStateEmit();
    return true;
  }

  public async dismissInboxLink(linkId: string): Promise<boolean> {
    await saveSafariSyncData((curr) => {
      curr.inbox = curr.inbox.filter((entry) => entry.id !== linkId);
    });
    this.scheduleStateEmit();
    return true;
  }

  public async clearInbox(): Promise<boolean> {
    await saveSafariSyncData((curr) => {
      curr.inbox = [];
    });
    this.scheduleStateEmit();
    return true;
  }

  // --- Onboarding Deferred Tab Flush ---

  public async flushPendingOnboardingTabs(window: BrowserWindow): Promise<void> {
    const data = await loadSafariSyncData();
    if (data.pendingOnboardingTabs.length === 0) return;

    const pending = [...data.pendingOnboardingTabs];
    await saveSafariSyncData((curr) => {
      curr.pendingOnboardingTabs = [];
    });

    try {
      let firstTab: Awaited<ReturnType<typeof tabsController.createTab>> | null = null;
      let firstSpaceId: string | null = null;

      for (let i = 0; i < pending.length; i++) {
        const item = pending[i]!;
        if (!isHttpOrHttpsUrl(item.url)) continue;

        const spaceExists = await spacesController.get(item.spaceId);
        const targetSpaceId = spaceExists
          ? item.spaceId
          : window.currentSpaceId || (await spacesController.getLastUsed())?.id;
        if (!targetSpaceId) continue;

        const spaceData = spaceExists || (await spacesController.get(targetSpaceId));
        const profileId = spaceData?.profileId || item.profileId || "main";

        const created = await tabsController.createTab(
          window.id,
          profileId,
          targetSpaceId,
          undefined,
          i === 0
            ? { url: item.url, title: item.title }
            : {
                asleep: true,
                title: item.title,
                navHistory: [{ url: item.url, title: item.title }],
                navHistoryIndex: 0
              }
        );

        if (!firstTab) {
          firstTab = created;
          firstSpaceId = targetSpaceId;
        }
      }

      if (firstTab && firstSpaceId) {
        if (window.currentSpaceId !== firstSpaceId) {
          window.setCurrentSpace(firstSpaceId);
        }
        tabsController.activateTab(firstTab);
      }

      debugPrint("SAFARI_SYNC", `Flushed ${pending.length} onboarding Safari tabs into new window`);
    } catch (error) {
      debugError("SAFARI_SYNC", "Failed flushing pending onboarding tabs:", error);
    }
  }
}

export const safariSyncController = new SafariSyncController();
