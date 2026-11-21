import fs from "fs/promises";
import path from "path";
import type {
  DetectedBrowser,
  DetectedBrowserProfile,
  ImportCategoryCounts,
  ImportDataCategory
} from "~/types/importer";
import type {
  BrowserDefinition,
  BrowserFamilyAdapter,
  ExtractedBrowserData,
  ImportedBookmarkItem,
  ImportedHistoryItem,
  ImportedPinnedTabItem,
  ImportedSearchEngineItem
} from "../types";
import {
  convertSearchUrlTemplate,
  emptyImportCounts,
  isDirectory,
  isFileReadable,
  isImportableHttpUrl,
  isPermissionError,
  normalizeImportUrl,
  prTimeToUnixMs,
  readMozLz4Json,
  sanitizeShortcut,
  withTempSqliteCopy
} from "../utils";

const HISTORY_IMPORT_LIMIT = 8000;

interface GeckoProfileCandidate {
  id: string;
  name: string;
  dir: string;
  isDefault: boolean;
  hasPlaces: boolean;
}

function parseProfilesIni(content: string, rootDir: string): Array<{ name: string; dir: string; isDefault: boolean }> {
  const profiles: Array<{ name: string; dir: string; isDefault: boolean }> = [];
  const defaultPaths = new Set<string>();
  const lines = content.split(/\r?\n/);

  let section = "";
  let cur: { name?: string; rawPath?: string; isRelative?: boolean; isDefault?: boolean } = {};

  const flush = () => {
    if (section.startsWith("Profile") && cur.rawPath) {
      const resolved = cur.isRelative !== false ? path.join(rootDir, cur.rawPath) : cur.rawPath;
      profiles.push({
        name: cur.name?.trim() || path.basename(resolved),
        dir: resolved,
        isDefault: Boolean(cur.isDefault)
      });
    }
    cur = {};
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      flush();
      section = line.slice(1, -1);
      continue;
    }

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();

    if (section.startsWith("Install") && key === "Default") {
      defaultPaths.add(path.join(rootDir, val));
    } else if (section.startsWith("Profile")) {
      if (key === "Name") cur.name = val;
      else if (key === "Path") cur.rawPath = val;
      else if (key === "IsRelative") cur.isRelative = val === "1";
      else if (key === "Default" && val === "1") cur.isDefault = true;
    }
  }
  flush();

  for (const prof of profiles) {
    if (defaultPaths.has(prof.dir)) {
      prof.isDefault = true;
    }
  }

  return profiles;
}

async function discoverGeckoProfiles(rootDirs: string[]): Promise<GeckoProfileCandidate[]> {
  const candidates: GeckoProfileCandidate[] = [];
  const seenDirs = new Set<string>();

  for (const rootDir of rootDirs) {
    if (!(await isDirectory(rootDir))) continue;

    const parsedFromIni: Array<{ name: string; dir: string; isDefault: boolean }> = [];
    const iniPath = path.join(rootDir, "profiles.ini");
    if (await isFileReadable(iniPath)) {
      const content = await fs.readFile(iniPath, "utf8").catch(() => "");
      if (content) {
        parsedFromIni.push(...parseProfilesIni(content, rootDir));
      }
    }

    // Fallback scan for Profiles/* or root profile folders
    const profilesFolder = path.join(rootDir, "Profiles");
    if (await isDirectory(profilesFolder)) {
      const entries = await fs.readdir(profilesFolder, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(profilesFolder, entry.name);
        if (!parsedFromIni.some((p) => p.dir === dir)) {
          parsedFromIni.push({
            name: entry.name.split(".").slice(1).join(".") || entry.name,
            dir,
            isDefault: /default-release/i.test(entry.name)
          });
        }
      }
    }

    for (const item of parsedFromIni) {
      if (seenDirs.has(item.dir)) continue;
      const placesPath = path.join(item.dir, "places.sqlite");
      const hasPlaces = await isFileReadable(placesPath);
      if (!hasPlaces) continue;

      seenDirs.add(item.dir);
      candidates.push({
        id: item.dir,
        name: item.name,
        dir: item.dir,
        isDefault: item.isDefault,
        hasPlaces
      });
    }
  }

  candidates.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return candidates;
}

