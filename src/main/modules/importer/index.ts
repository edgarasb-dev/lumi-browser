import fs from "fs/promises";
import { addFavouritesBatch } from "@/saving/favourites";
import { importBrowsingHistoryEntries } from "@/saving/history/browsing-history";
import { addSearchEngine, getAllSearchEngines, onSearchEnginesLoaded } from "@/saving/search-engines";
import { pinnedTabsController } from "@/controllers/pinned-tabs-controller";
import type {
  BrowserEngineFamily,
  BrowserImportRequest,
  BrowserImportResult,
  DetectedBrowser,
  ImportCategoryCounts,
  ImportDataCategory
} from "~/types/importer";
import { chromiumAdapter } from "./parsers/chromium";
import { flowAdapter } from "./parsers/flow";
import { geckoAdapter } from "./parsers/gecko";
import { parseNetscapeBookmarksHtml } from "./parsers/html";
import { safariFamilyAdapter } from "./parsers/safari";
import { BROWSER_REGISTRY, resolveBrowserRootDirs } from "./registry";
import type { BrowserDefinition, BrowserFamilyAdapter } from "./types";
import { emptyImportCounts, normalizeImportUrl } from "./utils";

const MAX_PINNED_TABS_PER_IMPORT = 50;

const ADAPTERS: Record<BrowserEngineFamily, BrowserFamilyAdapter> = {
  chromium: chromiumAdapter,
  gecko: geckoAdapter,
  safari: safariFamilyAdapter,
  orion: safariFamilyAdapter,
  duckduckgo: safariFamilyAdapter,
  flow: flowAdapter
};

function findBrowserDefinition(browserId: string): BrowserDefinition | undefined {
  return BROWSER_REGISTRY.find((entry) => entry.id === browserId);
}

/**
 * Scans all known browser data directories on the current OS in parallel and returns
 * every detected browser installation and its available profiles.
 */
export async function scanInstalledBrowsers(): Promise<DetectedBrowser[]> {
  const scans = await Promise.all(
    BROWSER_REGISTRY.map(async (def) => {
      try {
        const rootDirs = await resolveBrowserRootDirs(def);
        if (rootDirs.length === 0) return null;
        return await ADAPTERS[def.family].scan(def, rootDirs);
      } catch {
        return null;
      }
    })
  );

  const detected = scans.filter((entry): entry is DetectedBrowser => entry !== null);
  detected.sort((a, b) => Number(b.profiles.length > 0) - Number(a.profiles.length));
  return detected;
}

/**
 * Counts importable items in a specific detected browser profile without writing any data.
 */
export async function previewBrowserProfile(browserId: string, profileId: string): Promise<ImportCategoryCounts> {
  const def = findBrowserDefinition(browserId);
  if (!def) return emptyImportCounts();

  const rootDirs = await resolveBrowserRootDirs(def);
  return ADAPTERS[def.family].preview(def, rootDirs, profileId).catch(() => emptyImportCounts());
}

/**
 * Imports selected categories (bookmarks, history, pinned tabs, search engines) from an
 * external browser profile into the requested Lumi profile, deduplicating existing items.
 */
