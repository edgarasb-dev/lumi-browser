import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SettingsSidebar, Section } from "./settings-sidebar";
import { GeneralSettings } from "@/components/settings/sections/general/section";
import { AppearanceSettings } from "@/components/settings/sections/appearance/section";
import { AboutSettings } from "@/components/settings/sections/about/section";
import { ProfilesSettings } from "@/components/settings/sections/profiles/section";
import { SpacesSettings } from "@/components/settings/sections/spaces/section";
import { PrivacySettings } from "@/components/settings/sections/privacy/section";
import { PasswordsSettings } from "@/components/settings/sections/passwords/section";
import { ShortcutsSettings } from "@/components/settings/sections/shortcuts/section";
import { SearchEnginesSettings } from "@/components/settings/sections/search/section";
import { ImportDataSettings } from "@/components/settings/sections/import/section";
import { McpSettings } from "@/components/settings/sections/mcp/section";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { AppUpdatesProvider } from "@/components/providers/app-updates-provider";
import {
  SlidersHorizontal,
  Palette,
  UsersIcon,
  OrbitIcon,
  ShieldCheck,
  KeyRound,
  KeyboardIcon,
  Search,
  Sparkles,
  ArrowUpRight,
  Download,
  PlugZap
} from "lucide-react";
import { ShortcutsProvider, useShortcuts } from "@/components/providers/shortcuts-provider";
import { SearchEnginesProvider, useSearchEngines } from "@/components/providers/search-engines-provider";
import { AnimatePresence, motion } from "motion/react";
import {
  SECTION_LABELS,
  STATIC_SETTINGS_SEARCH_ENTRIES,
  resolveDeepLinkSection,
  type SettingsSearchEntry,
  type SettingsSectionId
} from "./settings-search-index";
import { SettingsGroup, SettingsRow, SettingsSectionHeader } from "./components/setting-row";

interface SettingsNavigationContextValue {
  highlightedRowId: string | null;
  jumpToSetting: (sectionId: SettingsSectionId, targetRowId?: string) => void;
}

const SettingsNavigationContext = createContext<SettingsNavigationContextValue>({
  highlightedRowId: null,
  jumpToSetting: () => {}
});

export function useSettingsNavigation() {
  return useContext(SettingsNavigationContext);
}

const SECTIONS: Section[] = [
  { id: "general", label: "General", icon: <SlidersHorizontal className="size-4" />, category: "preferences" },
  { id: "appearance", label: "Appearance & Layout", icon: <Palette className="size-4" />, category: "preferences" },
  { id: "search", label: "Search Engines", icon: <Search className="size-4" />, category: "preferences" },
  { id: "privacy", label: "Privacy & Apps", icon: <ShieldCheck className="size-4" />, category: "preferences" },
  { id: "passwords", label: "Passwords", icon: <KeyRound className="size-4" />, category: "preferences" },
  { id: "spaces", label: "Spaces", icon: <OrbitIcon className="size-4" />, category: "workspace" },
  { id: "profiles", label: "Profiles", icon: <UsersIcon className="size-4" />, category: "workspace" },
  { id: "import", label: "Import Data", icon: <Download className="size-4" />, category: "workspace" },
  { id: "mcp", label: "MCP Server", icon: <PlugZap className="size-4" />, category: "workspace" },
  { id: "shortcuts", label: "Shortcuts", icon: <KeyboardIcon className="size-4" />, category: "workspace" },
  { id: "about", label: "About Lumi", icon: <Sparkles className="size-4 text-primary" />, category: "system" }
];

