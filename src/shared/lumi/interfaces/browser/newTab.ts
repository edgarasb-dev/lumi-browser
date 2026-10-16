export type NewTabMode = "omnibox" | "tab";

// API //
export interface LumiNewTabAPI {
  /**
   * Opens a new tab
   */
  open: () => void;
}
