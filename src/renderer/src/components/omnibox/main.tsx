import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { requestOmniboxSuggestions } from "@/lib/omnibox-new";
import { primeOpenTabsCache, primeQuickHistoryCache } from "@/lib/omnibox-new/suggestors";
import type { OmniboxSuggestion } from "@/lib/omnibox-new/types";
import { OmniboxSuggestionRow } from "@/components/omnibox/omnibox-suggestion";
import { useSetting } from "@/components/providers/settings-provider";
import { useSpaces } from "@/components/providers/spaces-provider";
import { cn } from "@/lib/utils";
import type { OmniboxOpenState } from "~/lumi/interfaces/browser/omnibox";
import "@/css/border.css";
import {
  setOmniboxActivePageUrl,
  setOmniboxCurrentProfileId,
  setOmniboxCurrentSpaceId
} from "@/lib/omnibox-new/states";

type InputSelectionMode = "preserve" | "end" | "all";

const DEFAULT_OPEN_STATE: OmniboxOpenState = {
  currentInput: "",
  openIn: "current",
  sequence: 0,
  shadowPadding: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  }
};

const OMNIBOX_SHADOW =
  "0 16px 40px -12px rgba(0, 0, 0, 0.48), 0 6px 16px -6px rgba(0, 0, 0, 0.25), 0 0 0 0.5px rgba(255, 255, 255, 0.14)";

const WORKSPACE_PEDAL_ACTIONS = new Set([
  "toggle_zen_mode",
  "toggle_side_panel",
  "capture_region",
  "capture_full_page",
  "recently_closed",
  "save_snapshot"
]);

function commitSuggestion(
  suggestion: OmniboxSuggestion,
  openIn: "current" | "new_tab",
  onCopied?: (label: string) => void
) {
  switch (suggestion.type) {
    case "instant-answer": {
      void navigator.clipboard.writeText(suggestion.copyValue).catch(() => undefined);
      onCopied?.(suggestion.copyValue);
      setTimeout(() => {
        lumi.omnibox.hide();
      }, 260);
      return;
    }
    case "open-tab":
      lumi.tabs.switchToTab(suggestion.tabId);
      break;
    case "pedal": {
      const a = suggestion.action;
      if (a === "open_settings") {
        lumi.windows.openSettings();
      } else if (a === "open_new_window") {
        lumi.browser.createWindow();
      } else if (a === "open_incognito_window") {
        lumi.browser.createIncognitoWindow();
      } else if (a === "open_extensions") {
        lumi.tabs.newTab("lumi://extensions", true);
      } else if (a === "open_history") {
        lumi.tabs.newTab("lumi://history", true);
      } else if (a === "open_downloads") {
        lumi.tabs.newTab("lumi://downloads", true);
      } else if (a === "clear_browsing_data") {
        lumi.tabs.newTab("lumi://history?clear=1", true);
      } else if (a === "open_bangs") {
        lumi.tabs.newTab("lumi://bangs", true);
      } else if (WORKSPACE_PEDAL_ACTIONS.has(a)) {
        lumi.actions.emitAction(a);
      }
      break;
    }
    case "search": {
      const url = suggestion.url;
      if (openIn === "current") {
        lumi.navigation.goTo(url, undefined, true);
      } else {
        lumi.tabs.newTab(url, true, undefined, true);
      }
      break;
    }
    case "website": {
      const url = suggestion.url;
      if (openIn === "current") {
        lumi.navigation.goTo(url, undefined, true);
      } else {
        lumi.tabs.newTab(url, true, undefined, true);
      }
      break;
    }
  }
  lumi.omnibox.hide();
}

