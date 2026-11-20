export type SettingsSectionId =
  | "general"
  | "appearance"
  | "search"
  | "privacy"
  | "spaces"
  | "profiles"
  | "shortcuts"
  | "about";

export interface SettingsSearchEntry {
  id: string;
  sectionId: SettingsSectionId;
  sectionLabel: string;
  title: string;
  description: string;
  keywords?: string[];
  targetRowId?: string;
}

export const SECTION_LABELS: Record<SettingsSectionId, string> = {
  general: "General",
  appearance: "Appearance & Layout",
  search: "Search Engines",
  privacy: "Privacy & Apps",
  spaces: "Spaces",
  profiles: "Profiles",
  shortcuts: "Shortcuts",
  about: "About Lumi"
};

export const STATIC_SETTINGS_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  // General
  {
    id: "autoUpdate",
    sectionId: "general",
    sectionLabel: "General",
    title: "Automatic Updates",
    description: "Download and verify new Lumi builds in the background.",
    keywords: ["update", "version", "release", "auto"],
    targetRowId: "autoUpdate"
  },
  {
    id: "internal_updateCheck",
    sectionId: "general",
    sectionLabel: "General",
    title: "Software Updates & Release Check",
    description: "Check for new Lumi versions, download updates, or view GitHub releases.",
    keywords: ["update", "check", "download", "install", "version"],
    targetRowId: "internal_updateCheck"
  },
  {
    id: "internal_setAsDefaultBrowser",
    sectionId: "general",
    sectionLabel: "General",
    title: "Default Browser",
    description: "Set Lumi as your system default web browser for HTTP and HTTPS links.",
    keywords: ["default", "system", "http", "links"],
    targetRowId: "internal_setAsDefaultBrowser"
  },
  {
    id: "syncTabsAcrossWindows",
    sectionId: "general",
    sectionLabel: "General",
    title: "Sync Tabs Across Windows",
    description: "Keep tabs and active spaces synchronized between open Lumi windows.",
    keywords: ["window", "sync", "tabs"],
    targetRowId: "syncTabsAcrossWindows"
  },
  {
    id: "archiveTabAfter",
    sectionId: "general",
    sectionLabel: "General",
    title: "Auto-Archive Inactive Tabs",
    description: "Automatically archive idle tabs after 12 hours, 24 hours, 7 days, or 30 days.",
    keywords: ["archive", "tabs", "cleanup", "performance", "idle"],
    targetRowId: "archiveTabAfter"
  },
  {
    id: "sleepTabAfter",
    sectionId: "general",
    sectionLabel: "General",
    title: "Sleep Background Tabs",
    description: "Unload inactive tabs to free RAM and reduce battery usage.",
    keywords: ["sleep", "memory", "ram", "hibernate", "performance", "battery"],
    targetRowId: "sleepTabAfter"
  },
  {
    id: "enableLumiPdfViewer",
    sectionId: "general",
    sectionLabel: "General",
    title: "Built-in Lumi PDF Viewer",
    description: "Use Lumi's custom interactive PDF viewer with outline & drawing tools.",
    keywords: ["pdf", "experimental", "viewer"],
    targetRowId: "enableLumiPdfViewer"
  },
  {
    id: "enableMv2Extensions",
    sectionId: "general",
    sectionLabel: "General",
    title: "Manifest V2 Extensions Support",
    description: "Enable legacy MV2 Chrome extensions (requires browser restart).",
    keywords: ["mv2", "manifest", "extensions", "advanced"],
    targetRowId: "enableMv2Extensions"
  },
  {
    id: "internal_resetOnboarding",
    sectionId: "general",
    sectionLabel: "General",
    title: "Reset Onboarding Walkthrough",
    description: "Re-run the initial Lumi setup wizard on next launch.",
    keywords: ["onboarding", "wizard", "welcome", "reset"],
    targetRowId: "internal_resetOnboarding"
  },

  // Appearance & Layout
  {
    id: "themeMode",
    sectionId: "appearance",
    sectionLabel: "Appearance & Layout",
    title: "Interface Theme (Light / Dark / System)",
    description: "Switch between macOS Light, Dark, or System appearance.",
    keywords: ["dark mode", "light mode", "theme", "appearance"],
    targetRowId: "themeMode"
  },
  {
    id: "navigationLayout",
    sectionId: "appearance",
    sectionLabel: "Appearance & Layout",
    title: "Navigation Layout (Sidebar vs Topbar)",
    description: "Choose between vertical sidebar tabs or a horizontal compact top bar.",
    keywords: ["sidebar", "topbar", "horizontal", "vertical", "layout", "tabs"],
    targetRowId: "navigationLayout"
  },
  {
    id: "sidebarSide",
    sectionId: "appearance",
    sectionLabel: "Appearance & Layout",
    title: "Sidebar Anchor Side (Left / Right)",
    description: "Dock the vertical sidebar to the left or right edge of windows.",
    keywords: ["sidebar", "left", "right", "side"],
    targetRowId: "sidebarSide"
  },
  {
    id: "commandPaletteOpacity",
    sectionId: "appearance",
    sectionLabel: "Appearance & Layout",
    title: "Command Palette Translucency",
    description: "Switch between Solid, Tinted, and Glassy backdrop materials for Cmd+K.",
    keywords: ["omnibox", "command palette", "glass", "opacity", "blur", "translucent"],
    targetRowId: "commandPaletteOpacity"
  },
  {
    id: "newTabMode",
    sectionId: "appearance",
    sectionLabel: "Appearance & Layout",
    title: "New Tab Experience",
    description: "Open either the floating Command Palette or Start Page on Cmd+T.",
    keywords: ["new tab", "start page", "omnibox", "cmd+t"],
    targetRowId: "newTabMode"
  },

  // Privacy & Apps
  {
    id: "contentBlocker",
    sectionId: "privacy",
    sectionLabel: "Privacy & Apps",
    title: "Content Blocker Shield",
    description: "Configure built-in ad, tracker, and cookie-banner blocking protection.",
    keywords: ["adblock", "ads", "trackers", "privacy", "ghostery", "cookie", "shield"],
    targetRowId: "contentBlocker"
  },
  {
    id: "externalAppProtocols",
    sectionId: "privacy",
    sectionLabel: "Privacy & Apps",
    title: "External Application Protocol Permissions",
    description: "Review and revoke websites allowed to launch macOS external apps.",
    keywords: ["external", "protocols", "zoom", "slack", "mailto", "permissions", "revoke"],
    targetRowId: "externalAppProtocols"
  },

  // Search
  {
    id: "defaultSearchEngine",
    sectionId: "search",
    sectionLabel: "Search Engines",
    title: "Default Search Engine & Bangs",
    description: "Choose default search provider or add custom @shortcut search engines.",
    keywords: ["google", "duckduckgo", "kagi", "bing", "perplexity", "search", "bangs"],
    targetRowId: "defaultSearchEngine"
  },

  // Spaces & Profiles
  {
    id: "manageSpaces",
    sectionId: "spaces",
    sectionLabel: "Spaces",
    title: "Spaces, Themes & Gradient Icons",
    description: "Create, reorder, customize gradients, and assign icons to browsing spaces.",
    keywords: ["spaces", "workspaces", "colors", "gradient", "theme", "icon"]
  },
  {
    id: "manageProfiles",
    sectionId: "profiles",
    sectionLabel: "Profiles",
    title: "Browser Profiles",
    description: "Separate cookies, extensions, history, and spaces across isolated profiles.",
    keywords: ["profiles", "work", "personal", "cookies"]
  },

  // About
  {
    id: "aboutLumi",
    sectionId: "about",
    sectionLabel: "About Lumi",
    title: "Version, Engine Specs & GPLv3 License",
    description: "Inspect Lumi version, Chromium engine version, and open-source attribution.",
    keywords: ["about", "version", "chromium", "flow", "gplv3", "license"]
  }
];

export function resolveDeepLinkSection(raw?: string | null): SettingsSectionId {
  if (!raw) return "general";
  if (raw === "external-apps") return "privacy";
  if (raw in SECTION_LABELS) return raw as SettingsSectionId;
  return "general";
}
