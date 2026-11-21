import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import type { DetectedBrowser, ImportCategoryCounts, ImportDataCategory } from "~/types/importer";
import type {
  BrowserDefinition,
  BrowserFamilyAdapter,
  ExtractedBrowserData,
  ImportedBookmarkItem,
  ImportedHistoryItem
} from "../types";
import {
  cocoaTimeToUnixMs,
  emptyImportCounts,
  isDirectory,
  isFileReadable,
  isImportableHttpUrl,
  isPermissionError,
  withTempSqliteCopy
} from "../utils";
import { chromiumAdapter } from "./chromium";

const execFileAsync = promisify(execFile);
const HISTORY_IMPORT_LIMIT = 8000;

interface PlistNode {
  [key: string]: unknown;
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&");
}

/**
 * Lightweight parser for `plutil -convert xml1` plist documents (handles dict, array,
 * key, string, integer, real, date, data, and boolean primitives without external deps).
 */
function parseAppleXmlPlist(xml: string): unknown {
  const stack: Array<{ container: Record<string, unknown> | unknown[]; pendingKey: string | null }> = [];
  let root: unknown = null;

  const pushValue = (value: unknown) => {
    const top = stack[stack.length - 1];
    if (!top) {
      root = value;
      return;
    }
    if (Array.isArray(top.container)) {
      top.container.push(value);
    } else if (top.pendingKey !== null) {
      top.container[top.pendingKey] = value;
      top.pendingKey = null;
    }
  };

  const tokenRe = /<(\/?)(plist|dict|array|key|string|integer|real|date|data|true|false)(?:\s[^>]*)?(\/?)>([^<]*)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(xml)) !== null) {
    const [, closingSlash, tagName, selfClosing, rawText] = match;
    if (tagName === "plist") continue;

    if (tagName === "dict") {
      if (selfClosing === "/") {
        pushValue({});
      } else if (closingSlash === "/") {
        stack.pop();
      } else {
        const obj: Record<string, unknown> = {};
        pushValue(obj);
        stack.push({ container: obj, pendingKey: null });
      }
      continue;
    }

    if (tagName === "array") {
      if (selfClosing === "/") {
        pushValue([]);
      } else if (closingSlash === "/") {
        stack.pop();
      } else {
        const arr: unknown[] = [];
        pushValue(arr);
        stack.push({ container: arr, pendingKey: null });
      }
      continue;
    }

    if (closingSlash === "/") continue;

    if (tagName === "true") {
      pushValue(true);
    } else if (tagName === "false") {
      pushValue(false);
    } else if (tagName === "key") {
      const top = stack[stack.length - 1];
      if (top && !Array.isArray(top.container)) {
        top.pendingKey = decodeXmlEntities(rawText);
      }
    } else if (tagName === "integer" || tagName === "real") {
      pushValue(Number(rawText.trim()));
    } else {
      pushValue(decodeXmlEntities(rawText));
    }
  }

  return root;
}

async function readPlistObject(plistPath: string): Promise<PlistNode | null> {
  if (!(await isFileReadable(plistPath))) return null;

  if (process.platform !== "darwin") {
    const raw = await fs.readFile(plistPath, "utf8");
    const parsed = parseAppleXmlPlist(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as PlistNode) : null;
  }

  const { stdout } = await execFileAsync("plutil", ["-convert", "xml1", "-o", "-", plistPath], {
    maxBuffer: 32 * 1024 * 1024
  });
  const parsed = parseAppleXmlPlist(stdout);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as PlistNode) : null;
}

function collectSafariBookmarks(node: unknown, out: ImportedBookmarkItem[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const entry of node) collectSafariBookmarks(entry, out);
    return;
  }

  const dict = node as PlistNode;
  if (dict.WebBookmarkType === "WebBookmarkTypeProxy") return;

  const url = typeof dict.URLString === "string" ? dict.URLString : typeof dict.url === "string" ? dict.url : null;
  if (url && isImportableHttpUrl(url)) {
    const uriDict = dict.URIDictionary as PlistNode | undefined;
    const rawTitle =
      (typeof uriDict?.title === "string" && uriDict.title) ||
      (typeof dict.Title === "string" && dict.Title) ||
      (typeof dict.title === "string" && dict.title) ||
      url;

    const readingList = dict.ReadingList as PlistNode | undefined;
    const dateStr = typeof readingList?.DateAdded === "string" ? readingList.DateAdded : undefined;
    const createdAt = dateStr ? Date.parse(dateStr) || Date.now() : undefined;

    out.push({
      title: rawTitle.trim() || url,
      url,
      createdAt
    });
  }

  if (Array.isArray(dict.Children)) {
    for (const child of dict.Children) {
      collectSafariBookmarks(child, out);
    }
  }
  if (Array.isArray(dict.children)) {
    for (const child of dict.children) {
      collectSafariBookmarks(child, out);
    }
  }
}