export function OmniboxMain() {
  const { currentSpace } = useSpaces();
  const [openState, setOpenState] = useState<OmniboxOpenState>(DEFAULT_OPEN_STATE);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<OmniboxSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const suggestionRequestIdRef = useRef(0);
  const abortSuggestionsRef = useRef<(() => void) | null>(null);
  const [commandPaletteOpacity] = useSetting<"solid" | "tinted" | "glassy">("commandPaletteOpacity");
  const pendingSelectionModeRef = useRef<Exclude<InputSelectionMode, "preserve"> | null>(null);
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);

  const ensureInputFocused = useCallback((selection: InputSelectionMode = "preserve") => {
    const el = inputRef.current;
    if (!el) return;

    if (document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }

    if (selection === "end") {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    } else if (selection === "all") {
      el.setSelectionRange(0, el.value.length);
    }
  }, []);

  const cancelPendingSelection = useCallback(() => {
    pendingSelectionModeRef.current = null;
  }, []);

  const applySuggestions = useCallback((items: OmniboxSuggestion[]) => {
    setSuggestions(items);
    setSelectedIndex(0);
  }, []);

  const requestSuggestions = useCallback(
    (input: string) => {
      abortSuggestionsRef.current?.();
      const requestId = ++suggestionRequestIdRef.current;
      setSuggestions([]);
      setSelectedIndex(0);
      setOmniboxCurrentProfileId(currentSpace?.profileId);
      setOmniboxCurrentSpaceId(currentSpace?.id);
      abortSuggestionsRef.current = requestOmniboxSuggestions({
        input,
        requestId,
        getCurrentRequestId: () => suggestionRequestIdRef.current,
        applySuggestions
      });
    },
    [applySuggestions, currentSpace?.id, currentSpace?.profileId]
  );

  useEffect(() => {
    requestSuggestions(inputValue);
  }, [inputValue, requestSuggestions]);

  // This effect is ran when the omnibox is opened.
  useEffect(() => {
    setCopiedBanner(null);
    let active = true;
    void Promise.all([
      primeQuickHistoryCache(currentSpace?.profileId, { force: true }),
      primeOpenTabsCache(currentSpace?.id, { force: true })
    ]).then(() => {
      if (!active) return;
      requestSuggestions(inputRef.current?.value ?? "");
    });
    if (currentSpace?.id) {
      void lumi.tabs
        .getData()
        .then((data) => {
          const focusedTabId = data.focusedTabIds?.[currentSpace.id];
          const tab = focusedTabId ? data.tabs.find((t) => t.id === focusedTabId) : undefined;
          setOmniboxActivePageUrl(tab?.url);
        })
        .catch(() => {
          setOmniboxActivePageUrl(undefined);
        });
    } else {
      setOmniboxActivePageUrl(undefined);
    }
    return () => {
      active = false;
    };
  }, [openState.openIn, openState.sequence, currentSpace?.id, currentSpace?.profileId, requestSuggestions]);

  useEffect(() => {
    let isMounted = true;
    void lumi.omnibox.getState().then((state) => {
      if (!isMounted || !state) return;
      setOpenState(state);
    });

    const unsubscribe = lumi.omnibox.onStateChanged((state) => {
      setOpenState(state);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleWindowFocus = () => {
      requestAnimationFrame(() => {
        ensureInputFocused(pendingSelectionModeRef.current ?? "preserve");
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      requestAnimationFrame(() => {
        ensureInputFocused(pendingSelectionModeRef.current ?? "preserve");
      });
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [ensureInputFocused]);

  useEffect(() => {
    setInputValue(openState.currentInput);
    setSelectedIndex(0);
    requestSuggestions(openState.currentInput);
    pendingSelectionModeRef.current = openState.currentInput ? "all" : "end";
  }, [currentSpace?.profileId, openState.sequence, openState.currentInput, requestSuggestions]);

  useLayoutEffect(() => {
    const pendingSelectionMode = pendingSelectionModeRef.current;
    if (!pendingSelectionMode) {
      return;
    }

    ensureInputFocused(pendingSelectionMode);
  }, [inputValue, openState.sequence, ensureInputFocused]);

  useEffect(() => {
    return () => {
      abortSuggestionsRef.current?.();
      cancelPendingSelection();
    };
  }, [cancelPendingSelection]);

  const commitSelected = useCallback(
    (suggestion: OmniboxSuggestion) => {
      commitSuggestion(suggestion, openState.openIn, (copiedText) => {
        setCopiedBanner(copiedText);
      });
    },
    [openState.openIn]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    cancelPendingSelection();

    if (e.key === "Escape") {
      e.preventDefault();
      lumi.omnibox.hide();
      return;
    }
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => {
        let newIndex = i + 1;
        if (newIndex >= suggestions.length) {
          newIndex = 0;
        }
        return newIndex;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => {
        let newIndex = i - 1;
        if (newIndex < 0) {
          newIndex = suggestions.length - 1;
        }
        return newIndex;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = suggestions[selectedIndex];
      if (row) commitSelected(row);
    }
  };

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  const suggestionKey = (s: OmniboxSuggestion, index: number) => {
    switch (s.type) {
      case "search":
        return `search-${s.query}-${index}`;
      case "website":
        return `web-${s.url}-${index}`;
      case "open-tab":
        return `tab-${s.spaceId}-${s.tabId}-${index}`;
      case "pedal":
        return `pedal-${s.action}-${index}`;
      case "instant-answer":
        return `instant-${s.kind}-${index}`;
    }
  };

  return (
    <div
      className={"h-screen w-screen box-border"}
      style={{
        paddingTop: openState.shadowPadding.top,
        paddingRight: openState.shadowPadding.right,
        paddingBottom: openState.shadowPadding.bottom,
        paddingLeft: openState.shadowPadding.left
      }}
    >
      <motion.div
        key={openState.sequence}
        initial={{ opacity: 0, y: -6, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 36 }}
        className={cn(
          "h-full w-full rounded-[15px]",
          "backdrop-blur-2xl saturate-150 transition-colors",
          commandPaletteOpacity === "solid" && "bg-white dark:bg-[#191b20]",
          commandPaletteOpacity === "tinted" && "bg-white/92 dark:bg-[#191b20]/90",
          commandPaletteOpacity === "glassy" && "bg-white/75 dark:bg-[#191b20]/74"
        )}
        style={{ boxShadow: OMNIBOX_SHADOW }}
      >
        <div className="h-full w-full rounded-[15px] border-[0.5px] border-black/10 platform-darwin:border-(--frame-shadow-border) dark:border-transparent">
          <div className="h-full w-full rounded-[15px] border border-white/55 dark:border-white/12">
            <div
              className={cn("flex h-full w-full flex-col overflow-hidden", "select-none", "rounded-[15px]")}
              onMouseDownCapture={(e) => {
                if (e.target !== inputRef.current) {
                  requestAnimationFrame(() => {
                    ensureInputFocused(pendingSelectionModeRef.current ?? "preserve");
                  });
                }
              }}
            >
              <div className="flex shrink-0 items-center gap-3 border-b border-black/8 px-4 py-3.5 dark:border-white/8">
                <Search className="ml-1 size-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    cancelPendingSelection();
                    setInputValue(e.target.value);
                  }}
                  onKeyDown={onKeyDown}
                  onFocus={() => {
                    const pendingSelectionMode = pendingSelectionModeRef.current;
                    if (pendingSelectionMode) {
                      ensureInputFocused(pendingSelectionMode);
                    }
                  }}
                  onMouseDown={() => {
                    cancelPendingSelection();
                  }}
                  onBlur={() => {
                    requestAnimationFrame(() => {
                      if (document.hasFocus()) {
                        ensureInputFocused(pendingSelectionModeRef.current ?? "preserve");
                      }
                    });
                  }}
                  placeholder="Search, enter URL, calculate (24 * 12), convert (#06f, 24px to rem) or type qr..."
                  className={cn(
                    "min-w-0 flex-1 bg-transparent font-sans text-[17px] font-medium",
                    "text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500/80 dark:placeholder:text-zinc-400/80",
                    "outline-none caret-primary"
                  )}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  aria-autocomplete="list"
                  aria-controls="omnibox-suggestions"
                  aria-activedescendant={suggestions.length > 0 ? `omnibox-option-${selectedIndex}` : undefined}
                />
                {copiedBanner ? (
                  <span className="lumi-glass-pill shrink-0 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    Copied!
                  </span>
                ) : (
                  <span className="lumi-glass-pill hidden shrink-0 px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">
                    {openState.openIn === "new_tab" ? "New Tab" : "Current Tab"}
                  </span>
                )}
              </div>

              <div
                ref={listRef}
                id="omnibox-suggestions"
                role="listbox"
                className="min-h-0 flex-1 overflow-y-auto px-2 py-2 no-scrollbar space-y-1 scroll-py-2"
              >
                {suggestions.map((suggestion, index) => (
                  <OmniboxSuggestionRow
                    key={suggestionKey(suggestion, index)}
                    suggestion={suggestion}
                    index={index}
                    selected={index === selectedIndex}
                    onSelect={commitSelected}
                  />
                ))}
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-black/6 bg-black/2 px-3.5 py-1.5 text-[11px] text-zinc-500 dark:border-white/8 dark:bg-white/2 dark:text-zinc-400">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <kbd className="lumi-kbd text-[10px]">↑↓</kbd> Navigate
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="lumi-kbd text-[10px]">↩</kbd> Open / Copy
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="lumi-kbd text-[10px]">Esc</kbd> Close
                  </span>
                </div>
                <span className="hidden truncate font-medium text-zinc-400 dark:text-zinc-500 sm:inline">
                  Try math, colors, units, or “qr”
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
