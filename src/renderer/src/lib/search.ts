import type { SearchEngine } from "~/types/search-engines";

let currentDefaultEngine: SearchEngine | null = null;
let allSearchEngines: SearchEngine[] = [];

if (typeof window !== "undefined" && typeof flow !== "undefined" && flow?.searchEngines) {
  flow.searchEngines
    .getDefaultSearchEngine()
    .then((engine) => {
      currentDefaultEngine = engine;
    })
    .catch(() => {});

  flow.searchEngines
    .getSearchEngines()
    .then((engines) => {
      allSearchEngines = engines;
    })
    .catch(() => {});

  flow.searchEngines.onSearchEnginesChanged((engines) => {
    allSearchEngines = engines;
    const def = engines.find((e) => e.isDefault) || engines[0] || null;
    currentDefaultEngine = def;
  });
}

export function getCurrentDefaultEngine(): SearchEngine | null {
  return currentDefaultEngine;
}

export function getAllConfiguredEngines(): SearchEngine[] {
  return allSearchEngines;
}

export function resolveEngineAndQuery(input: string): { engine: SearchEngine | null; query: string } {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    const prefix = parts[0].toLowerCase();
    const matchedEngine = allSearchEngines.find((e) => e.shortcut.toLowerCase() === prefix);
    if (matchedEngine) {
      return {
        engine: matchedEngine,
        query: parts.slice(1).join(" ")
      };
    }
  }
  return {
    engine: currentDefaultEngine || allSearchEngines.find((e) => e.isDefault) || null,
    query: trimmed
  };
}

export function createSearchUrl(query: string, engineId?: string): string {
  const targetEngine = engineId
    ? allSearchEngines.find((e) => e.id === engineId)
    : currentDefaultEngine || allSearchEngines.find((e) => e.isDefault);

  if (targetEngine) {
    return targetEngine.searchUrl.replace("%s", encodeURIComponent(query));
  }
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

type SearchSuggestions = string[];

export async function getSearchSuggestions(query: string, signal?: AbortSignal): Promise<SearchSuggestions> {
  const engine = currentDefaultEngine || allSearchEngines.find((e) => e.isDefault);
  const suggestUrlTemplate =
    engine?.suggestUrl || "https://suggestqueries.google.com/complete/search?client=chrome&q=%s";

  try {
    const suggestUrl = suggestUrlTemplate.replace("%s", encodeURIComponent(query));
    const response = await fetch(suggestUrl, { signal });
    if (!response.ok) return [];

    const data = await response.json();
    if (Array.isArray(data)) {
      if (Array.isArray(data[1])) {
        // Standard OpenSearch format: [query, [suggestions]]
        return data[1].map((item: unknown) => (typeof item === "string" ? item : String(item)));
      }
      // Or array of strings / objects
      if (data.every((item) => typeof item === "string")) {
        return data as string[];
      }
      if (data.every((item) => typeof item === "object" && item !== null && "phrase" in item)) {
        return data.map((item) => (item as { phrase: string }).phrase);
      }
    }
    return [];
  } catch {
    return [];
  }
}
