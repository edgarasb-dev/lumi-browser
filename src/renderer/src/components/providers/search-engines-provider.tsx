import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SearchEngine, SearchEngineInput } from "~/types/search-engines";

interface SearchEnginesContextValue {
  searchEngines: SearchEngine[];
  defaultSearchEngine: SearchEngine | null;
  isLoading: boolean;
  setDefaultSearchEngine: (id: string) => Promise<boolean>;
  addSearchEngine: (engine: SearchEngineInput) => Promise<SearchEngine | null>;
  updateSearchEngine: (id: string, engine: Partial<SearchEngineInput>) => Promise<boolean>;
  deleteSearchEngine: (id: string) => Promise<boolean>;
  resetSearchEngines: () => Promise<boolean>;
  buildSearchUrl: (query: string, engineId?: string) => string;
}

const SearchEnginesContext = createContext<SearchEnginesContextValue | null>(null);

export const useSearchEngines = () => {
  const context = useContext(SearchEnginesContext);
  if (!context) {
    throw new Error("useSearchEngines must be used within a SearchEnginesProvider");
  }
  return context;
};

interface SearchEnginesProviderProps {
  children: React.ReactNode;
}

export const SearchEnginesProvider = ({ children }: SearchEnginesProviderProps) => {
  const [searchEngines, setSearchEngines] = useState<SearchEngine[]>([]);
  const [defaultSearchEngine, setDefaultSearchEngineState] = useState<SearchEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEngines = useCallback(async () => {
    if (!flow || !flow.searchEngines) return;
    try {
      const engines = await flow.searchEngines.getSearchEngines();
      const def = await flow.searchEngines.getDefaultSearchEngine();
      setSearchEngines(engines);
      setDefaultSearchEngineState(def);
    } catch (error) {
      console.error("Failed to fetch search engines:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEngines();

    if (flow && flow.searchEngines) {
      const unsub = flow.searchEngines.onSearchEnginesChanged((engines) => {
        setSearchEngines(engines);
        const def = engines.find((e) => e.isDefault) || engines[0] || null;
        setDefaultSearchEngineState(def);
      });
      return () => unsub();
    }
    return () => {};
  }, [fetchEngines]);

  const setDefaultSearchEngine = useCallback(
    async (id: string) => {
      if (!flow?.searchEngines) return false;
      const success = await flow.searchEngines.setDefaultSearchEngine(id);
      if (success) {
        await fetchEngines();
      }
      return success;
    },
    [fetchEngines]
  );

  const addSearchEngine = useCallback(
    async (engine: SearchEngineInput) => {
      if (!flow?.searchEngines) return null;
      const newEngine = await flow.searchEngines.addSearchEngine(engine);
      if (newEngine) {
        await fetchEngines();
      }
      return newEngine;
    },
    [fetchEngines]
  );

  const updateSearchEngine = useCallback(
    async (id: string, engine: Partial<SearchEngineInput>) => {
      if (!flow?.searchEngines) return false;
      const success = await flow.searchEngines.updateSearchEngine(id, engine);
      if (success) {
        await fetchEngines();
      }
      return success;
    },
    [fetchEngines]
  );

  const deleteSearchEngine = useCallback(
    async (id: string) => {
      if (!flow?.searchEngines) return false;
      const success = await flow.searchEngines.deleteSearchEngine(id);
      if (success) {
        await fetchEngines();
      }
      return success;
    },
    [fetchEngines]
  );

  const resetSearchEngines = useCallback(async () => {
    if (!flow?.searchEngines) return false;
    const success = await flow.searchEngines.resetSearchEngines();
    if (success) {
      await fetchEngines();
    }
    return success;
  }, [fetchEngines]);

  const buildSearchUrl = useCallback(
    (query: string, engineId?: string) => {
      const targetEngine = engineId
        ? searchEngines.find((e) => e.id === engineId)
        : defaultSearchEngine || searchEngines.find((e) => e.isDefault) || searchEngines[0];

      if (targetEngine) {
        return targetEngine.searchUrl.replace("%s", encodeURIComponent(query));
      }
      return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    },
    [searchEngines, defaultSearchEngine]
  );

  const contextValue = useMemo<SearchEnginesContextValue>(
    () => ({
      searchEngines,
      defaultSearchEngine,
      isLoading,
      setDefaultSearchEngine,
      addSearchEngine,
      updateSearchEngine,
      deleteSearchEngine,
      resetSearchEngines,
      buildSearchUrl
    }),
    [
      searchEngines,
      defaultSearchEngine,
      isLoading,
      setDefaultSearchEngine,
      addSearchEngine,
      updateSearchEngine,
      deleteSearchEngine,
      resetSearchEngines,
      buildSearchUrl
    ]
  );

  return <SearchEnginesContext.Provider value={contextValue}>{children}</SearchEnginesContext.Provider>;
};
