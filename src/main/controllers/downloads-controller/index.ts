import fs from "fs";
import path from "path";
import { app, DownloadItem, Session, session as electronSession, shell } from "electron";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/saving/db";
import { generateID } from "@/modules/utils";
import { isIncognitoProfileId } from "@/modules/incognito/utils";
import { sendMessageToListeners } from "@/ipc/listeners-manager";
import { quitController } from "@/controllers/quit-controller";
import { sessionsController } from "@/controllers/sessions-controller";
import type { DownloadEvent, DownloadItemData, DownloadState } from "~/types/downloads";

type ActiveDownloadTracker = {
  item: DownloadItem;
  lastBytes: number;
  lastSampleTime: number;
  smoothedSpeed: number;
};

const BROADCAST_THROTTLE_MS = 120;
const SPEED_SAMPLE_MIN_MS = 220;

function getUniqueDownloadPath(directory: string, rawFilename: string): string {
  const safeBase = path.basename(rawFilename || "download").replace(/[<>:"/\\|?*\0]/g, "_") || "download";
  const ext = path.extname(safeBase);
  const stem = safeBase.slice(0, safeBase.length - ext.length) || "download";

  let candidate = path.join(directory, safeBase);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${stem} (${counter})${ext}`);
    counter++;
  }
  return candidate;
}

class DownloadsController {
  private downloads = new Map<string, DownloadItemData>();
  private activeItems = new Map<string, ActiveDownloadTracker>();
  private attachedSessions = new WeakSet<Session>();
  private broadcastTimeout: NodeJS.Timeout | null = null;
  private loaded = false;

  loadAll(): void {
    if (this.loaded) return;
    this.loaded = true;

    const db = getDb();
    const rows = db.select().from(schema.downloads).orderBy(desc(schema.downloads.startTime)).all();

    this.downloads.clear();
    for (const row of rows) {
      // Any download interrupted by a prior crash/quit is no longer running
      const normalizedState: DownloadState =
        row.state === "progressing" || row.state === "paused" ? "interrupted" : row.state;

      if (normalizedState !== row.state) {
        db.update(schema.downloads)
          .set({ state: normalizedState, endTime: row.endTime ?? Date.now() })
          .where(eq(schema.downloads.id, row.id))
          .run();
      }

      const item: DownloadItemData = {
        id: row.id,
        profileId: row.profileId,
        url: row.url,
        finalUrl: row.finalUrl,
        filename: row.filename,
        savePath: row.savePath,
        mimeType: row.mimeType ?? null,
        totalBytes: row.totalBytes,
        receivedBytes: row.receivedBytes,
        speedBytesPerSec: 0,
        state: normalizedState,
        canResume: false,
        isPaused: false,
        startTime: row.startTime,
        endTime: row.endTime ?? null
      };
      this.downloads.set(item.id, item);
    }
  }

  private ensureLoaded(): void {
    if (!this.loaded) {
      try {
        this.loadAll();
      } catch {
        // DB may not be ready yet if called early; loadAll will run on bootstrap
      }
    }
  }

  private persistRecord(record: DownloadItemData): void {
    if (record.ephemeral || quitController.isQuitting) return;
    try {
      const db = getDb();
      db.insert(schema.downloads)
        .values({
          id: record.id,
          profileId: record.profileId,
          url: record.url,
          finalUrl: record.finalUrl,
          filename: record.filename,
          savePath: record.savePath,
          mimeType: record.mimeType,
          totalBytes: record.totalBytes,
          receivedBytes: record.receivedBytes,
          state: record.state,
          startTime: record.startTime,
          endTime: record.endTime
        })
        .onConflictDoUpdate({
          target: schema.downloads.id,
          set: {
            finalUrl: record.finalUrl,
            filename: record.filename,
            savePath: record.savePath,
            mimeType: record.mimeType,
            totalBytes: record.totalBytes,
            receivedBytes: record.receivedBytes,
            state: record.state,
            endTime: record.endTime
          }
        })
        .run();
    } catch (error) {
      console.error("Failed to persist download record:", error);
    }
  }

  private scheduleChangedBroadcast(immediate = false): void {
    if (quitController.isQuitting) return;

    if (immediate) {
      if (this.broadcastTimeout) {
        clearTimeout(this.broadcastTimeout);
        this.broadcastTimeout = null;
      }
      sendMessageToListeners("downloads:on-changed", this.list());
      return;
    }

    if (this.broadcastTimeout) return;
    this.broadcastTimeout = setTimeout(() => {
      this.broadcastTimeout = null;
      if (!quitController.isQuitting) {
        sendMessageToListeners("downloads:on-changed", this.list());
      }
    }, BROADCAST_THROTTLE_MS);
  }

  private emitDownloadEvent(event: DownloadEvent): void {
    if (quitController.isQuitting) return;
    sendMessageToListeners("downloads:on-event", event);
  }

  attachToSession(targetSession: Session, profileId: string): void {
    if (this.attachedSessions.has(targetSession)) return;
    this.attachedSessions.add(targetSession);

    targetSession.on("will-download", (_event, item) => {
      this.ensureLoaded();
      const id = generateID();
      const ephemeral = isIncognitoProfileId(profileId);
      const downloadsDir = app.getPath("downloads");
      try {
        fs.mkdirSync(downloadsDir, { recursive: true });
      } catch {
        // Ignore directory creation errors if already exists
      }

      const rawFilename = item.getFilename() || "download";
      const existingSavePath = item.getSavePath();
      const savePath = existingSavePath || getUniqueDownloadPath(downloadsDir, rawFilename);
      if (!existingSavePath) {
        item.setSavePath(savePath);
      }

      const urlChain = item.getURLChain();
      const initialUrl = urlChain[0] || item.getURL();
      const now = Date.now();

      const record: DownloadItemData = {
        id,
        profileId,
        url: initialUrl,
        finalUrl: item.getURL(),
        filename: path.basename(savePath) || rawFilename,
        savePath,
        mimeType: item.getMimeType() || null,
        totalBytes: Math.max(0, item.getTotalBytes()),
        receivedBytes: Math.max(0, item.getReceivedBytes()),
        speedBytesPerSec: 0,
        state: item.isPaused() ? "paused" : "progressing",
        canResume: item.canResume(),
        isPaused: item.isPaused(),
        startTime: now,
        endTime: null,
        ephemeral: ephemeral || undefined
      };

      this.downloads.set(id, record);
      this.activeItems.set(id, {
        item,
        lastBytes: record.receivedBytes,
        lastSampleTime: now,
        smoothedSpeed: 0
      });

      this.persistRecord(record);
      this.scheduleChangedBroadcast(true);
      this.emitDownloadEvent({ type: "started", item: { ...record } });

      item.on("updated", (_updateEvent, updateState) => {
        const current = this.downloads.get(id);
        const tracker = this.activeItems.get(id);
        if (!current || !tracker) return;

        const sampleTime = Date.now();
        const receivedBytes = Math.max(0, item.getReceivedBytes());
        const totalBytes = Math.max(0, item.getTotalBytes());
        const paused = item.isPaused();

        let nextSpeed = tracker.smoothedSpeed;
        const elapsedMs = sampleTime - tracker.lastSampleTime;
        if (paused || updateState === "interrupted") {
          nextSpeed = 0;
          tracker.smoothedSpeed = 0;
          tracker.lastBytes = receivedBytes;
          tracker.lastSampleTime = sampleTime;
        } else if (elapsedMs >= SPEED_SAMPLE_MIN_MS) {
          const deltaBytes = Math.max(0, receivedBytes - tracker.lastBytes);
          const instantSpeed = (deltaBytes * 1000) / elapsedMs;
          nextSpeed = tracker.smoothedSpeed > 0 ? tracker.smoothedSpeed * 0.65 + instantSpeed * 0.35 : instantSpeed;
          tracker.smoothedSpeed = Math.round(nextSpeed);
          tracker.lastBytes = receivedBytes;
          tracker.lastSampleTime = sampleTime;
        }

        const updated: DownloadItemData = {
          ...current,
          finalUrl: item.getURL() || current.finalUrl,
          savePath: item.getSavePath() || current.savePath,
          filename: path.basename(item.getSavePath() || current.savePath) || current.filename,
          mimeType: item.getMimeType() || current.mimeType,
          totalBytes,
          receivedBytes,
          speedBytesPerSec: paused ? 0 : tracker.smoothedSpeed,
          state: updateState === "interrupted" ? "interrupted" : paused ? "paused" : "progressing",
          canResume: item.canResume(),
          isPaused: paused
        };

        this.downloads.set(id, updated);
        this.scheduleChangedBroadcast(false);
      });

      item.once("done", (_doneEvent, doneState) => {
        const current = this.downloads.get(id);
        this.activeItems.delete(id);
        if (!current) return;

        const finalState: DownloadState =
          doneState === "completed" ? "completed" : doneState === "cancelled" ? "cancelled" : "interrupted";

        const receivedBytes = Math.max(current.receivedBytes, item.getReceivedBytes());
        const totalBytes = Math.max(
          current.totalBytes,
          item.getTotalBytes(),
          finalState === "completed" ? receivedBytes : 0
        );

        const finished: DownloadItemData = {
          ...current,
          savePath: item.getSavePath() || current.savePath,
          filename: path.basename(item.getSavePath() || current.savePath) || current.filename,
          totalBytes,
          receivedBytes: finalState === "completed" ? totalBytes || receivedBytes : receivedBytes,
          speedBytesPerSec: 0,
          state: finalState,
          canResume: item.canResume(),
          isPaused: false,
          endTime: Date.now()
        };

        this.downloads.set(id, finished);
        this.persistRecord(finished);
        this.scheduleChangedBroadcast(true);

        if (finalState === "completed") {
          this.emitDownloadEvent({ type: "completed", item: { ...finished } });
        } else if (finalState === "interrupted") {
          this.emitDownloadEvent({ type: "failed", item: { ...finished } });
        }
      });
    });
  }

  list(profileId?: string): DownloadItemData[] {
    this.ensureLoaded();
    const items = Array.from(this.downloads.values()).filter((d) => !profileId || d.profileId === profileId);
    items.sort((a, b) => b.startTime - a.startTime);
    return items;
  }

  pause(id: string): boolean {
    const tracker = this.activeItems.get(id);
    const current = this.downloads.get(id);
    if (!tracker || !current) return false;
    if (tracker.item.getState() !== "progressing" || tracker.item.isPaused()) return false;

    tracker.item.pause();
    tracker.smoothedSpeed = 0;
    this.downloads.set(id, {
      ...current,
      isPaused: true,
      state: "paused",
      canResume: tracker.item.canResume(),
      speedBytesPerSec: 0
    });
    this.scheduleChangedBroadcast(true);
    return true;
  }

  resume(id: string): boolean {
    const tracker = this.activeItems.get(id);
    const current = this.downloads.get(id);
    if (!tracker || !current) return false;
    if (!tracker.item.canResume()) return false;

    tracker.item.resume();
    this.downloads.set(id, {
      ...current,
      isPaused: false,
      state: "progressing"
    });
    this.scheduleChangedBroadcast(true);
    return true;
  }

  cancel(id: string): boolean {
    const tracker = this.activeItems.get(id);
    if (!tracker) return false;
    tracker.item.cancel();
    return true;
  }

  retry(id: string): boolean {
    const current = this.downloads.get(id);
    if (!current) return false;
    const downloadUrl = current.finalUrl || current.url;
    if (!downloadUrl) return false;

    const targetSession =
      current.profileId === "default" ? electronSession.defaultSession : sessionsController.get(current.profileId);
    targetSession.downloadURL(downloadUrl);
    return true;
  }

  async openFile(id: string): Promise<boolean> {
    const current = this.downloads.get(id);
    if (!current?.savePath || !fs.existsSync(current.savePath)) return false;
    const result = await shell.openPath(current.savePath);
    return result === "";
  }

  async showInFinder(id: string): Promise<boolean> {
    const current = this.downloads.get(id);
    if (!current?.savePath) return false;
    if (fs.existsSync(current.savePath)) {
      shell.showItemInFolder(current.savePath);
      return true;
    }
    const dir = path.dirname(current.savePath);
    if (fs.existsSync(dir)) {
      await shell.openPath(dir);
      return true;
    }
    return false;
  }

  async openDownloadsFolder(): Promise<boolean> {
    const dir = app.getPath("downloads");
    fs.mkdirSync(dir, { recursive: true });
    const err = await shell.openPath(dir);
    return err === "";
  }

  remove(id: string): boolean {
    const tracker = this.activeItems.get(id);
    if (tracker) {
      try {
        tracker.item.cancel();
      } catch {
        // Ignore if already settled
      }
      this.activeItems.delete(id);
    }

    const removed = this.downloads.delete(id);
    if (!removed) return false;

    try {
      const db = getDb();
      db.delete(schema.downloads).where(eq(schema.downloads.id, id)).run();
    } catch (error) {
      console.error("Failed to delete download record:", error);
    }

    this.scheduleChangedBroadcast(true);
    return true;
  }

  clearCompleted(profileId?: string): number {
    let removedCount = 0;
    const toRemove: string[] = [];

    for (const [id, item] of this.downloads) {
      if (profileId && item.profileId !== profileId) continue;
      if (item.state !== "progressing" && item.state !== "paused") {
        toRemove.push(id);
      }
    }

    if (toRemove.length === 0) return 0;

    try {
      const db = getDb();
      for (const id of toRemove) {
        this.downloads.delete(id);
        db.delete(schema.downloads).where(eq(schema.downloads.id, id)).run();
        removedCount++;
      }
    } catch (error) {
      console.error("Failed to clear completed downloads:", error);
    }

    this.scheduleChangedBroadcast(true);
    return removedCount;
  }
}

export const downloadsController = new DownloadsController();

export function attachDownloadsToSession(targetSession: Session, profileId: string): void {
  downloadsController.attachToSession(targetSession, profileId);
}
