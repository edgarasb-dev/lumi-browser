import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SettingsSidebar, Section } from "./settings-sidebar";
import { SettingsTitlebar } from "./settings-titlebar";
import { GeneralSettings } from "@/components/settings/sections/general/section";
import { AppearanceSettings } from "@/components/settings/sections/appearance/section";
import { AboutSettings } from "@/components/settings/sections/about/section";
import { ProfilesSettings } from "@/components/settings/sections/profiles/section";
import { SpacesSettings } from "@/components/settings/sections/spaces/section";
import { PrivacySettings } from "@/components/settings/sections/privacy/section";
import { ShortcutsSettings } from "@/components/settings/sections/shortcuts/section";
import { SearchEnginesSettings } from "@/components/settings/sections/search/section";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { AppUpdatesProvider } from "@/components/providers/app-updates-provider";
import {
  SlidersHorizontal,
  Palette,
  UsersIcon,
  OrbitIcon,
  ShieldCheck,
  KeyboardIcon,
  Search,
  Sparkles,
  ArrowUpRight
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
  { id: "spaces", label: "Spaces", icon: <OrbitIcon className="size-4" />, category: "workspace" },
  { id: "profiles", label: "Profiles", icon: <UsersIcon className="size-4" />, category: "workspace" },
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
        grouped.map(([sectionId, entries]) => (
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
        ))
      )}
    </div>
  );
}

function SettingsWorkspace() {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  useEffect(() => {
    void lumi.windows.consumePendingSettingsSection().then((section) => {
      if (section) {
        setActiveSection(resolveDeepLinkSection(section));
      }
    });
    const unsub = lumi.windows.onSettingsSectionNavigate((section) => {
      setSearchQuery("");
      setActiveSection(resolveDeepLinkSection(section));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!highlightedRowId) return;
    const timer = window.setTimeout(() => setHighlightedRowId(null), 2000);
    return () => window.clearTimeout(timer);
  }, [highlightedRowId]);

  const jumpToSetting = useCallback((sectionId: SettingsSectionId, targetRowId?: string) => {
    setSearchQuery("");
    setActiveSection(sectionId);
    if (targetRowId) {
      window.setTimeout(() => setHighlightedRowId(targetRowId), 120);
    }
  }, []);

  const navigateToSpaces = (profileId: string) => {
    setSelectedProfileId(profileId);
    setSelectedSpaceId(null);
    setSearchQuery("");
    setActiveSection("spaces");
  };

  const navigateToSpace = (profileId: string, spaceId: string) => {
    setSelectedProfileId(profileId);
    setSelectedSpaceId(spaceId);
    setSearchQuery("");
    setActiveSection("spaces");
  };

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
      case "about":
        return <AboutSettings />;
      case "profiles":
        return <ProfilesSettings navigateToSpaces={navigateToSpaces} navigateToSpace={navigateToSpace} />;
      case "spaces":
        return <SpacesSettings initialSelectedProfile={selectedProfileId} initialSelectedSpace={selectedSpaceId} />;
      case "shortcuts":
        return <ShortcutsSettings />;
      default:
        return <GeneralSettings />;
    }
  }, [activeSection, selectedProfileId, selectedSpaceId]);

  const isSearching = searchQuery.trim().length > 0;
  const currentTitle = isSearching ? "Search Results" : SECTION_LABELS[activeSection];

  return (
    <SettingsNavigationContext.Provider value={navContextValue}>
      <div className="select-none flex h-screen w-full lumi-vibrant-window text-foreground overflow-hidden">
        <title>Lumi Settings</title>

        <SettingsSidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          sections={SECTIONS}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <SettingsTitlebar title={currentTitle} />

          <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8 no-scrollbar">
            <div className="mx-auto max-w-3xl pb-8">
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
