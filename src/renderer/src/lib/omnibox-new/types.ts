export type OmniboxSuggestionSource =
  | "verbatim"
  | "quick-history"
  | "search-provider"
  | "pedal"
  | "open-tab"
  | "instant-answer"
  | "zero-suggest-open-tab"
  | "zero-suggest-history";

interface OmniboxSuggestionBase {
  relevance: number;
  source: OmniboxSuggestionSource;
}

export interface SearchSuggestion extends OmniboxSuggestionBase {
  type: "search";
  query: string;
  url: string;
}

export interface WebsiteSuggestion extends OmniboxSuggestionBase {
  type: "website";
  title: string;
  url: string;
}

export interface OpenTabSuggestion extends OmniboxSuggestionBase {
  type: "open-tab";
  /** Tab to activate */
  tabId: number;
  spaceId: string;
  title: string;
  url: string;
}

export interface PedalSuggestion extends OmniboxSuggestionBase {
  type: "pedal";
  /** e.g. open_settings, open_new_window */
  action: string;
  title: string;
}

export type InstantAnswerKind = "math" | "unit" | "color" | "timezone" | "qr";

export interface InstantAnswerSuggestion extends OmniboxSuggestionBase {
  type: "instant-answer";
  kind: InstantAnswerKind;
  title: string;
  subtitle: string;
  copyValue: string;
  hexPreview?: string;
  qrValue?: string;
}

export type OmniboxSuggestion =
  SearchSuggestion | WebsiteSuggestion | OpenTabSuggestion | PedalSuggestion | InstantAnswerSuggestion;
