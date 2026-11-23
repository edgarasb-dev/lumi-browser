import { debugError, debugPrint } from "@/modules/output";
import { TypedEventEmitter } from "@/modules/typed-event-emitter";
import { sleep } from "@/modules/utils";
import { getVersionUpdatedFrom, markPreserveSessionForRestart, markUpdateStarted } from "@/saving/ephemeral";
import { quitController } from "@/controllers/quit-controller";
import { getSettingValueById, onSettingsCached, settingsEmitter } from "@/saving/settings";
import { app } from "electron";
import { autoUpdater, ProgressInfo, UpdateInfo, UpdateCheckResult } from "electron-updater";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import { UpdateStatus } from "~/types/updates";
import {
  checkMacAdhocEligibility,
  downloadAndVerifyMacZip,
  prepareAndLaunchMacAdhocInstall,
  selectMacZipAsset
} from "./mac-adhoc-updater";

// Mock Data //
type MockUpdateData = {
  version: `${number}.${number}.${number}`;
  isSupported: boolean;
  dataPerInterval: number; // Bytes per interval
  transportInterval: number; // Milliseconds
  fileSize: number; // Bytes
  timeForUpdateCheck: number; // Milliseconds
};

const MOCK_DATA_ENABLED = false;

const MOCK_DATA: MockUpdateData = {
  version: "1.0.1", // Example: Ensure this is different from current app version for testing
  isSupported: true,
  dataPerInterval: 100 * 1024, // 100 KB per interval
  transportInterval: 50, // 50 ms interval
  fileSize: 10 * 1024 * 1024, // 10 MB
  timeForUpdateCheck: 500 // 500 milliseconds
};

// Constants //
const SUPPORTED_PLATFORMS: NodeJS.Platform[] = ["win32", "linux", "darwin"];

function isPendingReleaseManifestError(message: string): boolean {
  return (
    message.includes("ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") ||
    message.includes("ERR_UPDATER_LATEST_VERSION_NOT_FOUND") ||
    message.includes("ERR_UPDATER_NO_PUBLISHED_VERSIONS") ||
    /Cannot find latest[^ ]*\.yml in the latest release artifacts/i.test(message) ||
    (/HttpError:\s*404\b/i.test(message) && /releases\/(download|latest)/i.test(message))
  );
}

type AutoUpdateControllerEvents = {
  "status-changed": [];
};

export class AutoUpdateController extends TypedEventEmitter<AutoUpdateControllerEvents> {
  public hasUpdated: boolean = false;
  private availableUpdate: UpdateInfo | null = null;
  private downloadProgress: ProgressInfo | null = null;
  private updateDownloaded: boolean = false;
  private lastError: string | null = null;
  private lastChecked: number | null = null;
  private mockDownloadIntervalId: NodeJS.Timeout | null = null;
  private mockBytesDownloaded: number = 0;
  private isDownloadingAdhoc: boolean = false;
  private adhocDownloadedUpdate: { version: string; zipPath: string; sha512: string } | null = null;
  private macCodeSignedCache: boolean | null = null;
  private macCodeSignedCheckPromise: Promise<boolean> | null = null;
  private initialCheckTimer: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;

  private async checkMacCodeSignedAsync(): Promise<boolean> {
    if (this.macCodeSignedCache !== null) {
      return this.macCodeSignedCache;
    }
    if (this.macCodeSignedCheckPromise) {
      return this.macCodeSignedCheckPromise;
    }

    if (process.platform !== "darwin") {
      this.macCodeSignedCache = true;
      return true;
    }
    if (!app.isPackaged) {
      this.macCodeSignedCache = false;
      return false;
    }

    this.macCodeSignedCheckPromise = execFileAsync("codesign", ["-dvvv", process.execPath], {
      encoding: "utf8"
    })
      .then(({ stderr }) => {
        // Squirrel.Mac requires an official Apple Developer ID certificate, not adhoc
        const signed = !stderr.includes("Signature=adhoc") && stderr.includes("Authority=Developer ID");
        this.macCodeSignedCache = signed;
        return signed;
      })
      .catch((error: { stderr?: string } | unknown) => {
        const stderr =
          error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
            ? error.stderr
            : "";
        const signed =
          stderr.length > 0 && !stderr.includes("Signature=adhoc") && stderr.includes("Authority=Developer ID");
        this.macCodeSignedCache = signed;
        return signed;
      })
      .finally(() => {
        this.macCodeSignedCheckPromise = null;
      });

    return this.macCodeSignedCheckPromise;
  }

