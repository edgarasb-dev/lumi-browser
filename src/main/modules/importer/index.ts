import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { addFavouritesBatch, getAllFavourites } from "@/saving/favourites";
import { getDatastore } from "@/saving/datastore";
import { isPasswordEncryptionAvailable } from "@/modules/passwords/crypto";
import { normalizeCredentialOrigin } from "@/modules/passwords/utils";
import { countNewBrowsingHistoryEntries, importBrowsingHistoryEntries } from "@/saving/history/browsing-history";
import { importCredentialsBatch, listSavedPasswordsForProfile } from "@/saving/passwords";
import { addSearchEngine, getAllSearchEngines, onSearchEnginesLoaded } from "@/saving/search-engines";
import { pinnedTabsController } from "@/controllers/pinned-tabs-controller";
import { profilesController } from "@/controllers/profiles-controller";
import type {
  BrowserEngineFamily,
  BrowserImportRequest,
  BrowserImportResult,
  DetectedBrowser,
  ImportCategoryCounts,
  ImportDataCategory,
  SessionImportBreakdown
} from "~/types/importer";
import {
  chromiumAdapter,
  readChromiumPasswordMetadataWithoutKeychain,
  readChromiumSessionMetadataWithoutKeychain
} from "./parsers/chromium";
import { flowAdapter } from "./parsers/flow";
import { geckoAdapter } from "./parsers/gecko";
import { parseNetscapeBookmarksHtml } from "./parsers/html";
import { safariFamilyAdapter } from "./parsers/safari";
import { BROWSER_REGISTRY, resolveBrowserRootDirs } from "./registry";
import { importSessionDataIntoProfile } from "./session-import";
import type { BrowserDefinition, BrowserFamilyAdapter, ImportedLocalStorageOrigin } from "./types";
import { emptyImportCounts, normalizeImportUrl } from "./utils";

const MAX_PINNED_TABS_PER_IMPORT = 50;
const ImporterStateStore = getDatastore("importer-state");

interface StoredProfileImportLedger {
  updatedAt: number;
  passwordsProcessedKeys?: string[];
  sessionsImportedAt?: number;
  maxCookieTouchUtc?: number;
  localStorageOriginHashes?: Record<string, string>;
}

function getLedgerKey(targetProfileId: string, browserId: string, sourceProfileId: string): string {
  const hash = crypto.createHash("sha1").update(`${targetProfileId}::${browserId}::${sourceProfileId}`).digest("hex");
  return `ledger_${hash}`;
}

function hashLocalStorageOrigins(origins: ImportedLocalStorageOrigin[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of origins) {
    const sorted = [...item.entries].sort((a, b) => a[0].localeCompare(b[0]));
    out[item.origin] = crypto.createHash("sha1").update(JSON.stringify(sorted)).digest("hex").slice(0, 16);
  }
  return out;
}

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
 * Counts importable (new or modified) items in a specific detected browser profile compared against
 * what is already present in `targetProfileId`, without writing any data or triggering OS Keychain prompts.
 */