async function resolveSafariDataFiles(def: BrowserDefinition, rootDir: string) {
  if (def.family === "orion") {
    const plistCandidates = ["Bookmarks.plist", "bookmarks.plist", "favourites.plist", "Favourites.plist"];
    const dbCandidates = ["history.db", "History.db", "history.sqlite", "history"];
    let bookmarksFile: string | null = null;
    let historyFile: string | null = null;

    for (const name of plistCandidates) {
      const candidate = path.join(rootDir, name);
      if (await isFileReadable(candidate)) {
        bookmarksFile = candidate;
        break;
      }
    }
    for (const name of dbCandidates) {
      const candidate = path.join(rootDir, name);
      if (await isFileReadable(candidate)) {
        historyFile = candidate;
        break;
      }
    }
    return { bookmarksFile, historyFile };
  }

  if (def.family === "duckduckgo") {
    const sqliteFiles = ["DuckDuckGo.sqlite", "Bookmarks.sqlite", "History.db"];
    for (const name of sqliteFiles) {
      const candidate = path.join(rootDir, name);
      if (await isFileReadable(candidate)) {
        return { bookmarksFile: candidate, historyFile: candidate, coreDataSqlite: candidate };
      }
    }
    return { bookmarksFile: null, historyFile: null };
  }

  // Standard Apple Safari / Safari Technology Preview
  const bookmarksFile = path.join(rootDir, "Bookmarks.plist");
  const historyFile = path.join(rootDir, "History.db");
  return {
    bookmarksFile: (await isFileReadable(bookmarksFile)) ? bookmarksFile : null,
    historyFile: (await isFileReadable(historyFile)) ? historyFile : null
  };
}

async function readSafariBookmarks(bookmarksFile: string | null, isCoreData?: string): Promise<ImportedBookmarkItem[]> {
  if (!bookmarksFile) return [];

  if (isCoreData && bookmarksFile.endsWith(".sqlite")) {
    return withTempSqliteCopy(bookmarksFile, (db) => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r) => (r as { name: string }).name);
      const bmTable = tables.find((t) => /^Z.*BOOKMARK/i.test(t));
      if (!bmTable) return [];

      const cols = (db.pragma(`table_info("${bmTable}")`) as Array<{ name: string }>).map((c) => c.name);
      const urlCol = cols.find((c) => /^ZURL/i.test(c));
      const titleCol = cols.find((c) => /^ZTITLE/i.test(c));
      if (!urlCol) return [];

      const rows = db
        .prepare(
          `SELECT "${urlCol}" AS url, ${titleCol ? `"${titleCol}"` : "''"} AS title
           FROM "${bmTable}" WHERE "${urlCol}" IS NOT NULL`
        )
        .all() as Array<{ url: string; title: string | null }>;

      return rows
        .filter((r) => isImportableHttpUrl(r.url))
        .map((r) => ({ title: (r.title || "").trim() || r.url, url: r.url }));
    });
  }

  const plistObj = await readPlistObject(bookmarksFile);
  if (!plistObj) return [];
  const items: ImportedBookmarkItem[] = [];
  collectSafariBookmarks(plistObj, items);
  return items;
}

async function readSafariHistory(historyFile: string | null): Promise<ImportedHistoryItem[]> {
  if (!historyFile) return [];

  return withTempSqliteCopy(historyFile, (db) => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => (r as { name: string }).name);

    // Apple Safari & Safari Technology Preview schema (`history_items` + `history_visits`)
    if (tables.includes("history_items") && tables.includes("history_visits")) {
      const rows = db
        .prepare(
          `SELECT hi.url, COALESCE(hv.title, '') AS title, COALESCE(hi.visit_count, 1) AS visit_count, hv.visit_time
           FROM history_items hi
           JOIN (
             SELECT history_item, MAX(visit_time) AS visit_time, MAX(title) AS title
             FROM history_visits
             GROUP BY history_item
           ) hv ON hv.history_item = hi.id
           WHERE hi.url LIKE 'http%'
           ORDER BY hv.visit_time DESC
           LIMIT ?`
        )
        .all(HISTORY_IMPORT_LIMIT) as Array<{
        url: string;
        title: string;
        visit_count: number;
        visit_time: number;
      }>;

      return rows
        .filter((r) => isImportableHttpUrl(r.url))
        .map((r) => ({
          url: r.url,
          title: r.title,
          visitCount: r.visit_count,
          visitTime: cocoaTimeToUnixMs(r.visit_time)
        }));
    }

    // CoreData / Orion fallback table inspection
    const histTable = tables.find((t) => /^(Z.*HISTORY|history)$/i.test(t));
    if (!histTable) return [];

    const cols = (db.pragma(`table_info("${histTable}")`) as Array<{ name: string }>).map((c) => c.name);
    const urlCol = cols.find((c) => /^(ZURL|url)$/i.test(c));
    const titleCol = cols.find((c) => /^(ZTITLE|title)$/i.test(c));
    const dateCol = cols.find((c) => /^(ZLASTVISIT|ZDATE|last_visit|visit_time)$/i.test(c));
    if (!urlCol) return [];

    const orderClause = dateCol ? `ORDER BY "${dateCol}" DESC` : "";
    const rows = db
      .prepare(
        `SELECT "${urlCol}" AS url, ${titleCol ? `COALESCE("${titleCol}", '')` : "''"} AS title,
         ${dateCol ? `"${dateCol}"` : "NULL"} AS visit_time
         FROM "${histTable}" WHERE "${urlCol}" LIKE 'http%' ${orderClause} LIMIT ?`
      )
      .all(HISTORY_IMPORT_LIMIT) as Array<{ url: string; title: string; visit_time: number | null }>;

    return rows
      .filter((r) => isImportableHttpUrl(r.url))
      .map((r) => ({
        url: r.url,
        title: r.title,
        visitTime: cocoaTimeToUnixMs(r.visit_time)
      }));
  });
}

