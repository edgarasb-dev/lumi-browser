import { TypedEventEmitter } from "@/modules/typed-event-emitter";
import { getDatastore } from "@/saving/datastore";
import { generateID } from "@/modules/utils";
import type { SearchEngine, SearchEngineInput } from "~/types/search-engines";

export const BUILT_IN_SEARCH_ENGINES: SearchEngine[] = [
  {
    id: "google",
    name: "Google",
    searchUrl: "https://www.google.com/search?q=%s",
    suggestUrl: "https://suggestqueries.google.com/complete/search?client=chrome&q=%s",
    shortcut: "g",
    isBuiltIn: true,
    isDefault: true
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    searchUrl: "https://duckduckgo.com/?q=%s",
    suggestUrl: "https://duckduckgo.com/ac/?q=%s&type=list",
    shortcut: "d",
    isBuiltIn: true,
    isDefault: false
  },
  {
    id: "bing",
    name: "Bing",
    searchUrl: "https://www.bing.com/search?q=%s",
    suggestUrl: "https://api.bing.com/osjson.aspx?query=%s",
    shortcut: "b",
    isBuiltIn: true,
    isDefault: false
  },
  {
    id: "brave",
    name: "Brave",
    searchUrl: "https://search.brave.com/search?q=%s",
    suggestUrl: "https://search.brave.com/api/suggest?q=%s",
    shortcut: "br",
    isBuiltIn: true,
    isDefault: false
  },
  {
    id: "ecosia",
    name: "Ecosia",
    searchUrl: "https://www.ecosia.org/search?q=%s",
    suggestUrl: "https://ac.ecosia.org/autocomplete?q=%s&type=list",
    shortcut: "e",
    isBuiltIn: true,
    isDefault: false
  },
  {
    id: "kagi",
    name: "Kagi",
    searchUrl: "https://kagi.com/search?q=%s",
    shortcut: "k",
    isBuiltIn: true,
    isDefault: false
  },
  {
    id: "yahoo",
    name: "Yahoo",
    searchUrl: "https://search.yahoo.com/search?p=%s",
    shortcut: "y",
    isBuiltIn: true,
    isDefault: false
  }
];

export const SearchEnginesDataStore = getDatastore("search_engines");

type SearchEnginesEvents = {
  "search-engines-changed": [SearchEngine[]];
};
export const searchEnginesEmitter = new TypedEventEmitter<SearchEnginesEvents>();

let customEngines: SearchEngine[] = [];
let defaultEngineId: string = "google";
let isLoaded = false;

async function loadSearchEngines() {
  try {
    const savedCustom = (await SearchEnginesDataStore.get<SearchEngine[]>("custom_engines").catch(() => null)) || [];
    const savedDefault = (await SearchEnginesDataStore.get<string>("default_engine_id").catch(() => null)) || "google";

    customEngines = Array.isArray(savedCustom) ? savedCustom : [];
    defaultEngineId = typeof savedDefault === "string" ? savedDefault : "google";
  } catch (error) {
    console.error("Failed to load search engines:", error);
  } finally {
    isLoaded = true;
    searchEnginesEmitter.emit("search-engines-changed", getAllSearchEngines());
  }
}

const loadingPromise = loadSearchEngines();

export async function onSearchEnginesLoaded() {
  if (isLoaded) return;
  await loadingPromise;
}

export function getAllSearchEngines(): SearchEngine[] {
  const allEngines = [
    ...BUILT_IN_SEARCH_ENGINES.map((engine) => ({
      ...engine,
      isDefault: engine.id === defaultEngineId
    })),
    ...customEngines.map((engine) => ({
      ...engine,
      isBuiltIn: false,
      isDefault: engine.id === defaultEngineId
    }))
  ];

  // If no engine was marked default (e.g. previous default deleted), fallback to Google
  if (!allEngines.some((e) => e.isDefault)) {
    const google = allEngines.find((e) => e.id === "google");
    if (google) google.isDefault = true;
  }

  return allEngines;
}

export function getDefaultSearchEngine(): SearchEngine {
  const all = getAllSearchEngines();
  return all.find((e) => e.isDefault) || BUILT_IN_SEARCH_ENGINES[0];
}

export async function setDefaultSearchEngine(id: string): Promise<boolean> {
  const all = getAllSearchEngines();
  const exists = all.some((e) => e.id === id);
  if (!exists) return false;

  defaultEngineId = id;
  await SearchEnginesDataStore.set("default_engine_id", id).catch(() => {});
  searchEnginesEmitter.emit("search-engines-changed", getAllSearchEngines());
  return true;
}

export async function addSearchEngine(input: SearchEngineInput): Promise<SearchEngine | null> {
  if (!input.name || !input.searchUrl || !input.searchUrl.includes("%s")) {
    return null;
  }

  const newEngine: SearchEngine = {
    id: `custom_${generateID()}`,
    name: input.name.trim(),
    searchUrl: input.searchUrl.trim(),
    suggestUrl: input.suggestUrl?.trim() || undefined,
    shortcut: (input.shortcut || input.name.charAt(0)).toLowerCase().trim(),
    isBuiltIn: false,
    isDefault: false
  };

  customEngines.push(newEngine);
  await SearchEnginesDataStore.set("custom_engines", customEngines).catch(() => {});
  searchEnginesEmitter.emit("search-engines-changed", getAllSearchEngines());
  return newEngine;
}

export async function updateSearchEngine(id: string, input: Partial<SearchEngineInput>): Promise<boolean> {
  const index = customEngines.findIndex((e) => e.id === id);
  if (index === -1) {
    return false;
  }

  if (input.searchUrl && !input.searchUrl.includes("%s")) {
    return false;
  }

  const existing = customEngines[index];
  customEngines[index] = {
    ...existing,
    name: input.name?.trim() ?? existing.name,
    searchUrl: input.searchUrl?.trim() ?? existing.searchUrl,
    suggestUrl: input.suggestUrl !== undefined ? input.suggestUrl.trim() || undefined : existing.suggestUrl,
    shortcut: input.shortcut ? input.shortcut.toLowerCase().trim() : existing.shortcut
  };

  await SearchEnginesDataStore.set("custom_engines", customEngines).catch(() => {});
  searchEnginesEmitter.emit("search-engines-changed", getAllSearchEngines());
  return true;
}

export async function deleteSearchEngine(id: string): Promise<boolean> {
  const index = customEngines.findIndex((e) => e.id === id);
  if (index === -1) {
    return false;
  }

  customEngines.splice(index, 1);
  if (defaultEngineId === id) {
    defaultEngineId = "google";
    await SearchEnginesDataStore.set("default_engine_id", "google").catch(() => {});
  }

  await SearchEnginesDataStore.set("custom_engines", customEngines).catch(() => {});
  searchEnginesEmitter.emit("search-engines-changed", getAllSearchEngines());
  return true;
}

export async function resetSearchEngines(): Promise<boolean> {
  customEngines = [];
  defaultEngineId = "google";

  await SearchEnginesDataStore.wipe().catch(() => {});
  searchEnginesEmitter.emit("search-engines-changed", getAllSearchEngines());
  return true;
}
