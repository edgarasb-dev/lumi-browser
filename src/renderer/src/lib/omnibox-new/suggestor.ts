import { flushSearchSuggestions } from "./suggestors/search-suggestions";
import { type OmniboxFlush } from "./helpers";
import { getZeroSuggestSuggestions } from "./zero-suggest";
import { isBangsLoaded, waitForBangsLoad } from "./bangs-initializer";
import { extractBangTrigger } from "./suggestors/verbatim";
import {
  getInstantAnswerSuggestions,
  getOpenTabSuggestions,
  getPedalSuggestions,
  getQuickHistorySuggestions,
  getVerbatimSuggestions
} from "./suggestors";

/**
 * Produce omnibox rows for the current input. Call `flush` whenever the list changes
 * (once or multiple times for incremental updates).
 *
 * For async work, pass a `flush` wrapped with {@link guardOmniboxFlush} at the call
 * site so stale completions cannot overwrite a newer query.
 */
export function getOmniboxSuggestions(input: string, flush: OmniboxFlush, signal: AbortSignal): void {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return getZeroSuggestSuggestions(flush);
  }

  // Initial synchronous suggestions (instant answers, verbatim, quick history, open tabs, pedals)
  const instantAnswers = getInstantAnswerSuggestions(trimmedInput);
  const verbatimSuggestions = getVerbatimSuggestions(trimmedInput);
  const quickHistorySuggestions = getQuickHistorySuggestions(trimmedInput);
  const openTabSuggestions = getOpenTabSuggestions(trimmedInput);
  const pedalSuggestions = getPedalSuggestions(trimmedInput);
  flush([
    ...instantAnswers,
    ...verbatimSuggestions,
    ...quickHistorySuggestions,
    ...openTabSuggestions,
    ...pedalSuggestions
  ]);

  // Lazy-load the 2 MB bangs dictionary only when user types a `!trigger`
  if (!isBangsLoaded() && extractBangTrigger(trimmedInput)) {
    void waitForBangsLoad().then(() => {
      if (!signal.aborted) {
        flush(getVerbatimSuggestions(trimmedInput));
      }
    });
  }

  // Asynchronous suggestions (search)
  flushSearchSuggestions(trimmedInput, flush, signal);
}
