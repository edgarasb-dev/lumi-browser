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
  createPermissionRequiredBrowser,
  emptyImportCounts,
  type FsReadOptions,
  isDirectory,
  isFileReadable,
  isImportableHttpUrl,
  isPermissionError,
  readDirEntries,
  readJsonSafe,
  withTempSqliteCopy
} from "../utils";

const HISTORY_IMPORT_LIMIT = 8000;

interface FlowProfileMeta {
  id: string;
  name: string;
  rootDir: string;
  isDefault: boolean;
}

function encodeProfileKey(rootDir: string, flowProfileId: string): string {
  return JSON.stringify([rootDir, flowProfileId]);
}

function decodeProfileKey(key: string): { rootDir: string; flowProfileId: string } {
  try {
    const parsed = JSON.parse(key) as [string, string];
    if (Array.isArray(parsed) && parsed.length === 2) {
      return { rootDir: parsed[0], flowProfileId: parsed[1] };
    }
  } catch {
    // Fallback
  }
  return { rootDir: key, flowProfileId: "main" };
}

interface FlowDiscoveryResult {
  profiles: FlowProfileMeta[];
  encounteredPermissionError: boolean;
}

async function discoverFlowProfiles(rootDirs: string[], options?: FsReadOptions): Promise<FlowDiscoveryResult> {
  const results: FlowProfileMeta[] = [];
  const seen = new Set<string>();
  let encounteredPermissionError = false;

  for (const rootDir of rootDirs) {
    try {
      if (!(await isDirectory(rootDir, options))) continue;

      const profilesDir = path.join(rootDir, "datastore", "profiles");
      const entries = await readDirEntries(profilesDir, options);
      const foundIds = new Set<string>();

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const meta = await readJsonSafe<{ name?: string; internal?: boolean }>(
          path.join(profilesDir, entry.name, "main.json"),
          options
        );
        if (meta?.internal) continue;
        foundIds.add(entry.name);

        const id = encodeProfileKey(rootDir, entry.name);
        if (seen.has(id)) continue;
        seen.add(id);

        results.push({
          id,
          name: meta?.name?.trim() || (entry.name === "main" ? "Main" : entry.name),
          rootDir,
          isDefault: entry.name === "main"
        });
      }

      if (foundIds.size === 0 && (await isFileReadable(path.join(rootDir, "flow.db"), options))) {
        const id = encodeProfileKey(rootDir, "main");
        if (!seen.has(id)) {
          seen.add(id);
          results.push({ id, name: "Main", rootDir, isDefault: true });
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

  results.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return { profiles: results, encounteredPermissionError };
}

async function readFlowFavourites(rootDir: string): Promise<ImportedBookmarkItem[]> {
  const data = await readJsonSafe<{ list?: Array<{ title?: string; url?: string; createdAt?: number }> }>(
    path.join(rootDir, "datastore", "favourites.json")
  );
  if (!Array.isArray(data?.list)) return [];

  return data.list
    .filter((item) => typeof item.url === "string" && isImportableHttpUrl(item.url))
    .map((item) => ({
      title: (item.title || "").trim() || item.url!,
      url: item.url!,
      createdAt: item.createdAt
    }));
}

async function readFlowSearchEngines(rootDir: string): Promise<ImportedSearchEngineItem[]> {
  const data = await readJsonSafe<{
    custom_engines?: Array<{ name?: string; searchUrl?: string; suggestUrl?: string; shortcut?: string }>;
  }>(path.join(rootDir, "datastore", "search_engines.json"));

  if (!Array.isArray(data?.custom_engines)) return [];
  return data.custom_engines
    .filter((e) => e.searchUrl && e.searchUrl.includes("%s") && e.name)
    .map((e) => ({
      name: e.name!.trim(),
      searchUrl: e.searchUrl!.trim(),
      suggestUrl: e.suggestUrl?.trim() || undefined,
      shortcut: (e.shortcut || e.name!.charAt(0)).trim().toLowerCase()
    }));
}

async function readFlowDbData(
  rootDir: string,
  flowProfileId: string
): Promise<{
  history: ImportedHistoryItem[];
  pinnedTabs: ImportedPinnedTabItem[];
  historyCount: number;
  pinnedCount: number;
}> {
  const dbPath = path.join(rootDir, "flow.db");
  if (!(await isFileReadable(dbPath))) {
    return { history: [], pinnedTabs: [], historyCount: 0, pinnedCount: 0 };
  }

  return withTempSqliteCopy(dbPath, (db) => {
    const tables = new Set(
      (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map(
        (t) => t.name
      )
    );

    const history: ImportedHistoryItem[] = [];
    if (tables.has("history_urls")) {
      const rows = db
        .prepare(
          `SELECT url, COALESCE(title, '') AS title, visit_count, last_visit_time
           FROM history_urls
           WHERE profile_id = ?
           ORDER BY last_visit_time DESC
           LIMIT ?`
        )
        .all(flowProfileId, HISTORY_IMPORT_LIMIT) as Array<{
        url: string;
        title: string;
        visit_count: number;
        last_visit_time: number;
      }>;

      for (const row of rows) {
        if (!isImportableHttpUrl(row.url)) continue;
        history.push({
          url: row.url,
          title: row.title,
          visitCount: row.visit_count,
          visitTime: row.last_visit_time
        });
      }
    }

    const pinnedTabs: ImportedPinnedTabItem[] = [];
    if (tables.has("pinned_tabs")) {
      const rows = db
        .prepare(
          `SELECT default_url, favicon_url
           FROM pinned_tabs
           WHERE profile_id = ?
           ORDER BY position ASC`
        )
        .all(flowProfileId) as Array<{ default_url: string; favicon_url: string | null }>;

      for (const row of rows) {
        if (!isImportableHttpUrl(row.default_url)) continue;
        pinnedTabs.push({
          url: row.default_url,
          faviconURL: row.favicon_url
        });
      }
    }

    return {
      history,
      pinnedTabs,
      historyCount: history.length,
      pinnedCount: pinnedTabs.length
    };
  });
}

export const flowAdapter: BrowserFamilyAdapter = {
  async scan(def: BrowserDefinition, rootDirs: string[]): Promise<DetectedBrowser | null> {
    let encounteredPermissionError = false;
    const readOpts: FsReadOptions = { throwOnPermissionError: true };

    try {
      const discovery = await discoverFlowProfiles(rootDirs, readOpts);
      encounteredPermissionError = discovery.encounteredPermissionError;
      if (discovery.profiles.length === 0) {
        return encounteredPermissionError ? createPermissionRequiredBrowser(def) : null;
      }

      const mapped: DetectedBrowserProfile[] = [];
      for (const p of discovery.profiles) {
        try {
          const [hasDb, hasFavs, hasEngines] = await Promise.all([
            isFileReadable(path.join(p.rootDir, "flow.db"), readOpts),
            isFileReadable(path.join(p.rootDir, "datastore", "favourites.json"), readOpts),
            isFileReadable(path.join(p.rootDir, "datastore", "search_engines.json"), readOpts)
          ]);

          if (!hasDb && !hasFavs && !hasEngines) continue;
          mapped.push({
            id: p.id,
            name: p.name,
            isDefault: p.isDefault,
            available: {
              bookmarks: hasFavs,
              history: hasDb,
              pinnedTabs: hasDb,
              searchEngines: hasEngines
            }
          });
        } catch (error) {
          if (isPermissionError(error)) {
            encounteredPermissionError = true;
            continue;
          }
          throw error;
        }
      }

      if (mapped.length === 0) {
        return encounteredPermissionError ? createPermissionRequiredBrowser(def) : null;
      }
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

  async preview(_def, _rootDirs, profileId): Promise<ImportCategoryCounts> {
    const { rootDir, flowProfileId } = decodeProfileKey(profileId);
    const counts = emptyImportCounts();

    const [favs, engines, dbData] = await Promise.all([
      readFlowFavourites(rootDir).catch(() => []),
      readFlowSearchEngines(rootDir).catch(() => []),
      readFlowDbData(rootDir, flowProfileId).catch(() => ({
        history: [],
        pinnedTabs: [],
        historyCount: 0,
        pinnedCount: 0
      }))
    ]);

    counts.bookmarks = favs.length;
    counts.history = dbData.historyCount;
    counts.pinnedTabs = dbData.pinnedCount;
    counts.searchEngines = engines.length;
    return counts;
  },

  async extract(_def, rootDirs, profileId, categories: Set<ImportDataCategory>) {
    const { profiles } = await discoverFlowProfiles(rootDirs);
    const matched = profiles.find((p) => p.id === profileId);
    const { rootDir, flowProfileId } = decodeProfileKey(profileId);

    const data: ExtractedBrowserData = {
      bookmarks: [],
      history: [],
      pinnedTabs: [],
      searchEngines: []
    };
    const errors: string[] = [];

    if (categories.has("bookmarks")) {
      data.bookmarks = await readFlowFavourites(rootDir).catch(() => []);
    }

    if (categories.has("history") || categories.has("pinnedTabs")) {
      try {
        const dbData = await readFlowDbData(rootDir, flowProfileId);
        if (categories.has("history")) data.history = dbData.history;
        if (categories.has("pinnedTabs")) data.pinnedTabs = dbData.pinnedTabs;
      } catch (err) {
        errors.push(`Failed reading Flow database: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (categories.has("searchEngines")) {
      data.searchEngines = await readFlowSearchEngines(rootDir).catch(() => []);
    }

    return {
      profileName: matched?.name || flowProfileId,
      data,
      errors
    };
  }
};