  private isMacCodeSigned(): boolean {
    return this.macCodeSignedCache ?? false;
  }

  private shouldUseAdhocMacSelfUpdater(): boolean {
    if (MOCK_DATA_ENABLED) return false;
    if (process.platform !== "darwin") return false;
    if (process.env["FLATPAK_ID"]) return false;
    if (!app.isPackaged) return false;
    return !this.isMacCodeSigned();
  }

  public isAutoUpdateSupported(platform: NodeJS.Platform): boolean {
    if (MOCK_DATA_ENABLED) return MOCK_DATA.isSupported;

    // Flatpak updates are managed by the Flatpak runtime, not electron-updater
    if (process.env["FLATPAK_ID"]) return false;

    if (platform === "darwin") {
      if (this.isMacCodeSigned()) return true;
      return checkMacAdhocEligibility().eligible;
    }

    return SUPPORTED_PLATFORMS.includes(platform);
  }

  public async checkForUpdates(): Promise<UpdateCheckResult | null> {
    if (this.initialCheckTimer) {
      clearTimeout(this.initialCheckTimer);
      this.initialCheckTimer = null;
    }
    await this.checkMacCodeSignedAsync();

    if (MOCK_DATA_ENABLED) {
      debugPrint("AUTO_UPDATER", "[MOCK] Checking for updates");

      // Simulate a delay
      await sleep(MOCK_DATA.timeForUpdateCheck);

      // Simulate finding an update based on mock data
      const mockUpdateInfo: UpdateInfo = {
        version: MOCK_DATA.version,
        files: [{ url: "mock.zip", size: MOCK_DATA.fileSize, sha512: "mock-sha512-zip" }],
        path: "mock.zip", // Path might not be relevant for mock, but required by type
        sha512: "mock-sha512", // Required by type
        releaseDate: new Date().toISOString() // Required by type
        // Add other fields required by UpdateInfo if necessary, e.g., releaseName, releaseNotes
      };
      this.availableUpdate = mockUpdateInfo;
      this.lastError = null;
      this.lastChecked = Date.now();
      this.emit("status-changed");
      debugPrint("AUTO_UPDATER", "[MOCK] Update Available", mockUpdateInfo);
      return Promise.resolve({
        isUpdateAvailable: true,
        updateInfo: mockUpdateInfo,
        versionInfo: mockUpdateInfo
      });
    }

    if (this.isChecking) {
      return null;
    }

    this.isChecking = true;
    try {
      this.lastError = null;
      debugPrint("AUTO_UPDATER", "Checking for updates...");
      const result: UpdateCheckResult | null = await autoUpdater.checkForUpdates();
      this.lastChecked = Date.now();
      if (!result?.isUpdateAvailable) {
        this.availableUpdate = null;
        this.adhocDownloadedUpdate = null;
      } else if (
        this.shouldUseAdhocMacSelfUpdater() &&
        getSettingValueById("autoUpdate") === true &&
        this.isAutoUpdateSupported(process.platform) &&
        !this.isDownloadingAdhoc &&
        !this.updateDownloaded
      ) {
        // Trigger verified .zip self-updater automatically instead of Squirrel.Mac
        this.downloadUpdate();
      }
      this.emit("status-changed");
      return result;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.downloadProgress = null;
      this.lastChecked = Date.now();
      if (isPendingReleaseManifestError(errorMsg)) {
        debugPrint("AUTO_UPDATER", "Release manifest not published yet; treating as up to date");
        this.availableUpdate = null;
        this.lastError = null;
      } else {
        debugError("AUTO_UPDATER", "Check for updates failed:", errorMsg);
        this.lastError = errorMsg;
      }
      this.emit("status-changed");
      return null;
    } finally {
      this.isChecking = false;
    }
  }

