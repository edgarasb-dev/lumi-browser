"use client";

import { motion } from "motion/react";
import { LucideIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState, useEffect } from "react";

export interface Section {
  id: string;
  label: string;
  icon: React.ReactElement<LucideIcon>;
  category?: "preferences" | "organization" | "system";
  badge?: string;
}

interface SettingsSidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  sections: Section[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  preferences: "Preferences",
  organization: "Spaces & Tabs",
  system: "System"
};

export function SettingsSidebar({
  activeSection,
  setActiveSection,
  sections,
  searchQuery = "",
  onSearchChange
}: SettingsSidebarProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    flow.app
      .getAppInfo()
      .then((info) => setAppVersion(info.app_version))
      .catch((err) => console.error("Failed to fetch app info:", err));
  }, []);

  const handleSearch = (val: string) => {
    setLocalSearch(val);
    onSearchChange?.(val);
  };

  const filteredSections = useMemo(() => {
    if (!localSearch.trim()) return sections;
    const query = localSearch.toLowerCase();
    return sections.filter((s) => s.label.toLowerCase().includes(query) || s.id.toLowerCase().includes(query));
  }, [sections, localSearch]);

  const groupedSections = useMemo(() => {
    const groups: { category: string; items: Section[] }[] = [];
    const catMap: Record<string, Section[]> = {};

    for (const section of filteredSections) {
      const cat = section.category || "preferences";
      if (!catMap[cat]) {
        catMap[cat] = [];
      }
      catMap[cat].push(section);
    }

    const order = ["preferences", "organization", "system"];
    for (const key of order) {
      if (catMap[key] && catMap[key].length > 0) {
        groups.push({ category: key, items: catMap[key] });
      }
    }

    return groups;
  }, [filteredSections]);

  return (
    <aside className="w-60 shrink-0 border-r border-border/40 bg-card/30 backdrop-blur-md p-3 flex flex-col justify-between select-none">
      <div className="flex flex-col gap-3">
        {/* Quick Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/70 pointer-events-none" />
          <input
            type="text"
            placeholder="Search settings..."
            value={localSearch}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border/40 focus:border-primary/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-hidden focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Section Navigation */}
        <nav className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-170px)] no-scrollbar">
          {groupedSections.map((group) => (
            <div key={group.category} className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70 px-2.5 py-0.5">
                {CATEGORY_LABELS[group.category] || group.category}
              </span>
              <div className="flex flex-col gap-0.5">
                {group.items.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        "relative w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer group",
                        isActive
                          ? "text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="settings-active-indicator"
                          className="absolute inset-0 rounded-xl bg-linear-to-r from-primary to-primary/90 shadow-xs"
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            "size-4 shrink-0 transition-transform duration-150 group-hover:scale-110",
                            isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        >
                          {section.icon}
                        </span>
                        <span className="truncate">{section.label}</span>
                      </div>
                      {section.badge && (
                        <span
                          className={cn(
                            "relative z-10 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                            isActive ? "bg-white/20 text-white" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                          )}
                        >
                          {section.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {groupedSections.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">No matching settings found</div>
          )}
        </nav>
      </div>

      {/* Sidebar Footer with Lumi & Attribution Info */}
      <div className="pt-3 border-t border-border/40 px-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-foreground/90 font-semibold">Lumi</span>
            {appVersion ? <span>v{appVersion}</span> : null}
          </div>
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md border border-primary/20">
            Lumi
          </span>
        </div>
      </div>
    </aside>
  );
}
