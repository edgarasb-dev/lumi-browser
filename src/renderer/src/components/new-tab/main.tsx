import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Moon, Palette, Search, SlidersHorizontal, Sun } from "lucide-react";
import { useTheme } from "@/components/main/theme";
import { QuickLinks } from "./quick-links";
import { NewTabWidgetsGrid } from "./widgets-grid";
import {
  STUDIO_WALLPAPERS,
  WALLPAPER_STORAGE_KEY,
  WIDGETS_STORAGE_KEY,
  buildWallpaperStyle,
  loadWallpaperId,
  loadWidgetPrefs,
  type NewTabWidgetPrefs
} from "./studio-wallpapers";
import { OmniboxSuggestionRow } from "@/components/omnibox/omnibox-suggestion";
import { requestOmniboxSuggestions } from "@/lib/omnibox-new";
import { setOmniboxCurrentProfileId, setOmniboxCurrentSpaceId } from "@/lib/omnibox-new/states";
import { primeOpenTabsCache, primeQuickHistoryCache } from "@/lib/omnibox-new/suggestors";
import type { OmniboxSuggestion } from "@/lib/omnibox-new/types";
import type { Space } from "~/lumi/interfaces/sessions/spaces";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 7;

const WORKSPACE_PEDAL_ACTIONS = new Set([
  "toggle_zen_mode",
  "toggle_side_panel",
  "capture_region",
  "capture_full_page",
  "recently_closed",
  "save_snapshot"
]);

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function suggestionKey(s: OmniboxSuggestion, index: number): string {
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
}

function NewTabClock() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formattedDate = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  return (
    <>
      <div className="font-semibold tracking-tight text-5xl tabular-nums text-foreground md:text-6xl">
        {formattedTime}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
        <span>{getGreeting(now.getHours())}</span>
        <span>·</span>
        <span>{formattedDate}</span>
      </div>
    </>
  );
}

