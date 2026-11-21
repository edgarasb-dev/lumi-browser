import { isValidUrl } from "../helpers";
import type { OmniboxSuggestion } from "../types";
import { createSearchSuggestion, createWebsiteSuggestion } from "../suggestions";
import { getBangByTrigger, isBangsLoaded } from "../bangs-initializer";
import { resolveEngineAndQuery } from "@/lib/search";

const VERBATIM_URL_RELEVANCE = 502;
const VERBATIM_SEARCH_RELEVANCE = 501;
const BANG_TRIGGER_RE = /!(\S+)/i;

export function extractBangTrigger(query: string): string | null {
  if (!query.includes("!")) return null;
  const match = query.match(BANG_TRIGGER_RE);
  return match?.[1]?.toLowerCase() ?? null;
}

// Bangs implementation mostly taken from unduck
// https://github.com/T3-Content/unduck/blob/c1b821de0ffa286cfd964817d1918c5e90545db4/src/main.ts#L50
function getBangSearchUrl(query: string): string | null {
  const bangCandidate = extractBangTrigger(query);
  if (!bangCandidate || !isBangsLoaded()) return null;

  const selectedBang = getBangByTrigger(bangCandidate);
  if (!selectedBang) return null;

  // Remove the first bang from the query
  const cleanQuery = query.replace(/!\S+\s*/i, "").trim();

  // If the query is just `!gh`, use `github.com` instead of `github.com/search?q=`
  if (cleanQuery === "") return `https://${selectedBang.d}`;

  // Format of the url is:
  // https://www.google.com/search?q={{{s}}}
  const searchUrl = selectedBang.u.replace(
    "{{{s}}}",
    // Replace %2F with / to fix formats like "!ghr+t3dotgg/unduck"
    encodeURIComponent(cleanQuery).replace(/%2F/g, "/")
  );
  return searchUrl || null;
}

export function getVerbatimSuggestions(trimmedInput: string): OmniboxSuggestion[] {
  const verbatimSuggestions: OmniboxSuggestion[] = [];

  // Website suggestion (if input can be normalized to a navigable URL)
  const targetUrl = isValidUrl(trimmedInput);
  if (targetUrl) {
    const websiteSuggestion = createWebsiteSuggestion(targetUrl, VERBATIM_URL_RELEVANCE, null, "verbatim");
    verbatimSuggestions.push(websiteSuggestion);
  }

  // Search suggestion
  const bangSearchUrl = getBangSearchUrl(trimmedInput);
  let customSearchUrl: string | null = bangSearchUrl;
  let searchQuery = trimmedInput;

  if (!customSearchUrl) {
    const resolved = resolveEngineAndQuery(trimmedInput);
    if (resolved.engine && resolved.query !== trimmedInput) {
      customSearchUrl = resolved.engine.searchUrl.replace("%s", encodeURIComponent(resolved.query));
      searchQuery = `${resolved.engine.name}: ${resolved.query}`;
    }
  }

  verbatimSuggestions.push(createSearchSuggestion(searchQuery, VERBATIM_SEARCH_RELEVANCE, customSearchUrl, "verbatim"));

  return verbatimSuggestions;
}
