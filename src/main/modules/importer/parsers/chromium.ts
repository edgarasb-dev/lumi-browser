import path from "path";
import type { DetectedBrowser, DetectedBrowserProfile, ImportCategoryCounts } from "~/types/importer";
import type {
  BrowserDefinition,
  BrowserFamilyAdapter,
  ExtractedBrowserData,
  ImportedBookmarkItem,
  ImportedCookieItem,
  ImportedHistoryItem,
  ImportedIndexedDbDir,
  ImportedLocalStorageOrigin,
  ImportedPasswordItem,
  ImportedPinnedTabItem,
  ImportedSearchEngineItem
} from "../types";
import { decryptChromiumEncryptedValue, getChromiumSafeStorageAesKey } from "../crypto/safe-storage";
import { countChromiumStorageOrigins, readChromiumLocalStorage } from "../leveldb";
import {
  chromeTimeToUnixMs,
  convertSearchUrlTemplate,
  createEmptyExtractedData,
  createPermissionRequiredBrowser,
  emptyImportCounts,
  type FsReadOptions,
  HISTORY_IMPORT_LIMIT,
  isDirectory,
  isFileReadable,
  isImportableHttpUrl,
  isPermissionError,
  normalizeImportUrl,
  readDirEntries,
  readJsonSafe,
  sanitizeShortcut,
  withTempSqliteCopy
} from "../utils";

interface ChromiumBookmarkNode {
  type?: string;
  name?: string;
  url?: string;
  date_added?: string;
  children?: ChromiumBookmarkNode[];
}

interface ChromiumProfileCandidate {
  id: string;
  name: string;
  dir: string;
  isDefault: boolean;
  hasBookmarks: boolean;
  hasHistory: boolean;
  hasSearchEngines: boolean;
  hasPinnedTabs: boolean;
  hasPasswords: boolean;
  hasSessions: boolean;
}

interface LocalStateShape {
  profile?: {
    last_used?: string;
    info_cache?: Record<string, { name?: string; gaia_name?: string; shortcut_name?: string }>;
  };
}

interface ArcSidebarItem {
  id?: string;
  title?: string | null;
  parentID?: string | null;
  savedURL?: string;
  url?: string;
  savedTitle?: string;
  data?: {
    tab?: {
      savedURL?: string;
      url?: string;
      savedTitle?: string;
    };
  };
}

interface ArcSidebarShape {
  sidebar?: {
    items?: Array<string | ArcSidebarItem>;
    containers?: Array<{
      topAppsContainerIDs?: Array<string | { [k: string]: unknown }>;
      items?: Array<string | ArcSidebarItem>;
      global?: { items?: Array<string | ArcSidebarItem> };
    }>;
  };
}

async function resolveChromiumCookiesPath(profileDir: string, options?: FsReadOptions): Promise<string | null> {
  const candidates = [path.join(profileDir, "Cookies"), path.join(profileDir, "Network", "Cookies")];
  for (const candidate of candidates) {
    if (await isFileReadable(candidate, options)) return candidate;
  }
  return null;
}

interface ChromiumDiscoveryResult {
  profiles: ChromiumProfileCandidate[];
  encounteredPermissionError: boolean;
}

async function resolveArcSidebarPath(
  def: BrowserDefinition,
  profileDir: string,
  options?: FsReadOptions
): Promise<string | null> {
  if (def.id !== "arc") return null;
  const candidates = [
    path.join(path.dirname(path.dirname(profileDir)), "StorableSidebar.json"),
    path.join(path.dirname(profileDir), "StorableSidebar.json")
  ];
  for (const candidate of candidates) {
    if (await isFileReadable(candidate, options)) return candidate;
  }
  return null;
}

