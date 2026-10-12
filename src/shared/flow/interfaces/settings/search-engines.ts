import type { IPCListener } from "~/flow/types";
import type { SearchEngine, SearchEngineInput } from "~/types/search-engines";

export interface FlowSearchEnginesAPI {
  /**
   * Retrieves all available search engines (built-in and custom).
   */
  getSearchEngines: () => Promise<SearchEngine[]>;

  /**
   * Retrieves the current default search engine.
   */
  getDefaultSearchEngine: () => Promise<SearchEngine>;

  /**
   * Sets the default search engine by id.
   */
  setDefaultSearchEngine: (id: string) => Promise<boolean>;

  /**
   * Adds a new custom search engine.
   */
  addSearchEngine: (engine: SearchEngineInput) => Promise<SearchEngine | null>;

  /**
   * Updates an existing search engine.
   */
  updateSearchEngine: (id: string, engine: Partial<SearchEngineInput>) => Promise<boolean>;

  /**
   * Deletes a custom search engine by id.
   */
  deleteSearchEngine: (id: string) => Promise<boolean>;

  /**
   * Resets search engines back to defaults.
   */
  resetSearchEngines: () => Promise<boolean>;

  /**
   * Listens for changes to the search engines.
   */
  onSearchEnginesChanged: IPCListener<[SearchEngine[]]>;
}
