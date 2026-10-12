export interface SearchEngine {
  id: string;
  name: string;
  searchUrl: string; // URL template with %s for the query
  suggestUrl?: string; // Optional URL template for autocomplete suggestions
  shortcut: string; // Keyword shortcut (e.g., "g", "d", "yt")
  isDefault?: boolean;
  isBuiltIn?: boolean;
}

export type SearchEngineInput = Omit<SearchEngine, "id" | "isDefault" | "isBuiltIn">;