  private connectUpdaterListeners() {
    autoUpdater.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (isPendingReleaseManifestError(message) && !this.downloadProgress && !this.isDownloadingAdhoc) {
        debugPrint("AUTO_UPDATER", "Ignoring pending release manifest 404 during update check");
        this.availableUpdate = null;
        this.lastError = null;
        this.emit("status-changed");
        return;
      }
      debugError("AUTO_UPDATER", "Auto-updater error:", message);
      this.downloadProgress = null;
      this.lastError = message;
      this.emit("status-changed");
    });

    autoUpdater.on("update-available", (updateInfo) => {
      debugPrint("AUTO_UPDATER", "Update Available", updateInfo);
      if (this.availableUpdate?.version !== updateInfo.version) {
        this.updateDownloaded = false;
        this.downloadProgress = null;
        this.adhocDownloadedUpdate = null;
      }
      this.availableUpdate = updateInfo;
      this.lastError = null;
      this.emit("status-changed");
    });

    autoUpdater.on("update-not-available", (updateInfo) => {
      debugPrint("AUTO_UPDATER", "Update Not Available", updateInfo);
      this.availableUpdate = null;
      this.downloadProgress = null;
      this.updateDownloaded = false;
      this.adhocDownloadedUpdate = null;
      this.lastError = null;
      this.emit("status-changed");
    });

    autoUpdater.on("download-progress", (progress) => {
      debugPrint("AUTO_UPDATER", "Download Progress", progress);
      this.downloadProgress = progress;
      this.lastError = null;
      this.emit("status-changed");
    });

    autoUpdater.on("update-downloaded", (updateInfo) => {
      debugPrint("AUTO_UPDATER", "Update Downloaded", updateInfo);
      this.availableUpdate = updateInfo;
      this.downloadProgress = null;
      this.updateDownloaded = true;
      this.lastError = null;
      this.emit("status-changed");
    });
  }

  public getUpdateStatus(): UpdateStatus {
    return {
      availableUpdate: this.availableUpdate,
      downloadProgress: this.downloadProgress,
      updateDownloaded: this.updateDownloaded,
      error: this.lastError,
      lastChecked: this.lastChecked
    };
  }

  public downloadUpdate(): boolean {
    if (MOCK_DATA_ENABLED) {
      if (this.downloadProgress || this.updateDownloaded || !this.availableUpdate) {
        debugPrint(
          "AUTO_UPDATER",
          "[MOCK] Download not started (already in progress, downloaded, or no update available)"
        );
        return false;
      }

      debugPrint("AUTO_UPDATER", "[MOCK] Starting download simulation");
      this.mockBytesDownloaded = 0;
      this.downloadProgress = {
        // Initial progress state
        bytesPerSecond: 0,
        percent: 0,
        total: MOCK_DATA.fileSize,
        transferred: 0,
        delta: 0 // Add delta field
      };
      this.emit("status-changed"); // Notify UI that download started

      this.mockDownloadIntervalId = setInterval(() => {
        this.mockBytesDownloaded += MOCK_DATA.dataPerInterval;
        this.mockBytesDownloaded = Math.min(this.mockBytesDownloaded, MOCK_DATA.fileSize);

        const percent = (this.mockBytesDownloaded / MOCK_DATA.fileSize) * 100;
        // Approximate bytesPerSecond based on interval data transfer
        const bytesPerSecond = MOCK_DATA.dataPerInterval / (MOCK_DATA.transportInterval / 1000);

        this.downloadProgress = {
          bytesPerSecond,
          percent,
          total: MOCK_DATA.fileSize,
          transferred: this.mockBytesDownloaded,
          delta: MOCK_DATA.dataPerInterval // Add delta field
        };
        debugPrint("AUTO_UPDATER", "[MOCK] Download Progress", this.downloadProgress);
        this.emit("status-changed");

        if (this.mockBytesDownloaded >= MOCK_DATA.fileSize) {
          if (this.mockDownloadIntervalId) {
            clearInterval(this.mockDownloadIntervalId);
            this.mockDownloadIntervalId = null;
          }
          this.downloadProgress = null;
          this.updateDownloaded = true;
          debugPrint("AUTO_UPDATER", "[MOCK] Update Downloaded", this.availableUpdate);
          this.emit("status-changed"); // Final status update for downloaded
        }
      }, MOCK_DATA.transportInterval);

      return true;
    }

    // Real download logic
    if (
      this.downloadProgress ||
      this.isDownloadingAdhoc ||
      this.updateDownloaded ||
      !this.isAutoUpdateSupported(process.platform)
    ) {
      return false;
    }

    if (this.shouldUseAdhocMacSelfUpdater()) {
      const updateInfo = this.availableUpdate;
      if (!updateInfo) {
        return false;
      }

      const eligibility = checkMacAdhocEligibility();
      if (!eligibility.eligible) {
        this.lastError = eligibility.reason || "Automatic updates are unavailable in this location";
        this.emit("status-changed");
        return false;
      }

      const asset = selectMacZipAsset(updateInfo);
      if (!asset) {
        this.lastError = "No SHA-512-verified macOS update archive found for this architecture";
        this.emit("status-changed");
        return false;
      }

      this.isDownloadingAdhoc = true;
      this.lastError = null;
      this.downloadProgress = {
        bytesPerSecond: 0,
        percent: 0,
        total: asset.size ?? 0,
        transferred: 0,
        delta: 0
      };
      this.emit("status-changed");

      downloadAndVerifyMacZip(asset, updateInfo.version, (progress) => {
        this.downloadProgress = progress;
        this.lastError = null;
        this.emit("status-changed");
      })
        .then((zipPath) => {
          this.isDownloadingAdhoc = false;
          this.downloadProgress = null;
          this.updateDownloaded = true;
          this.adhocDownloadedUpdate = {
            version: updateInfo.version,
            zipPath,
            sha512: asset.sha512
          };
          this.lastError = null;
          debugPrint("AUTO_UPDATER", "Verified ad-hoc macOS update archive:", zipPath);
          this.emit("status-changed");
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          debugError("AUTO_UPDATER", "Ad-hoc macOS download failed:", message);
          this.isDownloadingAdhoc = false;
          this.downloadProgress = null;
          this.updateDownloaded = false;
          this.adhocDownloadedUpdate = null;
          this.lastError = message;
          this.emit("status-changed");
        });

      return true;
    }

    autoUpdater.downloadUpdate().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      debugError("AUTO_UPDATER", "Download update failed:", message);
      this.downloadProgress = null;
      this.lastError = message;
      this.emit("status-changed");
    });
    return true;
  }

  public async installUpdate(): Promise<boolean> {
    if (!this.updateDownloaded) {
      return false;
    }

    if (this.shouldUseAdhocMacSelfUpdater()) {
      const downloaded = this.adhocDownloadedUpdate;
      if (!downloaded) {
        return false;
      }

      try {
        await prepareAndLaunchMacAdhocInstall({
          zipPath: downloaded.zipPath,
          sha512: downloaded.sha512,
          expectedVersion: downloaded.version,
          onBeforeQuit: async () => {
            await markUpdateStarted(app.getVersion());
            await markPreserveSessionForRestart();
            await quitController.prepareForUpdateRestart();
          }
        });
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        debugError("AUTO_UPDATER", "Ad-hoc macOS install failed:", message);
        this.updateDownloaded = false;
        this.adhocDownloadedUpdate = null;
        this.lastError = message;
        this.emit("status-changed");
        return false;
      }
    }

    await markUpdateStarted(app.getVersion());
    await markPreserveSessionForRestart();
    await quitController.prepareForUpdateRestart();
    autoUpdater.quitAndInstall();
    return true;
  }

  private async updateAutoUpdaterConfig() {
    const autoUpdate = getSettingValueById("autoUpdate") as boolean | undefined;
    const canAutoUpdate = this.isAutoUpdateSupported(process.platform);
    // Keep electron-updater autoDownload disabled for ad-hoc macOS so Squirrel.Mac is never invoked;
    // AutoUpdateController handles downloading and verifying the .zip directly instead.
    autoUpdater.autoDownload = autoUpdate === true && canAutoUpdate && !this.shouldUseAdhocMacSelfUpdater();
  }

  public async initialize() {
    // Configure autoUpdater logger
    autoUpdater.logger = {
      info: (msg: string) => debugPrint("AUTO_UPDATER", msg),
      warn: (msg: string) => debugPrint("AUTO_UPDATER", `[WARN] ${msg}`),
      error: (msg: string) => debugError("AUTO_UPDATER", msg),
      debug: (msg: string) => debugPrint("AUTO_UPDATER", `[DEBUG] ${msg}`)
    };

    // Configure update settings
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;

    if (!app.isPackaged) {
      autoUpdater.forceDevUpdateConfig = true;
    }

    try {
      autoUpdater.setFeedURL({
        provider: "github",
        owner: "edgarasb-dev",
        repo: "lumi-browser",
        releaseType: "release"
      });
    } catch (err) {
      debugError("AUTO_UPDATER", "Failed to set default feed URL:", err);
    }

    const codeSignCheck = this.checkMacCodeSignedAsync();
    await Promise.all([onSettingsCached(), codeSignCheck]);

    // Update Auto Updater Config
    await this.updateAutoUpdaterConfig();

    settingsEmitter.on("settings-changed", () => {
      this.updateAutoUpdaterConfig();
    });

    // Ensure manual quit while an update is downloaded also marks session preservation
    quitController.registerBeforeQuitPrep(async () => {
      if (this.updateDownloaded) {
        await markUpdateStarted(app.getVersion());
        await markPreserveSessionForRestart();
      }
    });

    // Run after App Ready
    await app.whenReady();

    // Connect Listeners and start interval only if not using mock data
    if (!MOCK_DATA_ENABLED) {
      this.connectUpdaterListeners();
    }

    // Defer initial update check briefly so it does not compete with cold startup / first window load
    this.initialCheckTimer = setTimeout(() => {
      this.initialCheckTimer = null;
      void this.checkForUpdates();
    }, 4000);

    // Check periodically every 5 minutes in the background
    setInterval(
      () => {
        void this.checkForUpdates();
      },
      1000 * 60 * 5
    );

    // Also check when a Lumi window regains focus if at least 2 minutes have passed since the last check
    app.on("browser-window-focus", () => {
      if (this.isChecking || this.isDownloadingAdhoc || this.downloadProgress || this.updateDownloaded) {
        return;
      }
      const elapsed = Date.now() - (this.lastChecked ?? 0);
      if (elapsed >= 1000 * 60 * 2) {
        void this.checkForUpdates();
      }
    });
  }
}

// Create and export singleton instance
export const autoUpdateController = new AutoUpdateController();

// Initialize the controller
autoUpdateController.initialize();

// Check for pending update
getVersionUpdatedFrom()
  .catch(() => undefined)
  .then((updatedFromVersion) => {
    if (updatedFromVersion) {
      debugPrint("AUTO_UPDATER", `Update from version ${updatedFromVersion}`);
      const currentVersion = app.getVersion();
      if (currentVersion !== updatedFromVersion) {
        autoUpdateController.hasUpdated = true;
      }
    }
  });
