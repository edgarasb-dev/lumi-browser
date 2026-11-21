import fs from "fs/promises";
import path from "path";
import type { DetectedBrowser, DetectedBrowserProfile, ImportCategoryCounts } from "~/types/importer";
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
  chromeTimeToUnixMs,
  convertSearchUrlTemplate,
  emptyImportCounts,
  isDirectory,
  isFileReadable,
  isImportableHttpUrl,
  isPermissionError,
  normalizeImportUrl,
  readJsonSafe,
  sanitizeShortcut,
  withTempSqliteCopy
} from "../utils";

const HISTORY_IMPORT_LIMIT = 8000;

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

async function resolveArcSidebarPath(def: BrowserDefinition, profileDir: string): Promise<string | null> {
  if (def.id !== "arc") return null;
  const candidates = [
    path.join(path.dirname(path.dirname(profileDir)), "StorableSidebar.json"),
    path.join(path.dirname(profileDir), "StorableSidebar.json")
  ];
  for (const candidate of candidates) {
    if (await isFileReadable(candidate)) return candidate;
  }
  return null;
}

async function discoverChromiumProfiles(
  def: BrowserDefinition,
  rootDirs: string[]
): Promise<ChromiumProfileCandidate[]> {
  const candidates: ChromiumProfileCandidate[] = [];
  const seenDirs = new Set<string>();

  for (const rootDir of rootDirs) {
    if (!(await isDirectory(rootDir))) continue;

    const localState = await readJsonSafe<LocalStateShape>(path.join(rootDir, "Local State"));
    const infoCache = localState?.profile?.info_cache ?? {};
    const lastUsed = localState?.profile?.last_used || "Default";

    // Collect potential profile subdirs + flat root (used by older Opera/custom installs)
    const dirEntries = await fs.readdir(rootDir, { withFileTypes: true }).catch(() => []);
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

      const hasBookmarks = await isFileReadable(path.join(sub.dir, "Bookmarks"));
      const hasHistory = await isFileReadable(path.join(sub.dir, "History"));
      const hasWebData = await isFileReadable(path.join(sub.dir, "Web Data"));
      const hasPrefs = await isFileReadable(path.join(sub.dir, "Preferences"));
      const arcSidebarPath = await resolveArcSidebarPath(def, sub.dir);
      const hasArcSidebar = Boolean(arcSidebarPath);

      if (!hasBookmarks && !hasHistory && !hasWebData && !hasArcSidebar) continue;
      seenDirs.add(sub.dir);

      const meta = infoCache[sub.folderName];
      const displayName =
        meta?.name?.trim() || meta?.gaia_name?.trim() || (sub.folderName === "Default" ? "Default" : sub.folderName);

      candidates.push({
        id: sub.dir,
        name: displayName,
        dir: sub.dir,
        isDefault: sub.folderName === lastUsed || (sub.folderName === "Default" && candidates.length === 0),
        hasBookmarks: hasBookmarks || hasArcSidebar,
        hasHistory,
        hasSearchEngines: hasWebData || hasPrefs,
        hasPinnedTabs: hasArcSidebar
      });
    }
  }

  // Ensure default profile appears first
  candidates.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return candidates;
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

export const chromiumAdapter: BrowserFamilyAdapter = {
  async scan(def, rootDirs): Promise<DetectedBrowser | null> {
    try {
      const profiles = await discoverChromiumProfiles(def, rootDirs);
      if (profiles.length === 0) return null;

      const mapped: DetectedBrowserProfile[] = profiles.map((p) => ({
        id: p.id,
        name: p.name,
        isDefault: p.isDefault,
        available: {
          bookmarks: p.hasBookmarks,
          history: p.hasHistory,
          pinnedTabs: p.hasPinnedTabs,
          searchEngines: p.hasSearchEngines
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

  async preview(def, _rootDirs, profileId): Promise<ImportCategoryCounts> {
    const counts = emptyImportCounts();
    const arcSidebarPath = await resolveArcSidebarPath(def, profileId);

    const [bookmarks, arcData, historyCount, engines] = await Promise.all([
      readChromiumBookmarks(profileId).catch(() => []),
      arcSidebarPath ? readArcSidebarItems(arcSidebarPath).catch(() => ({ bookmarks: [], pinnedTabs: [] })) : null,
      countChromiumHistory(profileId).catch(() => 0),
      readChromiumSearchEngines(profileId).catch(() => [])
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
    return counts;
  },

  async extract(def, rootDirs, profileId, categories) {
    const profiles = await discoverChromiumProfiles(def, rootDirs);
    const matched = profiles.find((p) => p.id === profileId);
    const data: ExtractedBrowserData = {
      bookmarks: [],
      history: [],
      pinnedTabs: [],
      searchEngines: []
    };
    const errors: string[] = [];

    const arcSidebarPath = await resolveArcSidebarPath(def, profileId);
    const arcDataPromise =
      arcSidebarPath && (categories.has("bookmarks") || categories.has("pinnedTabs"))
        ? readArcSidebarItems(arcSidebarPath).catch(() => ({ bookmarks: [], pinnedTabs: [] }))
        : Promise.resolve({ bookmarks: [], pinnedTabs: [] });

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

    return {
      profileName: matched?.name || path.basename(profileId),
      data,
      errors
    };
  }
};