function readGeckoBookmarks(placesPath: string): Promise<ImportedBookmarkItem[]> {
  return withTempSqliteCopy(placesPath, (db) => {
    const rows = db
      .prepare(
        `SELECT COALESCE(b.title, p.title, '') AS title, p.url, b.dateAdded
         FROM moz_bookmarks b
         JOIN moz_places p ON b.fk = p.id
         WHERE b.type = 1 AND p.url LIKE 'http%'`
      )
      .all() as Array<{ title: string; url: string; dateAdded: number | null }>;

    const items: ImportedBookmarkItem[] = [];
    for (const row of rows) {
      if (!isImportableHttpUrl(row.url)) continue;
      items.push({
        title: row.title.trim() || row.url,
        url: row.url,
        createdAt: prTimeToUnixMs(row.dateAdded)
      });
    }
    return items;
  });
}

function readGeckoHistory(placesPath: string): Promise<ImportedHistoryItem[]> {
  return withTempSqliteCopy(placesPath, (db) => {
    const rows = db
      .prepare(
        `SELECT url, COALESCE(title, '') AS title, visit_count, last_visit_date
         FROM moz_places
         WHERE hidden = 0 AND visit_count > 0 AND url LIKE 'http%'
         ORDER BY last_visit_date DESC
         LIMIT ?`
      )
      .all(HISTORY_IMPORT_LIMIT) as Array<{
      url: string;
      title: string;
      visit_count: number;
      last_visit_date: number | null;
    }>;

    const items: ImportedHistoryItem[] = [];
    for (const row of rows) {
      if (!isImportableHttpUrl(row.url)) continue;
      items.push({
        url: row.url,
        title: row.title,
        visitCount: row.visit_count,
        visitTime: prTimeToUnixMs(row.last_visit_date)
      });
    }
    return items;
  });
}

function readGeckoKeywordEngines(placesPath: string): Promise<ImportedSearchEngineItem[]> {
  return withTempSqliteCopy(placesPath, (db) => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='moz_keywords'")
      .all() as Array<{ name: string }>;
    if (tables.length === 0) return [];

    const rows = db
      .prepare(
        `SELECT k.keyword, p.url, COALESCE(MAX(b.title), p.title, k.keyword) AS title
         FROM moz_keywords k
         JOIN moz_places p ON k.place_id = p.id
         LEFT JOIN moz_bookmarks b ON b.fk = p.id
         WHERE p.url LIKE '%\\%s%' OR p.url LIKE '%{searchTerms}%'
         GROUP BY k.keyword, p.url`
      )
      .all() as Array<{ keyword: string; url: string; title: string }>;

    const items: ImportedSearchEngineItem[] = [];
    for (const row of rows) {
      const normalizedTemplate = row.url.includes("%s") ? row.url : convertSearchUrlTemplate(row.url);
      if (
        !normalizedTemplate ||
        (!normalizedTemplate.startsWith("http://") && !normalizedTemplate.startsWith("https://"))
      ) {
        continue;
      }
      const name = (row.title || row.keyword || "Search").trim();
      items.push({
        name,
        searchUrl: normalizedTemplate,
        shortcut: sanitizeShortcut(row.keyword || "", name)
      });
    }
    return items;
  });
}

interface MozLz4SessionShape {
  windows?: Array<{
    tabs?: Array<{
      pinned?: boolean;
      index?: number;
      entries?: Array<{ url?: string }>;
    }>;
  }>;
  tabs?: Array<{
    pinned?: boolean;
    zenEssential?: boolean;
    index?: number;
    entries?: Array<{ url?: string }>;
  }>;
  items?: Array<{
    savedURL?: string;
    url?: string;
    data?: { tab?: { savedURL?: string; url?: string } };
  }>;
}

