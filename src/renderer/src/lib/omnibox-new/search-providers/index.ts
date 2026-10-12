import { getCurrentDefaultEngine, getSearchSuggestions } from "@/lib/search";
import { googleSearchProvider } from "./google";
import type { SearchProvider, SearchProviderCompletion, SearchProviderRequest } from "./types";

const SEARCH_SUGGESTION_MIN_RELEVANCE = 100;
const SEARCH_SUGGESTION_MAX_RELEVANCE = 400;

export function getSearchProvider(): SearchProvider {
  const currentEngine = getCurrentDefaultEngine();

  if (!currentEngine || currentEngine.id === "google") {
    return googleSearchProvider;
  }

  return {
    id: currentEngine.id,
    label: currentEngine.name,
    buildSearchUrl: (query: string) => {
      return currentEngine.searchUrl.replace("%s", encodeURIComponent(query));
    },
    getSuggestions: async (request: SearchProviderRequest): Promise<SearchProviderCompletion[]> => {
      const trimmedInput = request.input.trim();
      if (!trimmedInput) return [];

      try {
        const suggestions = await getSearchSuggestions(trimmedInput, request.signal);
        const completions: SearchProviderCompletion[] = [];

        for (let i = 0; i < suggestions.length && completions.length < request.limit; i++) {
          const text = suggestions[i];
          if (!text || text.toLowerCase() === trimmedInput.toLowerCase()) continue;

          const relevance = Math.round(
            SEARCH_SUGGESTION_MAX_RELEVANCE -
              (i / Math.max(suggestions.length, 1)) *
                (SEARCH_SUGGESTION_MAX_RELEVANCE - SEARCH_SUGGESTION_MIN_RELEVANCE)
          );

          completions.push({
            kind: "query",
            title: text,
            query: text,
            relevance
          });
        }

        return completions;
      } catch {
        return [];
      }
    }
  };
}