async function countSafariHistory(historyFile: string | null): Promise<number> {
  if (!historyFile) return 0;

  return withTempSqliteCopy(historyFile, (db) => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => (r as { name: string }).name);

    if (tables.includes("history_items")) {
      const row = db.prepare("SELECT COUNT(*) AS cnt FROM history_items WHERE url LIKE 'http%'").get() as
        { cnt: number } | undefined;
      return Math.min(Number(row?.cnt ?? 0), HISTORY_IMPORT_LIMIT);
    }

    const histTable = tables.find((t) => /^(Z.*HISTORY|history)$/i.test(t));
    if (!histTable) return 0;
    const cols = (db.pragma(`table_info("${histTable}")`) as Array<{ name: string }>).map((c) => c.name);
    const urlCol = cols.find((c) => /^(ZURL|url)$/i.test(c));
    if (!urlCol) return 0;

    const row = db.prepare(`SELECT COUNT(*) AS cnt FROM "${histTable}" WHERE "${urlCol}" LIKE 'http%'`).get() as
      { cnt: number } | undefined;
    return Math.min(Number(row?.cnt ?? 0), HISTORY_IMPORT_LIMIT);
  });
}

export const safariFamilyAdapter: BrowserFamilyAdapter = {
  async scan(def, rootDirs): Promise<DetectedBrowser | null> {
    // Windows DuckDuckGo stores data inside Edge WebView2 Chromium layout
    if (def.family === "duckduckgo" && process.platform === "win32") {
      return chromiumAdapter.scan(def, rootDirs);
    }

    let encounteredPermissionError = false;

    for (const rootDir of rootDirs) {
      try {
        if (!(await isDirectory(rootDir))) continue;
        const files = await resolveSafariDataFiles(def, rootDir);
        const hasBookmarks = Boolean(files.bookmarksFile);
        const hasHistory = Boolean(files.historyFile);
        if (!hasBookmarks && !hasHistory) continue;

        return {
          id: def.id,
          name: def.name,
          family: def.family,
          profiles: [
            {
              id: rootDir,
              name: "Default",
              isDefault: true,
              available: {
                bookmarks: hasBookmarks,
                history: hasHistory,
                pinnedTabs: false,
                searchEngines: false
              }
            }
          ]
        };
      } catch (error) {
        if (isPermissionError(error)) {
          encounteredPermissionError = true;
        }
      }
    }

    if (encounteredPermissionError) {
      return {
        id: def.id,
        name: def.name,
        family: def.family,
        profiles: [],
        permissionRequired: true
      };
    }

    return null;
  },

  async preview(def, rootDirs, profileId): Promise<ImportCategoryCounts> {
    if (def.family === "duckduckgo" && process.platform === "win32") {
      return chromiumAdapter.preview(def, rootDirs, profileId);
    }

    const counts = emptyImportCounts();
    try {
      const files = await resolveSafariDataFiles(def, profileId);
      const [bookmarks, historyCount] = await Promise.all([
        readSafariBookmarks(files.bookmarksFile, files.coreDataSqlite).catch(() => []),
        countSafariHistory(files.historyFile).catch(() => 0)
      ]);
      counts.bookmarks = bookmarks.length;
      counts.history = historyCount;
    } catch {
      // Return empty counts when TCC blocks access
    }
    return counts;
  },

  async extract(def, rootDirs, profileId, categories: Set<ImportDataCategory>) {
    if (def.family === "duckduckgo" && process.platform === "win32") {
      return chromiumAdapter.extract(def, rootDirs, profileId, categories);
    }

    const data: ExtractedBrowserData = {
      bookmarks: [],
      history: [],
      pinnedTabs: [],
      searchEngines: []
    };
    const errors: string[] = [];

    const files = await resolveSafariDataFiles(def, profileId);

    if (categories.has("bookmarks")) {
      try {
        data.bookmarks = await readSafariBookmarks(files.bookmarksFile, files.coreDataSqlite);
      } catch (err) {
        if (isPermissionError(err)) {
          errors.push(
            `${def.name} bookmarks require macOS Full Disk Access in System Settings -> Privacy & Security (or import via Safari Bookmarks HTML export).`
          );
        } else {
          errors.push(`Failed reading ${def.name} bookmarks: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (categories.has("history")) {
      try {
        data.history = await readSafariHistory(files.historyFile);
      } catch (err) {
        if (isPermissionError(err)) {
          errors.push(`${def.name} history requires macOS Full Disk Access in System Settings.`);
        } else {
          errors.push(`Failed reading ${def.name} history: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return {
      profileName: "Default",
      data,
      errors
    };
  }
};