function collectPinnedTabsFromSessionPayload(
  payload: MozLz4SessionShape | null,
  out: ImportedPinnedTabItem[],
  seen: Set<string>
): void {
  if (!payload) return;

  const pushUrl = (url: string | undefined) => {
    if (!url || !isImportableHttpUrl(url)) return;
    const key = normalizeImportUrl(url);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url, faviconURL: null });
  };

  for (const win of payload.windows ?? []) {
    for (const tab of win.tabs ?? []) {
      if (!tab.pinned) continue;
      const entries = tab.entries ?? [];
      const activeIdx = typeof tab.index === "number" ? Math.max(0, tab.index - 1) : entries.length - 1;
      pushUrl(entries[activeIdx]?.url ?? entries[entries.length - 1]?.url);
    }
  }

  for (const tab of payload.tabs ?? []) {
    if (!tab.pinned && !tab.zenEssential) continue;
    const entries = tab.entries ?? [];
    const activeIdx = typeof tab.index === "number" ? Math.max(0, tab.index - 1) : entries.length - 1;
    pushUrl(entries[activeIdx]?.url ?? entries[entries.length - 1]?.url);
  }

  for (const item of payload.items ?? []) {
    pushUrl(item?.data?.tab?.savedURL || item?.data?.tab?.url || item?.savedURL || item?.url);
  }
}

async function readGeckoPinnedTabs(profileDir: string, placesPath: string): Promise<ImportedPinnedTabItem[]> {
  const pinnedTabs: ImportedPinnedTabItem[] = [];
  const seen = new Set<string>();

  // 1. Modern Zen (`zen-sessions.jsonlz4`) and standard Firefox (`sessionstore.jsonlz4`)
  const sessionFiles = [
    path.join(profileDir, "zen-sessions.jsonlz4"),
    path.join(profileDir, "sessionstore.jsonlz4"),
    path.join(profileDir, "sessionstore-backups", "recovery.jsonlz4"),
    path.join(profileDir, "sessionstore-backups", "previous.jsonlz4")
  ];

  for (const file of sessionFiles) {
    if (!(await isFileReadable(file))) continue;
    const decoded = await readMozLz4Json<MozLz4SessionShape>(file);
    collectPinnedTabsFromSessionPayload(decoded, pinnedTabs, seen);
  }

  // 2. Legacy Zen `< 1.18` `zen_pins` table inside `places.sqlite`
  if (await isFileReadable(placesPath)) {
    try {
      const legacyUrls = await withTempSqliteCopy(placesPath, (db) => {
        const hasPins = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='zen_pins'").get() as
          { name: string } | undefined;
        if (!hasPins) return [];

        const cols = (db.pragma("table_info(zen_pins)") as Array<{ name: string }>).map((c) => c.name);
        if (!cols.includes("url")) return [];
        const deletedFilter = cols.includes("deleted") ? "WHERE COALESCE(deleted, 0) = 0" : "";
        return db.prepare(`SELECT url FROM zen_pins ${deletedFilter}`).all() as Array<{ url: string }>;
      });

      for (const row of legacyUrls) {
        if (!row.url || !isImportableHttpUrl(row.url)) continue;
        const key = normalizeImportUrl(row.url);
        if (seen.has(key)) continue;
        seen.add(key);
        pinnedTabs.push({ url: row.url, faviconURL: null });
      }
    } catch {
      // Ignore legacy table errors on non-Zen DBs
    }
  }

  return pinnedTabs;
}

