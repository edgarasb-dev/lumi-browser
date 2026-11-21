import type {
  BrowserImportRequest,
  BrowserImportResult,
  DetectedBrowser,
  HtmlBookmarkImportResult,
  ImportCategoryCounts
} from "~/types/importer";

export type PrivacySettingsPane = "fullDisk" | "filesAndFolders";

export interface LumiImporterAPI {
  scanBrowsers: () => Promise<DetectedBrowser[]>;
  previewProfile: (browserId: string, profileId: string) => Promise<ImportCategoryCounts>;
  importFromBrowser: (request: BrowserImportRequest) => Promise<BrowserImportResult>;
  importFromHtmlFile: () => Promise<HtmlBookmarkImportResult>;
  openPrivacySettings: (pane?: PrivacySettingsPane) => Promise<boolean>;
}