export function NewTabPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [suggestions, setSuggestions] = useState<OmniboxSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [wallpaperId, setWallpaperId] = useState<string>(() => loadWallpaperId());
  const [widgetPrefs, setWidgetPrefs] = useState<NewTabWidgetPrefs>(() => loadWidgetPrefs());
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  const { theme, setTheme, resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync active Space metadata and prime omnibox caches
  useEffect(() => {
    if (typeof lumi === "undefined") return;
    let active = true;

    const loadContext = async () => {
      try {
        const space = await lumi.spaces.getLastUsedSpace();
        if (!active) return;
        setActiveSpace(space);
        setOmniboxCurrentProfileId(space?.profileId);
        setOmniboxCurrentSpaceId(space?.id);
        void primeQuickHistoryCache(space?.profileId, { force: true });
        void primeOpenTabsCache(space?.id, { force: true });
      } catch {
        // ignore context fetch failures
      }
    };

    void loadContext();
    return () => {
      active = false;
    };
  }, []);

  const fetchSuggestions = useCallback(
    (input: string) => {
      abortRef.current?.();
      const requestId = ++requestIdRef.current;
      setOmniboxCurrentProfileId(activeSpace?.profileId);
      setOmniboxCurrentSpaceId(activeSpace?.id);
      abortRef.current = requestOmniboxSuggestions({
        input,
        requestId,
        getCurrentRequestId: () => requestIdRef.current,
        applySuggestions: (items) => {
          setSuggestions(items.slice(0, MAX_SUGGESTIONS));
          setSelectedIndex(0);
        }
      });
    },
    [activeSpace?.id, activeSpace?.profileId]
  );

  useEffect(() => {
    fetchSuggestions(searchQuery);
    return () => {
      abortRef.current?.();
    };
  }, [searchQuery, fetchSuggestions]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const commitSuggestion = useCallback((suggestion: OmniboxSuggestion) => {
    switch (suggestion.type) {
      case "instant-answer": {
        void navigator.clipboard.writeText(suggestion.copyValue).catch(() => undefined);
        setCopiedNotice(`Copied: ${suggestion.copyValue}`);
        setTimeout(() => setCopiedNotice(null), 1800);
        return;
      }
      case "open-tab":
        void lumi.tabs.switchToTab(suggestion.tabId);
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
          void lumi.navigation.goTo("lumi://extensions", undefined, true);
        } else if (a === "open_history") {
          void lumi.navigation.goTo("lumi://history", undefined, true);
        } else if (a === "open_downloads") {
          void lumi.navigation.goTo("lumi://downloads", undefined, true);
        } else if (a === "clear_browsing_data") {
          void lumi.navigation.goTo("lumi://history?clear=1", undefined, true);
        } else if (a === "open_bangs") {
          void lumi.navigation.goTo("lumi://bangs", undefined, true);
        } else if (WORKSPACE_PEDAL_ACTIONS.has(a)) {
          lumi.actions.emitAction(a);
        }
        break;
      }
      case "search":
      case "website":
        void lumi.navigation.goTo(suggestion.url, undefined, true);
        break;
    }
    setShowSuggestions(false);
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
      return;
    }
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setShowSuggestions(true);
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }
    if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setShowSuggestions(true);
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = suggestions[selectedIndex];
      if (target) {
        commitSuggestion(target);
      } else if (searchQuery.trim()) {
        const q = searchQuery.trim();
        const url = q.includes("://") ? q : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        void lumi.navigation.goTo(url, undefined, true);
      }
    }
  };

  const selectWallpaper = (id: string) => {
    setWallpaperId(id);
    try {
      localStorage.setItem(WALLPAPER_STORAGE_KEY, id);
    } catch {
      // ignore storage errors
    }
  };

  const updateWidgetPref = (key: keyof NewTabWidgetPrefs, value: boolean) => {
    setWidgetPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const toggleTheme = () => {
    const nextTheme =
      theme === "system" ? (resolvedTheme === "dark" ? "light" : "dark") : theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  const backgroundStyle = useMemo(
    () => buildWallpaperStyle(wallpaperId, resolvedTheme, activeSpace ?? undefined),
    [wallpaperId, resolvedTheme, activeSpace]
  );

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div
      className="relative flex min-h-screen flex-col justify-between overflow-x-hidden px-4 py-5 font-sans text-foreground transition-colors duration-300 select-none md:px-8 md:py-7"
      style={{ backgroundImage: backgroundStyle }}
    >
      {/* Top Bar Controls */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {activeSpace && (
            <div className="lumi-glass-pill flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground">
              <span
                className="size-2.5 rounded-full shadow-xs"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${activeSpace.bgStartColor}, ${activeSpace.bgEndColor})`
                }}
              />
              <span>{activeSpace.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger
              type="button"
              className="lumi-glass-pill inline-flex h-8 cursor-pointer items-center gap-1.5 px-3 text-xs font-medium text-foreground transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <SlidersHorizontal className="size-3.5 text-primary" />
              Customize
            </PopoverTrigger>
            <PopoverContent align="end" className="lumi-glass-panel w-72 space-y-4 p-4">
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Palette className="size-3.5 text-primary" />
                  Studio Backdrop
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {STUDIO_WALLPAPERS.map((wp) => {
                    const isSelected = wp.id === wallpaperId;
                    return (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => selectWallpaper(wp.id)}
                        title={wp.name}
                        className={cn(
                          "relative flex h-9 w-full items-center justify-center rounded-xl border transition-all",
                          isSelected
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-black/15 hover:scale-105 dark:border-white/20"
                        )}
                        style={{ background: wp.swatch }}
                      >
                        {isSelected && <Check className="size-4 text-white drop-shadow" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5 border-t border-black/8 pt-3 dark:border-white/10">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Widgets</div>
                {(
                  [
                    { key: "clock", label: "Clock & Greeting" },
                    { key: "quickLinks", label: "Speed Dial Links" },
                    { key: "recentlyClosed", label: "Recently Closed" },
                    { key: "scratchpad", label: "Space Scratchpad" }
                  ] as const
                ).map((item) => (
                  <label key={item.key} className="flex items-center justify-between text-xs font-medium">
                    <span>{item.label}</span>
                    <Switch
                      checked={widgetPrefs[item.key]}
                      onCheckedChange={(checked) => updateWidgetPref(item.key, checked)}
                    />
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            className="lumi-glass-pill size-8"
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4 text-amber-400" />
            ) : (
              <Moon className="size-4 text-zinc-700" />
            )}
          </Button>
        </div>
      </div>

      {/* Main Centered Hero + Omnibox Search */}
      <div className="mx-auto my-auto flex w-full max-w-3xl flex-col items-center gap-7 py-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center text-center"
        >
          {widgetPrefs.clock ? (
            <NewTabClock />
          ) : (
            <img
              src="/assets/logo.svg"
              alt="Lumi Browser"
              className="size-20 rounded-2xl object-contain drop-shadow-[0_12px_32px_rgba(37,99,235,0.28)]"
            />
          )}
        </motion.div>

        {/* Unified Omnibox-New Search Bar */}
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="relative w-full max-w-2xl"
        >
          <div
            className={cn(
              "lumi-glass-panel flex items-center gap-3 px-4 py-3 transition-shadow",
              showSuggestions && suggestions.length > 0 && "rounded-b-none border-b-0 shadow-xl",
              "focus-within:ring-2 focus-within:ring-primary/35"
            )}
          >
            <Search className="size-5 shrink-0 text-primary" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search the web, open tabs, calculate math, convert units, or run commands..."
              className="min-w-0 flex-1 bg-transparent text-base font-medium text-foreground placeholder:text-muted-foreground focus:outline-none caret-primary"
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />
            {copiedNotice && (
              <span className="lumi-glass-pill shrink-0 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {copiedNotice}
              </span>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="lumi-glass-panel absolute left-0 right-0 top-full z-elevated max-h-[340px] space-y-1 overflow-y-auto rounded-t-none border-t border-black/8 p-2 shadow-2xl dark:border-white/10">
              {suggestions.map((suggestion, index) => (
                <OmniboxSuggestionRow
                  key={suggestionKey(suggestion, index)}
                  suggestion={suggestion}
                  index={index}
                  selected={index === selectedIndex}
                  onSelect={commitSuggestion}
                />
              ))}
            </div>
          )}
        </motion.div>

        {widgetPrefs.quickLinks && <QuickLinks />}

        <NewTabWidgetsGrid prefs={widgetPrefs} spaceId={activeSpace?.id} spaceName={activeSpace?.name} />
      </div>

      {/* Bottom Hint */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center pt-2 text-[11px] text-muted-foreground">
        <span>Press </span>
        <kbd className="lumi-kbd mx-1 text-[10px]">⌘L</kbd>
        <span> for Command Palette · </span>
        <kbd className="lumi-kbd mx-1 text-[10px]">⌘⇧Z</kbd>
        <span> for Focus Mode</span>
      </div>
    </div>
  );
}