function countGeckoPlaces(placesPath: string): Promise<ImportCategoryCounts> {
  return withTempSqliteCopy(placesPath, (db) => {
    const counts = emptyImportCounts();
    const bm = db
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM moz_bookmarks b
         JOIN moz_places p ON b.fk = p.id
         WHERE b.type = 1 AND p.url LIKE 'http%'`
      )
      .get() as { cnt: number } | undefined;
    const hist = db
      .prepare("SELECT COUNT(*) AS cnt FROM moz_places WHERE hidden = 0 AND visit_count > 0 AND url LIKE 'http%'")
      .get() as { cnt: number } | undefined;

    const kwTables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='moz_keywords'")
      .all() as Array<{ name: string }>;
    let kwCount = 0;
    if (kwTables.length > 0) {
      const kw = db
        .prepare(
          `SELECT COUNT(*) AS cnt
           FROM moz_keywords k
           JOIN moz_places p ON k.place_id = p.id
           WHERE (p.url LIKE '%\\%s%' OR p.url LIKE '%{searchTerms}%') AND p.url LIKE 'http%'`
        )
        .get() as { cnt: number } | undefined;
      kwCount = Number(kw?.cnt ?? 0);
    }

    counts.bookmarks = Number(bm?.cnt ?? 0);
    counts.history = Math.min(Number(hist?.cnt ?? 0), HISTORY_IMPORT_LIMIT);
    counts.searchEngines = kwCount;
    return counts;
  });
}

export const geckoAdapter: BrowserFamilyAdapter = {
  async scan(def: BrowserDefinition, rootDirs: string[]): Promise<DetectedBrowser | null> {
    try {
      const profiles = await discoverGeckoProfiles(rootDirs);
      if (profiles.length === 0) return null;

      const mapped: DetectedBrowserProfile[] = await Promise.all(
        profiles.map(async (p) => {
          const hasSessionPinned =
            (await isFileReadable(path.join(p.dir, "zen-sessions.jsonlz4"))) ||
            (await isFileReadable(path.join(p.dir, "sessionstore.jsonlz4"))) ||
            (await isFileReadable(path.join(p.dir, "sessionstore-backups", "recovery.jsonlz4")));

          return {
            id: p.id,
            name: p.name,
            isDefault: p.isDefault,
            available: {
              bookmarks: p.hasPlaces,
              history: p.hasPlaces,
              pinnedTabs: hasSessionPinned || def.id === "zen",
              searchEngines: p.hasPlaces
            }
          };
        })
      );

      return {
        id: def.id,
        name: def.name,
        family: def.family,
        profiles: mapped
      };
    } catch (error) {
      if (isPermissionError(error)) {
        return {
          id: def.id,
          name: def.name,
          family: def.family,
          profiles: [],
          permissionRequired: true
        };
      }
      return null;
    }
  },

  async preview(_def: BrowserDefinition, _rootDirs: string[], profileId: string): Promise<ImportCategoryCounts> {
    const placesPath = path.join(profileId, "places.sqlite");
    const [counts, pinned] = await Promise.all([
      (await isFileReadable(placesPath))
        ? countGeckoPlaces(placesPath).catch(() => emptyImportCounts())
        : Promise.resolve(emptyImportCounts()),
      readGeckoPinnedTabs(profileId, placesPath).catch(() => [])
    ]);
    counts.pinnedTabs = pinned.length;
    return counts;
  },

  async extract(_def: BrowserDefinition, rootDirs: string[], profileId: string, categories: Set<ImportDataCategory>) {
    const profiles = await discoverGeckoProfiles(rootDirs);
    const matched = profiles.find((p) => p.id === profileId);
    const placesPath = path.join(profileId, "places.sqlite");

    const data: ExtractedBrowserData = {
      bookmarks: [],
      history: [],
      pinnedTabs: [],
      searchEngines: []
    };
    const errors: string[] = [];

    if (categories.has("bookmarks")) {
      try {
        data.bookmarks = await readGeckoBookmarks(placesPath);
      } catch (err) {
        errors.push(`Failed reading bookmarks: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (categories.has("history")) {
      try {
        data.history = await readGeckoHistory(placesPath);
      } catch (err) {
        errors.push(`Failed reading history: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (categories.has("pinnedTabs")) {
      try {
        data.pinnedTabs = await readGeckoPinnedTabs(profileId, placesPath);
      } catch (err) {
        errors.push(`Failed reading pinned tabs: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (categories.has("searchEngines")) {
      try {
        data.searchEngines = await readGeckoKeywordEngines(placesPath);
      } catch (err) {
        errors.push(`Failed reading search keywords: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      profileName: matched?.name || path.basename(profileId),
      data,
      errors
    };
  }
};
