import { app } from "electron";
import Database from "better-sqlite3";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import fsPromises from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { spacesController } from "@/controllers/spaces-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { debugError, debugPrint } from "@/modules/output";
import { addFavouritesBatch } from "@/saving/favourites";
import { importBrowsingHistoryEntries } from "@/saving/history/browsing-history";
import { saveSafariSyncData } from "@/saving/safari-sync";
import type {
  SafariBookmarkItem,
  SafariDiscoveryResult,
  SafariHistoryItem,
  SafariImportOptions,
  SafariImportResult,
  SafariOpenTab
} from "~/types/safari-sync";

const execFileAsync = promisify(execFile);

const APPLE_COREDATA_EPOCH_OFFSET_SEC = 978_307_200; // Seconds between 1970-01-01 and 2001-01-01
const MAX_HISTORY_IMPORT_ROWS = 2000;
const MAX_HISTORY_PREVIEW_ROWS = 50;

const SAFARI_APP_CANDIDATES = [
  "/Applications/Safari.app",
  "/System/Applications/Safari.app",
  "/System/Volumes/Preboot/Cryptexes/App/System/Applications/Safari.app",
  "/System/Cryptexes/App/System/Applications/Safari.app"
];

interface SafariPlistNode {
  WebBookmarkType?: string;
  Title?: string;
  URLString?: string;
  URIDictionary?: { title?: string };
  ReadingList?: {
    DateAdded?: string | number;
    PreviewText?: string;
  };
  Children?: SafariPlistNode[];
}

export function isHttpOrHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSafariInstalled(): boolean {
  if (process.platform !== "darwin") return false;
  return SAFARI_APP_CANDIDATES.some((candidate) => fs.existsSync(candidate));
}

