import { useState, useMemo } from "react";
import { SettingsSidebar, Section } from "./settings-sidebar";
import { SettingsTitlebar } from "./settings-titlebar";
import { GeneralSettings } from "@/components/settings/sections/general/section";
import { IconSettings } from "@/components/settings/sections/icon/section";
import { AboutSettings } from "@/components/settings/sections/about/section";
import { ProfilesSettings } from "@/components/settings/sections/profiles/section";
import { SpacesSettings } from "@/components/settings/sections/spaces/section";
import { ExternalAppsSettings } from "@/components/settings/sections/external-apps/section";
import { ShortcutsSettings } from "@/components/settings/sections/shortcuts/section";
import { SearchEnginesSettings } from "@/components/settings/sections/search/section";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { AppUpdatesProvider } from "@/components/providers/app-updates-provider";
import { Globe, DockIcon, UsersIcon, OrbitIcon, BlocksIcon, KeyboardIcon, Search, Sparkles } from "lucide-react";
import { ShortcutsProvider } from "@/components/providers/shortcuts-provider";
import { SearchEnginesProvider } from "@/components/providers/search-engines-provider";
import { AnimatePresence, motion } from "motion/react";

export function SettingsLayout() {
  const [activeSection, setActiveSection] = useState("general");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const sections: Section[] = [
    { id: "general", label: "General", icon: <Globe className="size-4" />, category: "preferences" },
    { id: "search", label: "Search", icon: <Search className="size-4" />, category: "preferences", badge: "New" },
    { id: "icons", label: "App Icon", icon: <DockIcon className="size-4" />, category: "preferences" },
    { id: "spaces", label: "Spaces", icon: <OrbitIcon className="size-4" />, category: "organization" },
    { id: "profiles", label: "Profiles", icon: <UsersIcon className="size-4" />, category: "organization" },
    { id: "shortcuts", label: "Shortcuts", icon: <KeyboardIcon className="size-4" />, category: "organization" },
    { id: "external-apps", label: "External Apps", icon: <BlocksIcon className="size-4" />, category: "system" },
    { id: "about", label: "About Lumi", icon: <Sparkles className="size-4 text-primary" />, category: "system" }
  ];

  const navigateToSpaces = (profileId: string) => {
    setSelectedProfileId(profileId);
    setSelectedSpaceId(null);
    setActiveSection("spaces");
  };

  const navigateToSpace = (profileId: string, spaceId: string) => {
    setSelectedProfileId(profileId);
    setSelectedSpaceId(spaceId);
    setActiveSection("spaces");
  };

  const ActiveSectionComponent = useMemo(() => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings />;
      case "search":
        return <SearchEnginesSettings />;
      case "icons":
        return <IconSettings />;
      case "about":
        return <AboutSettings />;
      case "profiles":
        return <ProfilesSettings navigateToSpaces={navigateToSpaces} navigateToSpace={navigateToSpace} />;
      case "spaces":
        return <SpacesSettings initialSelectedProfile={selectedProfileId} initialSelectedSpace={selectedSpaceId} />;
      case "external-apps":
        return <ExternalAppsSettings />;
      case "shortcuts":
        return <ShortcutsSettings />;
      default:
        return <GeneralSettings />;
    }
  }, [activeSection, selectedProfileId, selectedSpaceId]);

  return (
    <AppUpdatesProvider>
      <ShortcutsProvider>
        <SettingsProvider>
          <SearchEnginesProvider>
            <div className="select-none flex flex-col h-screen bg-background text-foreground overflow-hidden">
              <title>Lumi Settings</title>
              <SettingsTitlebar />

              <div className="flex flex-1 min-h-0 overflow-hidden relative">
                <SettingsSidebar
                  activeSection={activeSection}
                  setActiveSection={setActiveSection}
                  sections={sections}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />

                <main className="flex-1 flex flex-col overflow-hidden relative bg-muted/10">
                  {/* Ambient subtle light accents */}
                  <div className="absolute top-0 right-1/4 size-96 rounded-full bg-primary/5 blur-3xl pointer-events-none -z-10" />
                  <div className="absolute bottom-1/4 left-1/3 size-80 rounded-full bg-purple-500/5 blur-3xl pointer-events-none -z-10" />

                  <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar">
                    <div className="mx-auto max-w-3xl">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeSection}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.16, ease: "easeOut" }}
                        >
                          {ActiveSectionComponent}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </SearchEnginesProvider>
        </SettingsProvider>
      </ShortcutsProvider>
    </AppUpdatesProvider>
  );
}