function GlobalSearchResults({
  query,
  onSelectResult,
  onClear
}: {
  query: string;
  onSelectResult: (entry: SettingsSearchEntry) => void;
  onClear: () => void;
}) {
  const { shortcuts, formatShortcutForDisplay } = useShortcuts();
  const { searchEngines } = useSearchEngines();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const dynamicEntries: SettingsSearchEntry[] = [
      ...shortcuts.map((s) => ({
        id: `shortcut-${s.id}`,
        sectionId: "shortcuts" as const,
        sectionLabel: "Shortcuts",
        title: s.name,
        description: `${s.category} • ${formatShortcutForDisplay(s.shortcut)}`,
        keywords: [s.category, s.id, formatShortcutForDisplay(s.shortcut)],
        targetRowId: `shortcut-${s.id}`
      })),
      ...searchEngines.map((engine) => ({
        id: `engine-${engine.id}`,
        sectionId: "search" as const,
        sectionLabel: "Search Engines",
        title: `${engine.name} (@${engine.shortcut})`,
        description: engine.searchUrl,
        keywords: [engine.shortcut, "search", "engine"],
        targetRowId: "defaultSearchEngine"
      }))
    ];

    const allEntries = [...STATIC_SETTINGS_SEARCH_ENTRIES, ...dynamicEntries];
    return allEntries
      .filter((entry) => {
        const haystack = [entry.title, entry.description, entry.sectionLabel, ...(entry.keywords ?? [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 24);
  }, [query, shortcuts, formatShortcutForDisplay, searchEngines]);

  const grouped = useMemo(() => {
    const map = new Map<SettingsSectionId, SettingsSearchEntry[]>();
    for (const item of matches) {
      const existing = map.get(item.sectionId) ?? [];
      existing.push(item);
      map.set(item.sectionId, existing);
    }
    return Array.from(map.entries());
  }, [matches]);

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        title="Search Results"
        description={`${matches.length} ${matches.length === 1 ? "match" : "matches"} for "${query.trim()}"`}
        icon={<Search className="size-4" />}
        actions={
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-primary hover:underline cursor-pointer"
          >
            Clear search
          </button>
        }
      />

      {grouped.length === 0 ? (
        <div className="lumi-glass-panel rounded-2xl p-10 text-center space-y-1.5">
          <p className="text-sm font-medium text-foreground">No matching settings found</p>
          <p className="text-xs text-muted-foreground">
            Try searching for layout, sleep, adblock, shortcuts, or a search engine.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {grouped.map(([sectionId, entries]) => (
            <SettingsGroup key={sectionId} title={SECTION_LABELS[sectionId]}>
              {entries.map((entry) => (
                <SettingsRow
                  key={entry.id}
                  label={entry.title}
                  description={entry.description}
                  onClick={() => onSelectResult(entry)}
                >
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Open
                    <ArrowUpRight className="size-3.5" />
                  </span>
                </SettingsRow>
              ))}
            </SettingsGroup>
          ))}
        </div>
      )}
    </div>
  );
}

function getSectionFromLocation(): SettingsSectionId {
  if (typeof window === "undefined") return "general";
  const params = new URLSearchParams(window.location.search);
  const querySection = params.get("section");
  const hashSection = window.location.hash.replace(/^#/, "");
  return resolveDeepLinkSection(querySection || hashSection || null);
}

function getSpaceFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("spaceId");
}

function syncUrlForSection(section: SettingsSectionId, replace = false) {
  if (typeof window === "undefined") return;
  const nextUrl = new URL(window.location.href);
  if (section === "general") {
    nextUrl.searchParams.delete("section");
  } else {
    nextUrl.searchParams.set("section", section);
  }
  nextUrl.searchParams.delete("spaceId");
  nextUrl.hash = "";
  const targetHref = nextUrl.toString();
  if (targetHref === window.location.href) return;
  if (replace) {
    window.history.replaceState({ section }, "", targetHref);
  } else {
    window.history.pushState({ section }, "", targetHref);
  }
}

function SettingsWorkspace() {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(getSectionFromLocation);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(getSpaceFromLocation);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  const selectSection = useCallback((nextSection: SettingsSectionId, replaceUrl = false) => {
    setActiveSection(nextSection);
    syncUrlForSection(nextSection, replaceUrl);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setSearchQuery("");
      setActiveSection(getSectionFromLocation());
      setSelectedSpaceId(getSpaceFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const unsub = lumi.windows.onSettingsSectionNavigate((section) => {
      setSearchQuery("");
      const resolved = resolveDeepLinkSection(section);
      setActiveSection(resolved);
      syncUrlForSection(resolved, true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!highlightedRowId) return;
    const timer = window.setTimeout(() => setHighlightedRowId(null), 2000);
    return () => window.clearTimeout(timer);
  }, [highlightedRowId]);

  const jumpToSetting = useCallback(
    (sectionId: SettingsSectionId, targetRowId?: string) => {
      setSearchQuery("");
      selectSection(sectionId);
      if (targetRowId) {
        window.setTimeout(() => setHighlightedRowId(targetRowId), 120);
      }
    },
    [selectSection]
  );

  const navigateToSpaces = useCallback(
    (profileId: string) => {
      setSelectedProfileId(profileId);
      setSelectedSpaceId(null);
      setSearchQuery("");
      selectSection("spaces");
    },
    [selectSection]
  );

  const navigateToSpace = useCallback(
    (profileId: string, spaceId: string) => {
      setSelectedProfileId(profileId);
      setSelectedSpaceId(spaceId);
      setSearchQuery("");
      selectSection("spaces");
    },
    [selectSection]
  );

  const navContextValue = useMemo(() => ({ highlightedRowId, jumpToSetting }), [highlightedRowId, jumpToSetting]);

  const ActiveSectionComponent = useMemo(() => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings />;
      case "appearance":
        return <AppearanceSettings />;
      case "search":
        return <SearchEnginesSettings />;
      case "privacy":
        return <PrivacySettings />;
      case "passwords":
        return <PasswordsSettings />;
      case "about":
        return <AboutSettings />;
      case "profiles":
        return <ProfilesSettings navigateToSpaces={navigateToSpaces} navigateToSpace={navigateToSpace} />;
      case "spaces":
        return <SpacesSettings initialSelectedProfile={selectedProfileId} initialSelectedSpace={selectedSpaceId} />;
      case "import":
        return <ImportDataSettings />;
      case "mcp":
        return <McpSettings />;
      case "shortcuts":
        return <ShortcutsSettings />;
      default:
        return <GeneralSettings />;
    }
  }, [activeSection, navigateToSpace, navigateToSpaces, selectedProfileId, selectedSpaceId]);

  const isSearching = searchQuery.trim().length > 0;
  const currentTitle = isSearching ? "Search Results" : SECTION_LABELS[activeSection];

  return (
    <SettingsNavigationContext.Provider value={navContextValue}>
      <div className="relative flex h-screen w-full overflow-hidden bg-background text-foreground">
        <div
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_55%_40%_at_38%_0%,oklch(0.6_0.2_258_/_0.085),transparent_70%)]"
          aria-hidden
        />
        <title>{`Settings — ${currentTitle}`}</title>

        <SettingsSidebar
          activeSection={activeSection}
          setActiveSection={selectSection}
          sections={SECTIONS}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="sticky top-0 z-10 h-11 border-b border-black/[0.06] dark:border-white/[0.08] bg-background/75 backdrop-blur-2xl saturate-150 px-6 lg:px-8 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <span className="font-medium">Settings</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-semibold text-foreground truncate">{currentTitle}</span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/85 bg-black/[0.035] dark:bg-white/[0.05] px-2.5 py-0.5 rounded-full border border-black/[0.05] dark:border-white/[0.07]">
              {activeSection === "general" ? "lumi://settings" : `lumi://settings?section=${activeSection}`}
            </span>
          </header>

          <main className="flex-1 overflow-y-auto px-6 py-5 lg:px-8 no-scrollbar">
            <div className="mx-auto w-full max-w-6xl pb-10">
              {isSearching ? (
                <GlobalSearchResults
                  query={searchQuery}
                  onClear={() => setSearchQuery("")}
                  onSelectResult={(entry) => jumpToSetting(entry.sectionId, entry.targetRowId)}
                />
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14, ease: "easeOut" }}
                  >
                    {ActiveSectionComponent}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </main>
        </div>
      </div>
    </SettingsNavigationContext.Provider>
  );
}

export function SettingsLayout() {
  return (
    <AppUpdatesProvider>
      <ShortcutsProvider>
        <SettingsProvider>
          <SearchEnginesProvider>
            <SettingsWorkspace />
          </SearchEnginesProvider>
        </SettingsProvider>
      </ShortcutsProvider>
    </AppUpdatesProvider>
  );
}