export async function isSafariRunning(): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  try {
    await execFileAsync("/usr/bin/pgrep", ["-x", "Safari"], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

export async function openUrlInSafari(url: string): Promise<boolean> {
  if (process.platform !== "darwin" || !isHttpOrHttpsUrl(url)) {
    return false;
  }
  try {
    await execFileAsync("/usr/bin/open", ["-a", "Safari", url], { timeout: 5000 });
    return true;
  } catch (error) {
    debugError("SAFARI_SYNC", "Failed to open URL in Safari:", error);
    return false;
  }
}

export async function readSafariOpenTabs(): Promise<{
  running: boolean;
  tabs: SafariOpenTab[];
  automationError?: string;
}> {
  if (process.platform !== "darwin") {
    return { running: false, tabs: [] };
  }

  const running = await isSafariRunning();
  if (!running) {
    return { running: false, tabs: [] };
  }

  const jxaScript = `
    const safari = Application("Safari");
    if (!safari.running()) {
      JSON.stringify({ running: false, tabs: [] });
    } else {
      const out = [];
      const wins = safari.windows();
      for (let wi = 0; wi < wins.length; wi++) {
        let tabs = [];
        try {
          tabs = wins[wi].tabs();
        } catch (e) {
          continue;
        }
        for (let ti = 0; ti < tabs.length; ti++) {
          try {
            const url = tabs[ti].url();
            const title = tabs[ti].name();
            if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
              out.push({
                windowIndex: wi,
                tabIndex: ti,
                title: title || url,
                url: url
              });
            }
          } catch (e) {}
        }
      }
      JSON.stringify({ running: true, tabs: out });
    }
  `;

  try {
    const { stdout } = await execFileAsync("/usr/bin/osascript", ["-l", "JavaScript", "-e", jxaScript], {
      timeout: 5000,
      maxBuffer: 4 * 1024 * 1024
    });
    const parsed = JSON.parse(stdout.trim() || "{}") as { running?: boolean; tabs?: SafariOpenTab[] };
    const tabs = Array.isArray(parsed.tabs) ? parsed.tabs.filter((t) => isHttpOrHttpsUrl(t.url)) : [];
    return {
      running: parsed.running ?? true,
      tabs
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isPermissionError =
      message.includes("-1743") ||
      message.toLowerCase().includes("not authorized") ||
      message.toLowerCase().includes("apple events");

    debugError("SAFARI_SYNC", "AppleScript readSafariOpenTabs failed:", message);
    return {
      running: true,
      tabs: [],
      automationError: isPermissionError
        ? "macOS Automation permission is required to read open Safari tabs. Enable Lumi under System Settings → Privacy & Security → Automation."
        : `Could not read Safari open tabs: ${message}`
    };
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .trim();
}

export async function parseNetscapeBookmarksHtml(filePath: string): Promise<{
  bookmarks: SafariBookmarkItem[];
  readingList: SafariBookmarkItem[];
}> {
  const html = await fsPromises.readFile(filePath, "utf8");
  const bookmarks: SafariBookmarkItem[] = [];
  const readingList: SafariBookmarkItem[] = [];

  const folderStack: string[] = [];
  const lines = html.split(/\r?\n/);

  for (const line of lines) {
    const h3Match = /<h3[^>]*>(.*?)<\/h3>/i.exec(line);
    if (h3Match) {
      const folderName = decodeHtmlEntities(h3Match[1]!.replace(/<[^>]+>/g, ""));
      if (folderName) {
        folderStack.push(folderName);
      }
      continue;
    }

    if (/<\/dl>/i.test(line) && folderStack.length > 0) {
      folderStack.pop();
    }

    const linkMatch = /<a\b([^>]*)>(.*?)<\/a>/i.exec(line);
    if (linkMatch) {
      const attrs = linkMatch[1] || "";
      const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(attrs);
      if (!hrefMatch) continue;
      const url = decodeHtmlEntities(hrefMatch[1]!);
      if (!isHttpOrHttpsUrl(url)) continue;

      const addDateMatch = /add_date\s*=\s*["']?(\d+)["']?/i.exec(attrs);
      const dateAdded = addDateMatch ? Number(addDateMatch[1]) * 1000 : undefined;
      const rawTitle = decodeHtmlEntities(linkMatch[2]!.replace(/<[^>]+>/g, ""));
      const isReadingList = folderStack.some((f) => f.toLowerCase() === "reading list");

      const item: SafariBookmarkItem = {
        id: randomUUID(),
        title: rawTitle || url,
        url,
        folderPath: [...folderStack],
        isReadingList,
        dateAdded
      };

      if (isReadingList) {
        readingList.push(item);
      } else {
        bookmarks.push(item);
      }
    }
  }

  return { bookmarks, readingList };
}

function walkSafariPlistNode(
  node: SafariPlistNode,
  folderPath: string[],
  inReadingList: boolean,
  bookmarks: SafariBookmarkItem[],
  readingList: SafariBookmarkItem[]
): void {
  if (node.WebBookmarkType === "WebBookmarkTypeLeaf" && node.URLString && isHttpOrHttpsUrl(node.URLString)) {
    const title = node.URIDictionary?.title?.trim() || node.Title?.trim() || node.URLString;
    const rawDate = node.ReadingList?.DateAdded;
    let dateAdded: number | undefined;
    if (typeof rawDate === "string") {
      const parsed = Date.parse(rawDate);
      if (!Number.isNaN(parsed)) dateAdded = parsed;
    } else if (typeof rawDate === "number") {
      dateAdded = (rawDate + APPLE_COREDATA_EPOCH_OFFSET_SEC) * 1000;
    }

    const item: SafariBookmarkItem = {
      id: randomUUID(),
      title,
      url: node.URLString,
      folderPath,
      isReadingList: inReadingList,
      dateAdded,
      previewText: node.ReadingList?.PreviewText?.trim()
    };

    if (inReadingList) {
      readingList.push(item);
    } else {
      bookmarks.push(item);
    }
    return;
  }

  if (Array.isArray(node.Children)) {
    const rawTitle = node.Title?.trim();
    const isReadingListFolder = inReadingList || rawTitle === "com.apple.ReadingList";
    const displayFolder =
      rawTitle === "com.apple.ReadingList"
        ? "Reading List"
        : rawTitle === "BookmarksBar"
          ? "Favorites"
          : rawTitle === "BookmarksMenu"
            ? "Bookmarks Menu"
            : rawTitle;
    const nextPath = displayFolder ? [...folderPath, displayFolder] : folderPath;

    for (const child of node.Children) {
      walkSafariPlistNode(child, nextPath, isReadingListFolder, bookmarks, readingList);
    }
  }
}

export async function parseSafariBookmarksPlist(filePath: string): Promise<{
  bookmarks: SafariBookmarkItem[];
  readingList: SafariBookmarkItem[];
}> {
  // Check readability first so permission errors are classified cleanly
  await fsPromises.access(filePath, fs.constants.R_OK);

  const { stdout } = await execFileAsync("/usr/bin/plutil", ["-convert", "json", "-o", "-", filePath], {
    timeout: 8000,
    maxBuffer: 32 * 1024 * 1024
  });

  const root = JSON.parse(stdout) as SafariPlistNode;
  const bookmarks: SafariBookmarkItem[] = [];
  const readingList: SafariBookmarkItem[] = [];
  walkSafariPlistNode(root, [], false, bookmarks, readingList);

  return { bookmarks, readingList };
}

export async function probeSafariFullDiskAccess(): Promise<boolean> {
  if (process.platform !== "darwin") return false;

  const safariDir = path.join(os.homedir(), "Library", "Safari");
  const candidates = [path.join(safariDir, "Bookmarks.plist"), path.join(safariDir, "History.db")];

  let anyReadable = false;

  // Issuing real opendir(3) / open(2) syscalls from Lumi's main process lets macOS
  // record Lumi in System Settings -> Privacy & Security -> Full Disk Access.
  try {
    await fsPromises.readdir(safariDir);
    anyReadable = true;
  } catch {
    // Expected when Full Disk Access has not been granted yet
  }

  for (const filePath of candidates) {
    try {
      const handle = await fsPromises.open(filePath, "r");
      await handle.close();
      anyReadable = true;
    } catch {
      // Expected EPERM/EACCES/ENOENT
    }
  }

  return anyReadable;
}

export async function readSafariBookmarksSource(customFilePath?: string): Promise<{
  readable: boolean;
  permissionDenied: boolean;
  bookmarks: SafariBookmarkItem[];
  readingList: SafariBookmarkItem[];
  sourcePath?: string;
}> {
  const defaultPath = path.join(os.homedir(), "Library", "Safari", "Bookmarks.plist");
  const targetPath = customFilePath || defaultPath;

  try {
    const handle = await fsPromises.open(targetPath, "r");
    await handle.close();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "EPERM" || code === "EACCES") {
      return {
        readable: false,
        permissionDenied: true,
        bookmarks: [],
        readingList: []
      };
    }
    return {
      readable: false,
      permissionDenied: false,
      bookmarks: [],
      readingList: []
    };
  }

  try {
    const ext = path.extname(targetPath).toLowerCase();
    const parsed =
      ext === ".html" || ext === ".htm"
        ? await parseNetscapeBookmarksHtml(targetPath)
        : await parseSafariBookmarksPlist(targetPath);

    return {
      readable: true,
      permissionDenied: false,
      bookmarks: parsed.bookmarks,
      readingList: parsed.readingList,
      sourcePath: targetPath
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    const msg = error instanceof Error ? error.message : String(error);
    const permissionDenied =
      code === "EPERM" ||
      code === "EACCES" ||
      msg.toLowerCase().includes("operation not permitted") ||
      msg.toLowerCase().includes("permission denied");

    debugError("SAFARI_SYNC", "Failed reading Safari bookmarks:", msg);
    return {
      readable: false,
      permissionDenied,
      bookmarks: [],
      readingList: []
    };
  }
}

export async function readSafariHistory(options?: { maxDays?: number; limit?: number }): Promise<{
  readable: boolean;
  permissionDenied: boolean;
  totalCount: number;
  items: SafariHistoryItem[];
}> {
  if (process.platform !== "darwin") {
    return { readable: false, permissionDenied: false, totalCount: 0, items: [] };
  }

  const safariHistoryPath = path.join(os.homedir(), "Library", "Safari", "History.db");
  try {
    const handle = await fsPromises.open(safariHistoryPath, "r");
    await handle.close();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    const permissionDenied = code === "EPERM" || code === "EACCES";
    return { readable: false, permissionDenied, totalCount: 0, items: [] };
  }

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "lumi-safari-history-"));
  const tempDbPath = path.join(tempDir, "History.db");

  try {
    await fsPromises.copyFile(safariHistoryPath, tempDbPath);
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = `${safariHistoryPath}${suffix}`;
      if (fs.existsSync(sidecar)) {
        await fsPromises.copyFile(sidecar, `${tempDbPath}${suffix}`).catch(() => {});
      }
    }

    const db = new Database(tempDbPath, { readonly: true, fileMustExist: true });
    try {
      const maxDays = options?.maxDays ?? 90;
      const cutoffUnixSec = Date.now() / 1000 - maxDays * 24 * 60 * 60;
      const cutoffCoreDataSec = cutoffUnixSec - APPLE_COREDATA_EPOCH_OFFSET_SEC;
      const rowLimit = Math.min(options?.limit ?? MAX_HISTORY_IMPORT_ROWS, MAX_HISTORY_IMPORT_ROWS);

      const countRow = db
        .prepare(
          `SELECT COUNT(DISTINCT hi.id) as cnt
           FROM history_items hi
           JOIN history_visits hv ON hv.history_item = hi.id
           WHERE hv.visit_time >= ?
             AND (hi.url LIKE 'http://%' OR hi.url LIKE 'https://%')`
        )
        .get(cutoffCoreDataSec) as { cnt?: number } | undefined;

      const rows = db
        .prepare(
          `SELECT
             hi.url as url,
             COALESCE(NULLIF(MAX(hv.title), ''), hi.url) as title,
             MAX(hv.visit_time) as latest_visit_time,
             COUNT(hv.id) as visit_count
           FROM history_items hi
           JOIN history_visits hv ON hv.history_item = hi.id
           WHERE hv.visit_time >= ?
             AND (hi.url LIKE 'http://%' OR hi.url LIKE 'https://%')
           GROUP BY hi.id
           ORDER BY latest_visit_time DESC
           LIMIT ?`
        )
        .all(cutoffCoreDataSec, rowLimit) as Array<{
        url: string;
        title: string;
        latest_visit_time: number;
        visit_count: number;
      }>;

      const items: SafariHistoryItem[] = [];
      for (const row of rows) {
        if (!isHttpOrHttpsUrl(row.url)) continue;
        items.push({
          url: row.url,
          title: row.title || row.url,
          visitTime: Math.round((row.latest_visit_time + APPLE_COREDATA_EPOCH_OFFSET_SEC) * 1000),
          visitCount: Math.max(1, Number(row.visit_count) || 1)
        });
      }

      return {
        readable: true,
        permissionDenied: false,
        totalCount: Number(countRow?.cnt ?? items.length),
        items
      };
    } finally {
      db.close();
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const permissionDenied =
      msg.toLowerCase().includes("operation not permitted") || msg.toLowerCase().includes("eperm");
    debugError("SAFARI_SYNC", "Failed reading Safari History.db:", msg);
    return {
      readable: false,
      permissionDenied,
      totalCount: 0,
      items: []
    };
  } finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function discoverSafariData(customBookmarksFilePath?: string): Promise<SafariDiscoveryResult> {
  const isMac = process.platform === "darwin";
  const safariInstalled = isMac ? isSafariInstalled() : false;

  const [tabsResult, bookmarksResult, historyResult] = await Promise.all([
    isMac
      ? readSafariOpenTabs()
      : Promise.resolve({ running: false, tabs: [] as SafariOpenTab[], automationError: undefined }),
    isMac || customBookmarksFilePath
      ? readSafariBookmarksSource(customBookmarksFilePath)
      : Promise.resolve({
          readable: false,
          permissionDenied: false,
          bookmarks: [] as SafariBookmarkItem[],
          readingList: [] as SafariBookmarkItem[],
          sourcePath: undefined
        }),
    isMac
      ? readSafariHistory({ maxDays: 90, limit: MAX_HISTORY_PREVIEW_ROWS })
      : Promise.resolve({ readable: false, permissionDenied: false, totalCount: 0, items: [] as SafariHistoryItem[] })
  ]);

  return {
    supported: isMac,
    safariInstalled,
    safariRunning: tabsResult.running,
    bookmarksReadable: bookmarksResult.readable,
    historyReadable: historyResult.readable,
    automationError: tabsResult.automationError,
    fullDiskAccessNeeded: bookmarksResult.permissionDenied || historyResult.permissionDenied,
    customSourcePath: bookmarksResult.sourcePath,
    counts: {
      openTabs: tabsResult.tabs.length,
      bookmarks: bookmarksResult.bookmarks.length,
      readingList: bookmarksResult.readingList.length,
      history: historyResult.totalCount
    },
    openTabs: tabsResult.tabs,
    bookmarks: bookmarksResult.bookmarks,
    readingList: bookmarksResult.readingList,
    historyPreview: historyResult.items.slice(0, MAX_HISTORY_PREVIEW_ROWS)
  };
}

export async function resolveOrCreateTargetSpace(
  profileId: string,
  targetSpaceId?: string,
  createSafariSpace?: boolean
): Promise<{ profileId: string; spaceId: string; spaceName: string } | null> {
  if (createSafariSpace) {
    const spaces = await spacesController.getAllFromProfile(profileId);
    const existingSafari = spaces.find((s) => s.name.trim().toLowerCase() === "safari");
    if (existingSafari) {
      return { profileId: existingSafari.profileId, spaceId: existingSafari.id, spaceName: existingSafari.name };
    }

    const created = await spacesController.create(profileId, "Safari", {
      bgStartColor: "#0EA5E9",
      bgEndColor: "#2563EB"
    });
    if (created) {
      const refreshed = await spacesController.getAllFromProfile(profileId);
      const safariSpace = refreshed.find((s) => s.name === "Safari");
      if (safariSpace) {
        await spacesController.update(profileId, safariSpace.id, { icon: "Compass" }).catch(() => {});
        return { profileId: safariSpace.profileId, spaceId: safariSpace.id, spaceName: safariSpace.name };
      }
    }
  }

  if (targetSpaceId) {
    const space = await spacesController.get(targetSpaceId);
    if (space) {
      return { profileId: space.profileId, spaceId: spaceIdFromLookup(targetSpaceId), spaceName: space.name };
    }
  }

  const lastInProfile = await spacesController.getLastUsedFromProfile(profileId);
  if (lastInProfile) {
    return { profileId: lastInProfile.profileId, spaceId: lastInProfile.id, spaceName: lastInProfile.name };
  }

  const fallback = await spacesController.getLastUsed();
  if (fallback) {
    return { profileId: fallback.profileId, spaceId: fallback.id, spaceName: fallback.name };
  }

  return null;
}

function spaceIdFromLookup(id: string): string {
  return id;
}

export async function openUrlsInLumiSpace(args: {
  profileId: string;
  spaceId: string;
  items: Array<{ url: string; title: string }>;
  activateFirst?: boolean;
}): Promise<{ openedNow: number; queuedForOnboarding: number }> {
  const validItems = args.items.filter((item) => isHttpOrHttpsUrl(item.url));
  if (validItems.length === 0) {
    return { openedNow: 0, queuedForOnboarding: 0 };
  }

  const windows = browserWindowsController.getWindows().filter((w) => !w.destroyed && w.browserWindowType === "normal");
  if (windows.length === 0) {
    await saveSafariSyncData((data) => {
      const existingSet = new Set(data.pendingOnboardingTabs.map((t) => `${t.spaceId}::${t.url}`));
      for (const item of validItems) {
        const key = `${args.spaceId}::${item.url}`;
        if (existingSet.has(key)) continue;
        existingSet.add(key);
        data.pendingOnboardingTabs.push({
          url: item.url,
          title: item.title || item.url,
          profileId: args.profileId,
          spaceId: args.spaceId
        });
      }
    });
    return { openedNow: 0, queuedForOnboarding: validItems.length };
  }

  const targetWindow = browserWindowsController.getFocusedWindow() || windows[0]!;
  const existingSpaceUrls = new Set(
    tabsController
      .getTabsInSpace(args.spaceId)
      .map((t) => t.url)
      .filter(Boolean)
  );

  let openedNow = 0;
  let firstCreatedTab: Awaited<ReturnType<typeof tabsController.createTab>> | null = null;

  for (const item of validItems) {
    if (existingSpaceUrls.has(item.url)) continue;
    existingSpaceUrls.add(item.url);

    const makeAwake = openedNow === 0 && (args.activateFirst ?? true);
    const createdTab = await tabsController.createTab(
      targetWindow.id,
      args.profileId,
      args.spaceId,
      undefined,
      makeAwake
        ? { url: item.url, title: item.title || item.url }
        : {
            asleep: true,
            title: item.title || item.url,
            navHistory: [{ url: item.url, title: item.title || item.url }],
            navHistoryIndex: 0
          }
    );

    if (!firstCreatedTab) {
      firstCreatedTab = createdTab;
    }
    openedNow++;
  }

  if (firstCreatedTab && (args.activateFirst ?? true)) {
    if (targetWindow.currentSpaceId !== args.spaceId) {
      targetWindow.setCurrentSpace(args.spaceId);
    }
    tabsController.activateTab(firstCreatedTab);
  }

  return { openedNow, queuedForOnboarding: 0 };
}

export async function importFromSafari(options: SafariImportOptions): Promise<SafariImportResult> {
  const errors: string[] = [];
  const resolved = await resolveOrCreateTargetSpace(
    options.profileId || "main",
    options.targetSpaceId,
    options.createSafariSpace
  );

  if (!resolved) {
    return {
      success: false,
      tabsOpened: 0,
      tabsQueuedForOnboarding: 0,
      favouritesAdded: 0,
      historyEntriesImported: 0,
      errors: ["Could not resolve or create a target Space for the import."]
    };
  }

  const { profileId, spaceId, spaceName } = resolved;
  const discovery = await discoverSafariData(options.customBookmarksFilePath);

  if (discovery.automationError && options.importOpenTabs) {
    errors.push(discovery.automationError);
  }

  const tabsToImport: Array<{ url: string; title: string }> = [];
  if (options.importOpenTabs) {
    const selectedSet =
      options.selectedOpenTabUrls && options.selectedOpenTabUrls.length > 0
        ? new Set(options.selectedOpenTabUrls)
        : null;
    for (const tab of discovery.openTabs) {
      if (selectedSet && !selectedSet.has(tab.url)) continue;
      tabsToImport.push({ url: tab.url, title: tab.title });
    }
  }

  const favouritesToImport: Array<{ title: string; url: string; createdAt?: number }> = [];
  if (options.importBookmarks) {
    for (const bm of discovery.bookmarks) {
      favouritesToImport.push({
        title: bm.title,
        url: bm.url,
        createdAt: bm.dateAdded
      });
    }
  }

  if (options.importReadingListToFavourites) {
    for (const item of discovery.readingList) {
      favouritesToImport.push({
        title: item.title,
        url: item.url,
        createdAt: item.dateAdded
      });
    }
  }

  if (options.importReadingListAsTabs) {
    for (const item of discovery.readingList) {
      tabsToImport.push({ url: item.url, title: item.title });
    }
  }

  let favouritesAdded = 0;
  if (favouritesToImport.length > 0) {
    try {
      favouritesAdded = await addFavouritesBatch(favouritesToImport);
    } catch (error) {
      errors.push(`Failed importing favourites: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let tabsOpened = 0;
  let tabsQueuedForOnboarding = 0;
  if (tabsToImport.length > 0) {
    try {
      const tabResult = await openUrlsInLumiSpace({
        profileId,
        spaceId,
        items: tabsToImport,
        activateFirst: true
      });
      tabsOpened = tabResult.openedNow;
      tabsQueuedForOnboarding = tabResult.queuedForOnboarding;
    } catch (error) {
      errors.push(`Failed opening imported tabs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let historyEntriesImported = 0;
  if (options.importHistory && app.isReady()) {
    try {
      const historyData = await readSafariHistory({
        maxDays: options.historyMaxDays ?? 90,
        limit: MAX_HISTORY_IMPORT_ROWS
      });
      if (historyData.permissionDenied) {
        errors.push("Full Disk Access is required to read Safari History.db.");
      } else if (historyData.items.length > 0) {
        historyEntriesImported = importBrowsingHistoryEntries(profileId, historyData.items);
      }
    } catch (error) {
      errors.push(`Failed importing Safari history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  debugPrint(
    "SAFARI_SYNC",
    `Safari import finished: tabs=${tabsOpened}, queued=${tabsQueuedForOnboarding}, favs=${favouritesAdded}, history=${historyEntriesImported}`
  );

  return {
    success:
      errors.length === 0 ||
      tabsOpened > 0 ||
      tabsQueuedForOnboarding > 0 ||
      favouritesAdded > 0 ||
      historyEntriesImported > 0,
    tabsOpened,
    tabsQueuedForOnboarding,
    favouritesAdded,
    historyEntriesImported,
    targetSpaceId: spaceId,
    targetSpaceName: spaceName,
    errors
  };
}
