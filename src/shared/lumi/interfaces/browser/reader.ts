import type { ReaderArticle, ReaderPreferences, ReaderTabState } from "~/types/reader";

export type LumiReaderAPI = {
  toggle: (tabId: number) => Promise<ReaderTabState>;
  enable: (tabId: number) => Promise<ReaderTabState>;
  disable: (tabId: number) => Promise<boolean>;
  getArticle: (tabId: number) => Promise<ReaderArticle | null>;
  getPreferences: () => Promise<ReaderPreferences>;
  updatePreferences: (updates: Partial<ReaderPreferences>) => Promise<ReaderPreferences>;
  onStateChanged: (callback: (state: ReaderTabState) => void) => () => void;
  onPreferencesChanged: (callback: (preferences: ReaderPreferences) => void) => () => void;
};
