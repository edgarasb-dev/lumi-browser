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

export interface ExtractedBrowserData {
  bookmarks: ImportedBookmarkItem[];
  history: ImportedHistoryItem[];
  pinnedTabs: ImportedPinnedTabItem[];
  searchEngines: ImportedSearchEngineItem[];
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