export async function executeBrowserImport(
  request: BrowserImportRequest,
  fallbackProfileId: string = "main"
): Promise<BrowserImportResult> {
  const def = findBrowserDefinition(request.browserId);
  const imported = emptyImportCounts();
  const skippedDuplicates = emptyImportCounts();

  if (!def) {
    return {
      success: false,
      browserName: request.browserId,
      profileName: request.profileId,
      imported,
      skippedDuplicates,
      errors: [`Unknown browser: ${request.browserId}`]
    };
  }

  const rootDirs = await resolveBrowserRootDirs(def);
  const categories = new Set<ImportDataCategory>(request.categories);
  const targetProfileId = request.targetProfileId || fallbackProfileId;

  const extracted = await ADAPTERS[def.family].extract(def, rootDirs, request.profileId, categories);
  const errors = [...extracted.errors];

  // 1. Bookmarks -> Lumi Favourites
  if (categories.has("bookmarks") && extracted.data.bookmarks.length > 0) {
    const dedupedByUrl = new Map<string, { title: string; url: string; createdAt?: number }>();
    for (const item of extracted.data.bookmarks) {
      const key = normalizeImportUrl(item.url);
      if (!dedupedByUrl.has(key)) {
        dedupedByUrl.set(key, item);
      }
    }
    const items = Array.from(dedupedByUrl.values());
    const addedCount = await addFavouritesBatch(items);
    imported.bookmarks = addedCount;
    skippedDuplicates.bookmarks = Math.max(0, extracted.data.bookmarks.length - addedCount);
  }

  // 2. Browsing History -> Lumi SQLite history
  if (categories.has("history") && extracted.data.history.length > 0) {
    const addedCount = importBrowsingHistoryEntries(targetProfileId, extracted.data.history);
    imported.history = addedCount;
    skippedDuplicates.history = Math.max(0, extracted.data.history.length - addedCount);
  }

  // 3. Pinned Tabs -> Lumi pinned_tabs
  if (categories.has("pinnedTabs") && extracted.data.pinnedTabs.length > 0) {
    const existingPinned = new Set(
      pinnedTabsController.getByProfile(targetProfileId).map((pt) => normalizeImportUrl(pt.defaultUrl))
    );
    let added = 0;
    let skipped = 0;

    for (const item of extracted.data.pinnedTabs.slice(0, MAX_PINNED_TABS_PER_IMPORT)) {
      const normalized = normalizeImportUrl(item.url);
      if (existingPinned.has(normalized)) {
        skipped++;
        continue;
      }
      existingPinned.add(normalized);
      pinnedTabsController.create(targetProfileId, item.url, item.faviconURL ?? null);
      added++;
    }

    imported.pinnedTabs = added;
    skippedDuplicates.pinnedTabs = skipped;
  }

  // 4. Search Engines -> Lumi search engines store
  if (categories.has("searchEngines") && extracted.data.searchEngines.length > 0) {
    await onSearchEnginesLoaded();
    const existingEngines = getAllSearchEngines();
    const existingKeys = new Set(existingEngines.map((e) => normalizeSearchTemplate(e.searchUrl)));
    const existingNames = new Set(existingEngines.map((e) => e.name.trim().toLowerCase()));
    const usedShortcuts = new Set(existingEngines.map((e) => e.shortcut.trim().toLowerCase()));

    let added = 0;
    let skipped = 0;

    for (const engine of extracted.data.searchEngines) {
      const templateKey = normalizeSearchTemplate(engine.searchUrl);
      const nameKey = engine.name.trim().toLowerCase();
      if (existingKeys.has(templateKey) || existingNames.has(nameKey)) {
        skipped++;
        continue;
      }

      let shortcut = engine.shortcut;
      let suffix = 2;
      while (usedShortcuts.has(shortcut)) {
        shortcut = `${engine.shortcut}${suffix}`;
        suffix++;
      }

      const created = await addSearchEngine({
        name: engine.name,
        searchUrl: engine.searchUrl,
        suggestUrl: engine.suggestUrl,
        shortcut
      });
      if (created) {
        existingKeys.add(templateKey);
        existingNames.add(nameKey);
        usedShortcuts.add(shortcut);
        added++;
      } else {
        skipped++;
      }
    }

    imported.searchEngines = added;
    skippedDuplicates.searchEngines = skipped;
  }

  return {
    success: errors.length === 0 || Object.values(imported).some((count) => count > 0),
    browserName: def.name,
    profileName: extracted.profileName,
    imported,
    skippedDuplicates,
    errors
  };
}

/**
 * Parses and imports bookmarks from a Netscape Bookmark HTML export file.
 */
export async function importBookmarksHtmlFile(filePath: string): Promise<number> {
  const html = await fs.readFile(filePath, "utf8");
  const bookmarks = parseNetscapeBookmarksHtml(html);
  if (bookmarks.length === 0) return 0;
  return addFavouritesBatch(bookmarks);
}

function normalizeSearchTemplate(searchUrl: string): string {
  try {
    const u = new URL(searchUrl.replace("%s", "QUERY"));
    return `${u.origin}${u.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return searchUrl.trim().toLowerCase();
  }
}