export async function previewBrowserProfile(
  browserId: string,
  profileId: string,
  targetProfileId: string = "main"
): Promise<ImportCategoryCounts> {
  const def = findBrowserDefinition(browserId);
  if (!def) return emptyImportCounts();

  const rootDirs = await resolveBrowserRootDirs(def);
  const rawCounts = await ADAPTERS[def.family].preview(def, rootDirs, profileId).catch(() => emptyImportCounts());

  const newCounts = emptyImportCounts();
  const alreadyImported = emptyImportCounts();

  try {
    const ledger = await ImporterStateStore.get<StoredProfileImportLedger>(
      getLedgerKey(targetProfileId, browserId, profileId)
    ).catch(() => null);

    const nonKeychainCategories = new Set<ImportDataCategory>();
    if (rawCounts.bookmarks > 0) nonKeychainCategories.add("bookmarks");
    if (rawCounts.history > 0) nonKeychainCategories.add("history");
    if (rawCounts.pinnedTabs > 0) nonKeychainCategories.add("pinnedTabs");
    if (rawCounts.searchEngines > 0) nonKeychainCategories.add("searchEngines");
    if (rawCounts.passwords > 0 && def.family !== "chromium") nonKeychainCategories.add("passwords");

    const extracted =
      nonKeychainCategories.size > 0
        ? await ADAPTERS[def.family].extract(def, rootDirs, profileId, nonKeychainCategories).catch(() => null)
        : null;

    // 1. Bookmarks diff
    if (rawCounts.bookmarks > 0) {
      if (extracted && extracted.data.bookmarks.length > 0) {
        const existingFavs = new Set((await getAllFavourites()).map((f) => normalizeImportUrl(f.url)));
        const seenSource = new Set<string>();
        for (const b of extracted.data.bookmarks) {
          const key = normalizeImportUrl(b.url);
          if (seenSource.has(key)) continue;
          seenSource.add(key);
          if (existingFavs.has(key)) {
            alreadyImported.bookmarks++;
          } else {
            newCounts.bookmarks++;
          }
        }
      } else {
        newCounts.bookmarks = rawCounts.bookmarks;
      }
    }

    // 2. Browsing History diff
    if (rawCounts.history > 0) {
      if (extracted && extracted.data.history.length > 0) {
        const hStats = countNewBrowsingHistoryEntries(targetProfileId, extracted.data.history);
        newCounts.history = hStats.newCount;
        alreadyImported.history = hStats.alreadyImportedCount;
      } else {
        newCounts.history = rawCounts.history;
      }
    }

    // 3. Pinned Tabs diff
    if (rawCounts.pinnedTabs > 0) {
      if (extracted && extracted.data.pinnedTabs.length > 0) {
        const existingPinned = new Set(
          pinnedTabsController.getByProfile(targetProfileId).map((pt) => normalizeImportUrl(pt.defaultUrl))
        );
        const seenSource = new Set<string>();
        for (const item of extracted.data.pinnedTabs.slice(0, MAX_PINNED_TABS_PER_IMPORT)) {
          const key = normalizeImportUrl(item.url);
          if (seenSource.has(key)) continue;
          seenSource.add(key);
          if (existingPinned.has(key)) {
            alreadyImported.pinnedTabs++;
          } else {
            newCounts.pinnedTabs++;
          }
        }
      } else {
        newCounts.pinnedTabs = rawCounts.pinnedTabs;
      }
    }

    // 4. Search Engines diff
    if (rawCounts.searchEngines > 0) {
      if (extracted && extracted.data.searchEngines.length > 0) {
        await onSearchEnginesLoaded();
        const existingEngines = getAllSearchEngines();
        const existingKeys = new Set(existingEngines.map((e) => normalizeSearchTemplate(e.searchUrl)));
        const existingNames = new Set(existingEngines.map((e) => e.name.trim().toLowerCase()));
        const seenTemplates = new Set<string>();
        const seenNames = new Set<string>();

        for (const engine of extracted.data.searchEngines) {
          const templateKey = normalizeSearchTemplate(engine.searchUrl);
          const nameKey = engine.name.trim().toLowerCase();
          if (seenTemplates.has(templateKey) || seenNames.has(nameKey)) continue;
          seenTemplates.add(templateKey);
          seenNames.add(nameKey);
          if (existingKeys.has(templateKey) || existingNames.has(nameKey)) {
            alreadyImported.searchEngines++;
          } else {
            newCounts.searchEngines++;
          }
        }
      } else {
        newCounts.searchEngines = rawCounts.searchEngines;
      }
    }

    // 5. Saved Passwords diff (zero Keychain prompts)
    if (rawCounts.passwords > 0) {
      const savedPasswords = listSavedPasswordsForProfile(targetProfileId);
      const savedPwKeys = new Set(savedPasswords.map((p) => `${p.origin}\u0000${p.username}`));
      const ledgerPwKeys = new Set(savedPwKeys.size > 0 ? (ledger?.passwordsProcessedKeys ?? []) : []);

      const sourceItems =
        def.family === "chromium"
          ? await readChromiumPasswordMetadataWithoutKeychain(profileId)
          : (extracted?.data.passwords ?? []);

      if (sourceItems.length > 0) {
        const seenSource = new Set<string>();
        for (const item of sourceItems) {
          const origin = normalizeCredentialOrigin(item.originUrl);
          if (!origin) continue;
          const key = `${origin}\u0000${item.username.trim()}`;
          if (seenSource.has(key)) continue;
          seenSource.add(key);
          if (savedPwKeys.has(key) || ledgerPwKeys.has(key)) {
            alreadyImported.passwords++;
          } else {
            newCounts.passwords++;
          }
        }
      } else {
        newCounts.passwords = rawCounts.passwords;
      }
    }

    // 6. Cookies & Active Sessions diff (zero Keychain prompts)
    if (rawCounts.sessions > 0) {
      if (def.family === "chromium") {
        const sessionMeta = await readChromiumSessionMetadataWithoutKeychain(profileId);
        if (ledger?.sessionsImportedAt) {
          const maxTouch = ledger.maxCookieTouchUtc ?? 0;
          for (const c of sessionMeta.cookies) {
            if (c.touchUtc > maxTouch) {
              newCounts.sessions++;
            } else {
              alreadyImported.sessions++;
            }
          }

          const currentLsHashes = hashLocalStorageOrigins(sessionMeta.localStorageOrigins);
          const prevLsHashes = ledger.localStorageOriginHashes ?? {};
          for (const [origin, hash] of Object.entries(currentLsHashes)) {
            if (prevLsHashes[origin] === hash) {
              alreadyImported.sessions++;
            } else {
              newCounts.sessions++;
            }
          }

          const targetIdbRoot = path.join(profilesController.getProfilePath(targetProfileId), "IndexedDB");
          const existingIdbNames = new Set(await fs.readdir(targetIdbRoot).catch(() => [] as string[]));
          for (const dirName of sessionMeta.indexedDbDirNames) {
            if (existingIdbNames.has(dirName)) {
              alreadyImported.sessions++;
            } else {
              newCounts.sessions++;
            }
          }
        } else {
          newCounts.sessions =
            sessionMeta.cookies.length + sessionMeta.localStorageOrigins.length + sessionMeta.indexedDbDirNames.length;
        }
      } else {
        newCounts.sessions = rawCounts.sessions;
      }
    }
  } catch {
    return rawCounts;
  }

  return {
    ...newCounts,
    alreadyImported
  };
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

  // 5. Saved Passwords -> Lumi per-profile Password Manager
  if (categories.has("passwords") && extracted.data.passwords.length > 0) {
    if (!isPasswordEncryptionAvailable()) {
      errors.push(
        "Skipped importing passwords: OS Keychain / Keyring encryption is unavailable (plaintext storage is disabled)."
      );
      skippedDuplicates.passwords = extracted.data.passwords.length;
    } else {
      const pwStats = importCredentialsBatch(
        targetProfileId,
        extracted.data.passwords.map((item) => ({
          originUrl: item.originUrl,
          actionUrl: item.actionUrl,
          username: item.username,
          password: item.password,
          title: item.title,
          createdAt: item.createdAt,
          lastUsedAt: item.lastUsedAt
        })),
        { overwriteExisting: false }
      );
      imported.passwords = pwStats.imported;
      skippedDuplicates.passwords = pwStats.skipped;
    }
  }

  // 6. Sessions (Cookies + localStorage + IndexedDB) -> Lumi Chromium profile partition
  let sessionDetails: SessionImportBreakdown | undefined;
  if (
    categories.has("sessions") &&
    (extracted.data.cookies.length > 0 ||
      extracted.data.localStorage.length > 0 ||
      extracted.data.indexedDbDirs.length > 0)
  ) {
    sessionDetails = await importSessionDataIntoProfile(
      targetProfileId,
      extracted.data.cookies,
      extracted.data.localStorage,
      extracted.data.indexedDbDirs
    );
    imported.sessions = sessionDetails.cookies + sessionDetails.localStorageOrigins + sessionDetails.indexedDbOrigins;
  }

  // 7. Persist import ledger watermarks for password/session change detection
  if (categories.has("passwords") || categories.has("sessions")) {
    try {
      const ledgerKey = getLedgerKey(targetProfileId, request.browserId, request.profileId);
      const prevLedger = (await ImporterStateStore.get<StoredProfileImportLedger>(ledgerKey).catch(() => null)) ?? {
        updatedAt: Date.now()
      };
      const nextLedger: StoredProfileImportLedger = {
        ...prevLedger,
        updatedAt: Date.now()
      };

      if (categories.has("passwords") && isPasswordEncryptionAvailable() && extracted.data.passwords.length > 0) {
        const metaItems =
          def.family === "chromium"
            ? await readChromiumPasswordMetadataWithoutKeychain(request.profileId)
            : extracted.data.passwords;
        const processedKeys = new Set<string>(prevLedger.passwordsProcessedKeys ?? []);
        for (const item of metaItems) {
          const origin = normalizeCredentialOrigin(item.originUrl);
          if (origin) {
            processedKeys.add(`${origin}\u0000${item.username.trim()}`);
          }
        }
        nextLedger.passwordsProcessedKeys = Array.from(processedKeys);
      }

      if (categories.has("sessions") && def.family === "chromium") {
        const sessionMeta = await readChromiumSessionMetadataWithoutKeychain(request.profileId);
        nextLedger.sessionsImportedAt = Date.now();
        if (sessionMeta.cookies.length === 0 || extracted.data.cookies.length > 0) {
          nextLedger.maxCookieTouchUtc = sessionMeta.maxCookieTouchUtc;
        }
        nextLedger.localStorageOriginHashes = hashLocalStorageOrigins(sessionMeta.localStorageOrigins);
      }

      await ImporterStateStore.set(ledgerKey, nextLedger);
    } catch {
      // Non-fatal if watermark persistence fails
    }
  }

  return {
    success: errors.length === 0 || Object.values(imported).some((count) => typeof count === "number" && count > 0),
    browserName: def.name,
    profileName: extracted.profileName,
    imported,
    skippedDuplicates,
    ...(sessionDetails ? { sessionDetails } : {}),
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
