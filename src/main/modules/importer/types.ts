import type { BrowserEngineFamily, DetectedBrowser, ImportCategoryCounts, ImportDataCategory } from "~/types/importer";

export interface BrowserDefinition {
  id: string;
  name: string;
  family: BrowserEngineFamily;
  paths: {
    darwin?: string[];
    win32?: string[];
    linux?: string[];
  };
}

export interface ImportedBookmarkItem {
  title: string;
  url: string;
  createdAt?: number;
}

export interface ImportedHistoryItem {
  url: string;
  title: string;
  visitTime: number;
  visitCount?: number;
}

export interface ImportedPinnedTabItem {
  url: string;
  faviconURL?: string | null;
}

export interface ImportedSearchEngineItem {
  name: string;
  searchUrl: string;
  suggestUrl?: string;
  shortcut: string;
}

export interface ImportedPasswordItem {
  originUrl: string;
  actionUrl?: string;
  username: string;
  password: string;
  title?: string;
  createdAt?: number;
  lastUsedAt?: number;
}

export interface ImportedCookieItem {
  hostKey: string;
  name: string;
  value: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: number;
  expirationDate?: number;
}

export interface ImportedLocalStorageOrigin {
  origin: string;
  entries: Array<[string, string]>;
}

export interface ImportedIndexedDbDir {
  dirName: string;
  sourcePath: string;
  blobDirName?: string;
  blobSourcePath?: string;
}

export interface ExtractedBrowserData {
  bookmarks: ImportedBookmarkItem[];
  history: ImportedHistoryItem[];
  pinnedTabs: ImportedPinnedTabItem[];
  searchEngines: ImportedSearchEngineItem[];
  passwords: ImportedPasswordItem[];
  cookies: ImportedCookieItem[];
  localStorage: ImportedLocalStorageOrigin[];
  indexedDbDirs: ImportedIndexedDbDir[];
}

export interface BrowserFamilyAdapter {
  scan: (def: BrowserDefinition, rootDirs: string[]) => Promise<DetectedBrowser | null>;
  preview: (def: BrowserDefinition, rootDirs: string[], profileId: string) => Promise<ImportCategoryCounts>;
  extract: (
    def: BrowserDefinition,
    rootDirs: string[],
    profileId: string,
    categories: Set<ImportDataCategory>
  ) => Promise<{ profileName: string; data: ExtractedBrowserData; errors: string[] }>;
}
