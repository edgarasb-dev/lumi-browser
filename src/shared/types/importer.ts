export type BrowserEngineFamily = "chromium" | "gecko" | "safari" | "orion" | "duckduckgo" | "flow";

export type ImportDataCategory = "bookmarks" | "history" | "pinnedTabs" | "searchEngines";

export type ImportCategoryAvailability = Record<ImportDataCategory, boolean>;

export type ImportCategoryCounts = Record<ImportDataCategory, number>;

export interface DetectedBrowserProfile {
  id: string;
  name: string;
  isDefault: boolean;
  available: ImportCategoryAvailability;
  counts?: ImportCategoryCounts;
}

export interface DetectedBrowser {
  id: string;
  name: string;
  family: BrowserEngineFamily;
  profiles: DetectedBrowserProfile[];
  permissionRequired?: boolean;
  error?: string;
}

export interface BrowserImportRequest {
  browserId: string;
  profileId: string;
  targetProfileId?: string;
  categories: ImportDataCategory[];
}

export interface BrowserImportResult {
  success: boolean;
  browserName: string;
  profileName: string;
  imported: ImportCategoryCounts;
  skippedDuplicates: ImportCategoryCounts;
  errors: string[];
}

export interface HtmlBookmarkImportResult {
  canceled: boolean;
  filePath?: string;
  importedBookmarks: number;
  error?: string;
}