async function discoverChromiumProfiles(
  def: BrowserDefinition,
  rootDirs: string[],
  options?: FsReadOptions
): Promise<ChromiumDiscoveryResult> {
  const candidates: ChromiumProfileCandidate[] = [];
  const seenDirs = new Set<string>();
  let encounteredPermissionError = false;

  for (const rootDir of rootDirs) {
    try {
      if (!(await isDirectory(rootDir, options))) continue;

      const localState = await readJsonSafe<LocalStateShape>(path.join(rootDir, "Local State"), options);
      const infoCache = localState?.profile?.info_cache ?? {};
      const lastUsed = localState?.profile?.last_used || "Default";

      // Collect potential profile subdirs + flat root (used by older Opera/custom installs)
      const dirEntries = await readDirEntries(rootDir, options);
      const subdirs = dirEntries
        .filter(
          (entry) =>
            entry.isDirectory() &&
            (entry.name === "Default" || /^Profile \d+$/i.test(entry.name) || entry.name in infoCache)
        )
        .map((entry) => ({
          dir: path.join(rootDir, entry.name),
          folderName: entry.name
        }));

      if (subdirs.length === 0) {
        subdirs.push({ dir: rootDir, folderName: "Default" });
      }

      for (const sub of subdirs) {
        if (seenDirs.has(sub.dir)) continue;

        try {
          const [
            hasBookmarks,
            hasHistory,
            hasWebData,
            hasPrefs,
            arcSidebarPath,
            hasLoginData,
            cookiesPath,
            hasLocalStorageDir,
            hasIdbDir
          ] = await Promise.all([
            isFileReadable(path.join(sub.dir, "Bookmarks"), options),
            isFileReadable(path.join(sub.dir, "History"), options),
            isFileReadable(path.join(sub.dir, "Web Data"), options),
            isFileReadable(path.join(sub.dir, "Preferences"), options),
            resolveArcSidebarPath(def, sub.dir, options),
            isFileReadable(path.join(sub.dir, "Login Data"), options),
            resolveChromiumCookiesPath(sub.dir, options),
            isDirectory(path.join(sub.dir, "Local Storage", "leveldb"), options),
            isDirectory(path.join(sub.dir, "IndexedDB"), options)
          ]);
          const hasArcSidebar = Boolean(arcSidebarPath);
          const hasSessions = Boolean(cookiesPath) || hasLocalStorageDir || hasIdbDir;

          if (!hasBookmarks && !hasHistory && !hasWebData && !hasArcSidebar && !hasLoginData && !hasSessions) continue;
          seenDirs.add(sub.dir);

          const meta = infoCache[sub.folderName];
          const displayName =
            meta?.name?.trim() ||
            meta?.gaia_name?.trim() ||
            (sub.folderName === "Default" ? "Default" : sub.folderName);

          candidates.push({
            id: sub.dir,
            name: displayName,
            dir: sub.dir,
            isDefault: sub.folderName === lastUsed || (sub.folderName === "Default" && candidates.length === 0),
            hasBookmarks: hasBookmarks || hasArcSidebar,
            hasHistory,
            hasSearchEngines: hasWebData || hasPrefs,
            hasPinnedTabs: hasArcSidebar,
            hasPasswords: hasLoginData,
            hasSessions
          });
        } catch (error) {
          if (isPermissionError(error)) {
            encounteredPermissionError = true;
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      if (isPermissionError(error)) {
        encounteredPermissionError = true;
        continue;
      }
      throw error;
    }
  }

  // Ensure default profile appears first
  candidates.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return { profiles: candidates, encounteredPermissionError };
}

function collectChromiumBookmarks(node: ChromiumBookmarkNode | undefined, out: ImportedBookmarkItem[]): void {
  if (!node) return;
  if (node.type === "url" && node.url && isImportableHttpUrl(node.url)) {
    out.push({
      title: (node.name || "").trim() || node.url,
      url: node.url,
      createdAt: chromeTimeToUnixMs(node.date_added)
    });
    return;
  }

  if (Array.isArray(node.children)) {
    // Skip deleted/trash containers (e.g. Opera trash)
    if (node.name?.trim().toLowerCase() === "trash") return;
    for (const child of node.children) {
      collectChromiumBookmarks(child, out);
    }
  }
}

async function readChromiumBookmarks(profileDir: string): Promise<ImportedBookmarkItem[]> {
  const json = await readJsonSafe<{ roots?: Record<string, ChromiumBookmarkNode> }>(path.join(profileDir, "Bookmarks"));
  if (!json?.roots) return [];

  const items: ImportedBookmarkItem[] = [];
  for (const [rootKey, rootNode] of Object.entries(json.roots)) {
    if (rootKey.toLowerCase() === "trash") continue;
    collectChromiumBookmarks(rootNode, items);
  }
  return items;
}

async function readArcSidebarItems(sidebarPath: string): Promise<{
  bookmarks: ImportedBookmarkItem[];
  pinnedTabs: ImportedPinnedTabItem[];
}> {
  const json = await readJsonSafe<ArcSidebarShape>(sidebarPath);
  const rawPool: Array<string | ArcSidebarItem> = [...(json?.sidebar?.items ?? [])];
  for (const container of json?.sidebar?.containers ?? []) {
    rawPool.push(...(container.items ?? []), ...(container.global?.items ?? []));
  }
  if (rawPool.length === 0) return { bookmarks: [], pinnedTabs: [] };

  const bookmarks: ImportedBookmarkItem[] = [];
  const pinnedTabs: ImportedPinnedTabItem[] = [];
  const seenPinned = new Set<string>();

  for (const entry of rawPool) {
    if (!entry || typeof entry !== "object") continue;
    const rawUrl = entry.data?.tab?.savedURL || entry.data?.tab?.url || entry.savedURL || entry.url;
    if (!rawUrl || !isImportableHttpUrl(rawUrl)) continue;

    const title = (entry.title || entry.data?.tab?.savedTitle || entry.savedTitle || rawUrl).trim();
    bookmarks.push({ title, url: rawUrl });

    const normalized = normalizeImportUrl(rawUrl);
    if (!seenPinned.has(normalized)) {
      seenPinned.add(normalized);
      pinnedTabs.push({ url: rawUrl, faviconURL: null });
    }
  }

  return { bookmarks, pinnedTabs };
}

async function readChromiumHistory(profileDir: string): Promise<ImportedHistoryItem[]> {
  const historyPath = path.join(profileDir, "History");
  if (!(await isFileReadable(historyPath))) return [];

  return withTempSqliteCopy(historyPath, (db) => {
    const rows = db
      .prepare(
        `SELECT url, COALESCE(title, '') AS title, visit_count, last_visit_time
         FROM urls
         WHERE hidden = 0 AND visit_count > 0
         ORDER BY last_visit_time DESC
         LIMIT ?`
      )
      .all(HISTORY_IMPORT_LIMIT) as Array<{
      url: string;
      title: string;
      visit_count: number;
      last_visit_time: number;
    }>;

    const items: ImportedHistoryItem[] = [];
    for (const row of rows) {
      if (!isImportableHttpUrl(row.url)) continue;
      items.push({
        url: row.url,
        title: row.title,
        visitCount: row.visit_count,
        visitTime: chromeTimeToUnixMs(row.last_visit_time)
      });
    }
    return items;
  });
}

async function countChromiumHistory(profileDir: string): Promise<number> {
  const historyPath = path.join(profileDir, "History");
  if (!(await isFileReadable(historyPath))) return 0;

  return withTempSqliteCopy(historyPath, (db) => {
    const row = db
      .prepare("SELECT COUNT(*) AS cnt FROM urls WHERE hidden = 0 AND visit_count > 0 AND url LIKE 'http%'")
      .get() as { cnt: number } | undefined;
    return Math.min(Number(row?.cnt ?? 0), HISTORY_IMPORT_LIMIT);
  });
}

async function readChromiumSearchEngines(profileDir: string): Promise<ImportedSearchEngineItem[]> {
  const engines: ImportedSearchEngineItem[] = [];
  const seenUrls = new Set<string>();

  const webDataPath = path.join(profileDir, "Web Data");
  if (await isFileReadable(webDataPath)) {
    try {
      const rows = await withTempSqliteCopy(webDataPath, (db) => {
        const cols = db.pragma("table_info(keywords)") as Array<{ name: string }>;
        if (!cols.some((c) => c.name === "url")) return [];
        const hasStarterPack = cols.some((c) => c.name === "starter_pack_id");
        const hasSuggestUrl = cols.some((c) => c.name === "suggest_url");
        const hasIsActive = cols.some((c) => c.name === "is_active");
        const hasUsageCount = cols.some((c) => c.name === "usage_count");

        const filters: string[] = [];
        if (hasStarterPack) filters.push("COALESCE(starter_pack_id, 0) = 0");
        if (hasIsActive && hasUsageCount) {
          filters.push("(COALESCE(is_active, 0) = 1 OR COALESCE(usage_count, 0) > 0)");
        } else if (hasUsageCount) {
          filters.push("COALESCE(usage_count, 0) > 0");
        }
        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

        return db
          .prepare(
            `SELECT short_name, keyword, url, ${hasSuggestUrl ? "suggest_url" : "'' AS suggest_url"}
             FROM keywords ${whereClause}
             LIMIT 100`
          )
          .all() as Array<{ short_name: string; keyword: string; url: string; suggest_url: string }>;
      });

      for (const row of rows) {
        const searchUrl = convertSearchUrlTemplate(row.url);
        if (!searchUrl || seenUrls.has(searchUrl)) continue;
        seenUrls.add(searchUrl);

        const suggestUrl = convertSearchUrlTemplate(row.suggest_url || "") ?? undefined;
        const name = (row.short_name || row.keyword || "Search").trim();
        engines.push({
          name,
          searchUrl,
          suggestUrl,
          shortcut: sanitizeShortcut(row.keyword || "", name)
        });
      }
    } catch {
      // Ignore malformed/unsupported Web Data tables
    }
  }

  const prefs = await readJsonSafe<{
    default_search_provider_data?: {
      template_url_data?: {
        short_name?: string;
        keyword?: string;
        url?: string;
        suggestions_url?: string;
      };
    };
  }>(path.join(profileDir, "Preferences"));

  const defData = prefs?.default_search_provider_data?.template_url_data;
  if (defData?.url) {
    const searchUrl = convertSearchUrlTemplate(defData.url);
    if (searchUrl && !seenUrls.has(searchUrl)) {
      seenUrls.add(searchUrl);
      const name = (defData.short_name || "Default Search").trim();
      engines.unshift({
        name,
        searchUrl,
        suggestUrl: convertSearchUrlTemplate(defData.suggestions_url || "") ?? undefined,
        shortcut: sanitizeShortcut(defData.keyword || "", name)
      });
    }
  }

  return engines;
}

export async function readChromiumPasswordMetadataWithoutKeychain(
  profileDir: string
): Promise<Array<{ originUrl: string; username: string }>> {
  const loginDbPath = path.join(profileDir, "Login Data");
  if (!(await isFileReadable(loginDbPath))) return [];

  return withTempSqliteCopy(loginDbPath, (db) => {
    const rows = db
      .prepare(
        `SELECT origin_url, username_value
         FROM logins
         WHERE blacklisted_by_user = 0
           AND origin_url IS NOT NULL
           AND password_value IS NOT NULL
           AND length(password_value) > 0`
      )
      .all() as Array<{ origin_url: string; username_value: string | null }>;

    const items: Array<{ originUrl: string; username: string }> = [];
    for (const row of rows) {
      if (!isImportableHttpUrl(row.origin_url)) continue;
      items.push({
        originUrl: row.origin_url,
        username: (row.username_value ?? "").trim()
      });
    }
    return items;
  }).catch(() => []);
}

export interface ChromiumSessionPreviewMetadata {
  cookies: Array<{ cleanHost: string; name: string; path: string; touchUtc: number }>;
  maxCookieTouchUtc: number;
  localStorageOrigins: ImportedLocalStorageOrigin[];
  indexedDbDirNames: string[];
}

export async function readChromiumSessionMetadataWithoutKeychain(
  profileDir: string
): Promise<ChromiumSessionPreviewMetadata> {
  const cookiesPath = await resolveChromiumCookiesPath(profileDir);
  let cookies: Array<{ cleanHost: string; name: string; path: string; touchUtc: number }> = [];
  let maxCookieTouchUtc = 0;

  if (cookiesPath) {
    cookies = await withTempSqliteCopy(cookiesPath, (db) => {
      const cols = new Set((db.pragma("table_info(cookies)") as Array<{ name: string }>).map((c) => c.name));
      const hasHasExpires = cols.has("has_expires");
      const hasLastUpdate = cols.has("last_update_utc");
      const hasCreation = cols.has("creation_utc");
      const touchExpr =
        hasLastUpdate && hasCreation
          ? "MAX(COALESCE(last_update_utc, 0), COALESCE(creation_utc, 0))"
          : hasLastUpdate
            ? "COALESCE(last_update_utc, 0)"
            : hasCreation
              ? "COALESCE(creation_utc, 0)"
              : "0";

      const rows = db
        .prepare(
          `SELECT host_key, name, path, expires_utc, ${touchExpr} AS touch_utc${hasHasExpires ? ", has_expires" : ""}
           FROM cookies
           WHERE host_key IS NOT NULL AND host_key != ''
             AND name IS NOT NULL AND name != ''`
        )
        .all() as Array<{
        host_key: string;
        name: string;
        path: string | null;
        expires_utc: number;
        touch_utc: number;
        has_expires?: number;
      }>;

      const nowUnixSec = Math.floor(Date.now() / 1000);
      const valid: Array<{ cleanHost: string; name: string; path: string; touchUtc: number }> = [];

      for (const row of rows) {
        const shouldExpire = hasHasExpires ? row.has_expires !== 0 : row.expires_utc > 0;
        if (shouldExpire && row.expires_utc > 0) {
          const expMs = chromeTimeToUnixMs(row.expires_utc);
          if (expMs && Math.floor(expMs / 1000) <= nowUnixSec) continue;
        }
        const cleanHost = row.host_key.trim().replace(/^\.+/, "").toLowerCase();
        if (!cleanHost) continue;
        const touchUtc = Number(row.touch_utc || 0);
        valid.push({
          cleanHost,
          name: row.name,
          path: row.path && row.path.startsWith("/") ? row.path : "/",
          touchUtc
        });
      }
      return valid;
    }).catch(() => []);

    for (const c of cookies) {
      if (c.touchUtc > maxCookieTouchUtc) maxCookieTouchUtc = c.touchUtc;
    }
  }

  let localStorageOrigins: ImportedLocalStorageOrigin[] = [];
  const lsDir = path.join(profileDir, "Local Storage", "leveldb");
  if (await isDirectory(lsDir)) {
    localStorageOrigins = await readChromiumLocalStorage(lsDir).catch(() => []);
  }

  const idbDirs = await readChromiumIndexedDbDirs(profileDir).catch(() => []);
  const indexedDbDirNames = idbDirs.map((d) => d.dirName);

  return {
    cookies,
    maxCookieTouchUtc,
    localStorageOrigins,
    indexedDbDirNames
  };
}

async function countChromiumPasswords(profileDir: string): Promise<number> {
  const loginDbPath = path.join(profileDir, "Login Data");
  if (!(await isFileReadable(loginDbPath))) return 0;

  return withTempSqliteCopy(loginDbPath, (db) => {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM logins
         WHERE blacklisted_by_user = 0
           AND origin_url IS NOT NULL
           AND password_value IS NOT NULL
           AND length(password_value) > 0`
      )
      .get() as { cnt?: number } | undefined;
    return row?.cnt ?? 0;
  });
}

async function readChromiumPasswords(
  profileDir: string,
  aesKey: Buffer | null
): Promise<{ passwords: ImportedPasswordItem[]; undecryptableCount: number }> {
  const loginDbPath = path.join(profileDir, "Login Data");
  if (!(await isFileReadable(loginDbPath))) {
    return { passwords: [], undecryptableCount: 0 };
  }

  return withTempSqliteCopy(loginDbPath, (db) => {
    const cols = new Set((db.pragma("table_info(logins)") as Array<{ name: string }>).map((c) => c.name));
    const titleSel = cols.has("display_name") ? "display_name" : "NULL";
    const lastUsedSel = cols.has("date_last_used") ? "date_last_used" : "0";

    const rows = db
      .prepare(
        `SELECT origin_url, action_url, username_value, password_value, date_created,
                ${titleSel} AS display_name, ${lastUsedSel} AS date_last_used
         FROM logins
         WHERE blacklisted_by_user = 0
           AND origin_url IS NOT NULL
           AND password_value IS NOT NULL
           AND length(password_value) > 0`
      )
      .all() as Array<{
      origin_url: string;
      action_url: string | null;
      username_value: string | null;
      password_value: Buffer;
      date_created: number;
      display_name: string | null;
      date_last_used: number;
    }>;

    const passwords: ImportedPasswordItem[] = [];
    let undecryptableCount = 0;

    for (const row of rows) {
      if (!isImportableHttpUrl(row.origin_url)) continue;
      const buf = Buffer.isBuffer(row.password_value) ? row.password_value : Buffer.from(row.password_value);
      const decrypted = decryptChromiumEncryptedValue(buf, aesKey);
      if (decrypted === null) {
        undecryptableCount++;
        continue;
      }
      if (!decrypted) continue;

      passwords.push({
        originUrl: row.origin_url,
        actionUrl: row.action_url ?? undefined,
        username: (row.username_value ?? "").trim(),
        password: decrypted,
        title: row.display_name?.trim() || undefined,
        createdAt: chromeTimeToUnixMs(row.date_created),
        lastUsedAt: chromeTimeToUnixMs(row.date_last_used)
      });
    }

    return { passwords, undecryptableCount };
  });
}

async function countChromiumCookies(profileDir: string): Promise<number> {
  const cookiesPath = await resolveChromiumCookiesPath(profileDir);
  if (!cookiesPath) return 0;

  return withTempSqliteCopy(cookiesPath, (db) => {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM cookies
         WHERE host_key IS NOT NULL AND host_key != ''
           AND name IS NOT NULL AND name != ''`
      )
      .get() as { cnt?: number } | undefined;
    return row?.cnt ?? 0;
  });
}

async function readChromiumCookies(
  profileDir: string,
  aesKey: Buffer | null
): Promise<{ cookies: ImportedCookieItem[]; undecryptableCount: number }> {
  const cookiesPath = await resolveChromiumCookiesPath(profileDir);
  if (!cookiesPath) return { cookies: [], undecryptableCount: 0 };

  return withTempSqliteCopy(cookiesPath, (db) => {
    let schemaVersion = 0;
    try {
      const metaRow = db.prepare("SELECT value FROM meta WHERE key = 'version'").get() as
        { value?: string } | undefined;
      schemaVersion = Number.parseInt(metaRow?.value ?? "0", 10) || 0;
    } catch {
      schemaVersion = 0;
    }

    const cols = new Set((db.pragma("table_info(cookies)") as Array<{ name: string }>).map((c) => c.name));
    const hasHasExpires = cols.has("has_expires");

    const rows = db
      .prepare(
        `SELECT host_key, name, value, encrypted_value, path, expires_utc,
                is_secure, is_httponly, samesite${hasHasExpires ? ", has_expires" : ""}
         FROM cookies
         WHERE host_key IS NOT NULL AND host_key != ''
           AND name IS NOT NULL AND name != ''`
      )
      .all() as Array<{
      host_key: string;
      name: string;
      value: string | null;
      encrypted_value: Buffer | null;
      path: string | null;
      expires_utc: number;
      is_secure: number;
      is_httponly: number;
      samesite: number;
      has_expires?: number;
    }>;

    const cookies: ImportedCookieItem[] = [];
    let undecryptableCount = 0;
    const nowUnixSec = Math.floor(Date.now() / 1000);

    for (const row of rows) {
      let value = row.value ?? "";
      if (!value && row.encrypted_value && row.encrypted_value.length > 0) {
        const enc = Buffer.isBuffer(row.encrypted_value) ? row.encrypted_value : Buffer.from(row.encrypted_value);
        const decrypted = decryptChromiumEncryptedValue(enc, aesKey, schemaVersion >= 24 ? row.host_key : undefined);
        if (decrypted === null) {
          undecryptableCount++;
          continue;
        }
        value = decrypted;
      }

      let expirationDate: number | undefined;
      const shouldExpire = hasHasExpires ? row.has_expires !== 0 : row.expires_utc > 0;
      if (shouldExpire && row.expires_utc > 0) {
        const expMs = chromeTimeToUnixMs(row.expires_utc);
        if (expMs) {
          const expSec = Math.floor(expMs / 1000);
          if (expSec <= nowUnixSec) continue; // Skip already-expired cookies
          expirationDate = expSec;
        }
      }

      cookies.push({
        hostKey: row.host_key,
        name: row.name,
        value,
        path: row.path || "/",
        secure: row.is_secure !== 0,
        httpOnly: row.is_httponly !== 0,
        sameSite: row.samesite,
        expirationDate
      });
    }

    return { cookies, undecryptableCount };
  });
}

async function readChromiumIndexedDbDirs(profileDir: string): Promise<ImportedIndexedDbDir[]> {
  const idbRoot = path.join(profileDir, "IndexedDB");
  const result: ImportedIndexedDbDir[] = [];
  const entries = await readDirEntries(idbRoot);
  const entryNames = new Set(entries.map((e) => e.name));

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith(".indexeddb.leveldb")) continue;
    // Skip extension IDB directories; only import http(s) web origins
    if (!entry.name.startsWith("http_") && !entry.name.startsWith("https_")) continue;

    const blobDirName = entry.name.replace(/\.indexeddb\.leveldb$/, ".indexeddb.blob");
    const hasBlob = entryNames.has(blobDirName);

    result.push({
      dirName: entry.name,
      sourcePath: path.join(idbRoot, entry.name),
      ...(hasBlob ? { blobDirName, blobSourcePath: path.join(idbRoot, blobDirName) } : {})
    });
  }

  return result;
}

