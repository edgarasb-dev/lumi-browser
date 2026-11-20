"use client";

import { motion } from "motion/react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePlatform } from "@/components/main/platform";
import { useAppUpdates } from "@/components/providers/app-updates-provider";
import type { SettingsSectionId } from "./settings-search-index";

export interface Section {
  id: SettingsSectionId;
  label: string;
  icon: ReactNode;
  category: "preferences" | "workspace" | "system";
  badge?: string;
}

interface SettingsSidebarProps {
  activeSection: SettingsSectionId;
  setActiveSection: (section: SettingsSectionId) => void;
  sections: Section[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const CATEGORY_LABELS: Record<Section["category"], string> = {
  preferences: "Preferences",
  workspace: "Workspace",
  system: "System"
};

const CATEGORY_ORDER: Section["category"][] = ["preferences", "workspace", "system"];

export function SettingsSidebar({
  activeSection,
  setActiveSection,
  sections,
  searchQuery,
  onSearchChange
}: SettingsSidebarProps) {
  const { platform } = usePlatform();
  const { updateStatus } = useAppUpdates();
  const [appVersion, setAppVersion] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    lumi.app
      .getAppInfo()
      .then((info) => setAppVersion(info.app_version))
      .catch((err) => console.error("Failed to fetch app info:", err));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (event.key === "Escape" && searchQuery && document.activeElement === inputRef.current) {
        onSearchChange("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchQuery, onSearchChange]);

  const hasAvailableUpdate = Boolean(updateStatus?.availableUpdate || updateStatus?.updateDownloaded);

  return (
    <aside className="w-60 sm:w-64 shrink-0 lumi-vibrant-sidebar border-r border-black/[0.06] dark:border-white/[0.08] flex flex-col select-none">
      {/* Top Safe Titlebar Area */}
      <div className="h-11 shrink-0 app-drag flex items-center px-3.5">
        {platform === "darwin" ? (
          <div className="w-16 h-full shrink-0" />
        ) : (
          <div className="flex items-center gap-2">
            <img src="/assets/logo.svg" alt="Lumi" className="size-5 rounded-md object-contain" />
            <span className="text-xs font-semibold tracking-tight text-foreground">Lumi Settings</span>
          </div>
        )}
      </div>

      {/* Global Settings Search */}
      <div className="px-3 pb-3 remove-app-drag">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full h-8 rounded-lg pl-8 pr-11 text-xs text-foreground placeholder:text-muted-foreground/80",
              "bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.07] dark:hover:bg-white/[0.1]",
              "focus:bg-white/90 dark:focus:bg-zinc-900/90 border border-black/[0.06] dark:border-white/[0.09]",
              "focus:border-primary/50 focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all"
            )}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 size-4 rounded-full bg-black/10 dark:bg-white/15 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="size-2.5" />
            </button>
          ) : (
            <span className="pointer-events-none absolute right-2 text-[10px] font-medium text-muted-foreground/70 bg-black/[0.04] dark:bg-white/[0.07] px-1.5 py-0.5 rounded border border-black/[0.05] dark:border-white/[0.08]">
              {platform === "darwin" ? "⌘F" : "Ctrl+F"}
            </span>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-4 no-scrollbar remove-app-drag">
        {CATEGORY_ORDER.map((category) => {
          const items = sections.filter((section) => section.category === category);
          if (items.length === 0) return null;

          return (
            <div key={category} className="space-y-1">
              <div className="px-2.5 pb-0.5 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/75">
                {CATEGORY_LABELS[category]}
              </div>
              <div className="space-y-0.5">
                {items.map((section) => {
                  const isActive = !searchQuery.trim() && activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => {
                        onSearchChange("");
                        setActiveSection(section.id);
                      }}
                      className={cn(
                        "relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer group",
                        isActive
                          ? "text-primary font-semibold"
                          : "text-foreground/75 hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="settings-active-pill"
                          className="absolute inset-0 rounded-lg bg-primary/12 dark:bg-primary/18 border border-primary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                          transition={{ type: "spring", stiffness: 460, damping: 36 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            "shrink-0 transition-transform duration-150 group-hover:scale-105",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        >
                          {section.icon}
                        </span>
                        <span className="truncate">{section.label}</span>
                      </span>
                      {section.badge && (
                        <span
                          className={cn(
                            "relative z-10 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            isActive
                              ? "bg-primary/18 text-primary"
                              : "bg-black/[0.06] dark:bg-white/[0.08] text-muted-foreground"
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
          );
        })}
      </nav>

      {/* Clean Interactive Build Pill Footer */}
      <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.07] remove-app-drag">
        <button
          type="button"
          onClick={() => {
            onSearchChange("");
            setActiveSection(hasAvailableUpdate ? "general" : "about");
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <img src="/assets/logo.svg" alt="Lumi" className="size-4 rounded-xs object-contain shrink-0" />
            <span className="text-xs font-medium text-foreground/90 truncate">
              Lumi {appVersion ? `v${appVersion}` : ""}
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              hasAvailableUpdate ? "bg-primary/15 text-primary" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                hasAvailableUpdate ? "bg-primary animate-pulse" : "bg-emerald-500"
              )}
            />
            {hasAvailableUpdate ? "Update" : "Ready"}
          </span>
        </button>
      </div>
    </aside>
  );
}