export const chromiumAdapter: BrowserFamilyAdapter = {
  async scan(def, rootDirs): Promise<DetectedBrowser | null> {
    try {
      const { profiles, encounteredPermissionError } = await discoverChromiumProfiles(def, rootDirs, {
        throwOnPermissionError: true
      });
      if (profiles.length === 0) {
        return encounteredPermissionError ? createPermissionRequiredBrowser(def) : null;
      }

      const mapped: DetectedBrowserProfile[] = profiles.map((p) => ({
        id: p.id,
        name: p.name,
        isDefault: p.isDefault,
        available: {
          bookmarks: p.hasBookmarks,
          history: p.hasHistory,
          pinnedTabs: p.hasPinnedTabs,
          searchEngines: p.hasSearchEngines,
          passwords: p.hasPasswords,
          sessions: p.hasSessions
        }
      }));

      return {
        id: def.id,
        name: def.name,
        family: def.family,
        profiles: mapped
      };
    } catch (error) {
      if (isPermissionError(error)) {
        return createPermissionRequiredBrowser(def);
      }
      return null;
    }
  },

  async preview(def, _rootDirs, profileId): Promise<ImportCategoryCounts> {
    const counts = emptyImportCounts();
    const arcSidebarPath = await resolveArcSidebarPath(def, profileId);

    const [bookmarks, arcData, historyCount, engines, passwordsCount, cookiesCount, storageOriginsCount] =
      await Promise.all([
        readChromiumBookmarks(profileId).catch(() => []),
        arcSidebarPath ? readArcSidebarItems(arcSidebarPath).catch(() => ({ bookmarks: [], pinnedTabs: [] })) : null,
        countChromiumHistory(profileId).catch(() => 0),
        readChromiumSearchEngines(profileId).catch(() => []),
        countChromiumPasswords(profileId).catch(() => 0),
        countChromiumCookies(profileId).catch(() => 0),
        countChromiumStorageOrigins(profileId).catch(() => 0)
      ]);

    const seenBookmarks = new Set(bookmarks.map((b) => normalizeImportUrl(b.url)));
    let extraArcBookmarks = 0;
    if (arcData) {
      for (const b of arcData.bookmarks) {
        const key = normalizeImportUrl(b.url);
        if (!seenBookmarks.has(key)) {
          seenBookmarks.add(key);
          extraArcBookmarks++;
        }
      }
      counts.pinnedTabs = arcData.pinnedTabs.length;
    }

    counts.bookmarks = bookmarks.length + extraArcBookmarks;
    counts.history = historyCount;
    counts.searchEngines = engines.length;
    counts.passwords = passwordsCount;
    counts.sessions = cookiesCount + storageOriginsCount;
    return counts;
  },

  async extract(def, rootDirs, profileId, categories) {
    const { profiles } = await discoverChromiumProfiles(def, rootDirs);
    const matched = profiles.find((p) => p.id === profileId);
    const data: ExtractedBrowserData = createEmptyExtractedData();
    const errors: string[] = [];

    const arcSidebarPath = await resolveArcSidebarPath(def, profileId);
    const arcDataPromise =
      arcSidebarPath && (categories.has("bookmarks") || categories.has("pinnedTabs"))
        ? readArcSidebarItems(arcSidebarPath).catch(() => ({ bookmarks: [], pinnedTabs: [] }))
        : Promise.resolve({ bookmarks: [], pinnedTabs: [] });

    // Derive Safe Storage AES key once per import so macOS Keychain prompts only once.
    const needsSafeStorage = categories.has("passwords") || categories.has("sessions");
    const aesKey = needsSafeStorage ? await getChromiumSafeStorageAesKey(def.id) : null;

    if (categories.has("bookmarks")) {
      try {
        const baseBookmarks = await readChromiumBookmarks(profileId);
        const arcData = await arcDataPromise;
        data.bookmarks = [...baseBookmarks, ...arcData.bookmarks];
      } catch (err) {
        errors.push(`Failed reading bookmarks: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (categories.has("pinnedTabs")) {
      try {
        const arcData = await arcDataPromise;
        data.pinnedTabs = arcData.pinnedTabs;
      } catch (err) {
        errors.push(`Failed reading pinned tabs: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (categories.has("history")) {
      try {
        data.history = await readChromiumHistory(profileId);
      } catch (err) {
        errors.push(`Failed reading history: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (categories.has("searchEngines")) {
      try {
        data.searchEngines = await readChromiumSearchEngines(profileId);
      } catch (err) {
        errors.push(`Failed reading search engines: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (categories.has("passwords")) {
      try {
        const pwRes = await readChromiumPasswords(profileId, aesKey);
        data.passwords = pwRes.passwords;
        if (pwRes.undecryptableCount > 0) {
          errors.push(
            `Skipped ${pwRes.undecryptableCount} ${def.name} password(s) because Safe Storage decryption key access was unavailable or denied.`
          );
        }
      } catch (err) {
        errors.push(`Failed reading passwords: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (categories.has("sessions")) {
      try {
        const cookieRes = await readChromiumCookies(profileId, aesKey);
        data.cookies = cookieRes.cookies;
        if (cookieRes.undecryptableCount > 0) {
          errors.push(
            `Skipped ${cookieRes.undecryptableCount} encrypted ${def.name} cookie(s) because Safe Storage Keychain access was unavailable or denied.`
          );
        }
      } catch (err) {
        errors.push(`Failed reading cookies: ${err instanceof Error ? err.message : String(err)}`);
      }

      try {
        const lsDir = path.join(profileId, "Local Storage", "leveldb");
        if (await isDirectory(lsDir)) {
          const decoded: ImportedLocalStorageOrigin[] = await readChromiumLocalStorage(lsDir);
          data.localStorage = decoded;
        }
      } catch (err) {
        errors.push(`Failed reading localStorage: ${err instanceof Error ? err.message : String(err)}`);
      }

      try {
        data.indexedDbDirs = await readChromiumIndexedDbDirs(profileId);
      } catch {
        // Non-fatal
      }
    }

    return {
      profileName: matched?.name || path.basename(profileId),
      data,
      errors
    };
  }
};
