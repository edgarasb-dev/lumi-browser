// This is used to create a simple settings framework.
// This will make it easier to add new settings and cards.

import type { BasicSetting, BasicSettingCard } from "~/types/settings";

/**
 * Maps archive tab duration settings to their equivalent values in seconds.
 * 'never' is mapped to Infinity.
 */
export const ArchiveTabValueMap = {
  "12h": 12 * 60 * 60,
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
  never: Infinity
};

/**
 * Maps sleep tab duration settings to their equivalent values in seconds.
 * 'never' is mapped to Infinity.
 */
export const SleepTabValueMap = {
  "5m": 5 * 60,
  "10m": 10 * 60,
  "30m": 30 * 60,
  "1h": 60 * 60,
  "2h": 2 * 60 * 60,
  "4h": 4 * 60 * 60,
  "8h": 8 * 60 * 60,
  "12h": 12 * 60 * 60,
  "24h": 24 * 60 * 60,
  never: Infinity
};

export const BasicSettings: BasicSetting[] = [
  // [GENERAL] Auto Update
  {
    id: "autoUpdate",
    name: "Automatic Updates",
    description: "Download and verify new Lumi builds in the background.",
    showName: true,
    type: "boolean",
    defaultValue: true
  },

  // [GENERAL] Sync Tabs Across Windows
  {
    id: "syncTabsAcrossWindows",
    name: "Sync Tabs Across Windows",
    description: "Keep tabs and active spaces synchronized between open Lumi windows.",
    showName: true,
    type: "boolean",
    defaultValue: false
  },

  // [GENERAL] Content Blocking
  {
    id: "contentBlocker",
    name: "Content Blocker Shield",
    description: "Built-in Ghostery engine blocking ads, trackers, and cookie prompts.",
    showName: true,
    type: "enum",
    defaultValue: "disabled",
    options: [
      {
        id: "disabled",
        name: "Disabled"
      },
      {
        id: "adsOnly",
        name: "Block Ads"
      },
      {
        id: "adsAndTrackers",
        name: "Block Ads & Trackers"
      },
      {
        id: "all",
        name: "Strict (Ads, Trackers & Cookie Notices)"
      }
    ]
  },

  // Interface Theme
  {
    id: "interfaceTheme",
    name: "Interface Appearance",
    description: "Follow macOS/OS appearance or lock Lumi chrome and internal pages to Light or Dark.",
    showName: true,
    type: "enum",
    defaultValue: "system",
    options: [
      {
        id: "system",
        name: "Match System"
      },
      {
        id: "light",
        name: "Light"
      },
      {
        id: "dark",
        name: "Dark"
      }
    ]
  },

  // New Tab Mode
  {
    id: "newTabMode",
    name: "New Tab Experience",
    description: "Choose whether Cmd+T opens the floating Command Palette or the Start Page.",
    showName: true,
    type: "enum",
    defaultValue: "omnibox",
    options: [
      {
        id: "omnibox",
        name: "Command Palette"
      },
      {
        id: "tab",
        name: "Start Page"
      }
    ]
  },

  // Command Palette Opacity
  {
    id: "commandPaletteOpacity",
    name: "Command Palette Material",
    description: "Control translucency and backdrop blur intensity for the Omnibox.",
    showName: true,
    type: "enum",
    defaultValue: "tinted",
    options: [
      {
        id: "solid",
        name: "Solid"
      },
      {
        id: "tinted",
        name: "Tinted (Default)"
      },
      {
        id: "glassy",
        name: "Glassy"
      }
    ]
  },

  // Navigation Layout
  {
    id: "navigationLayout",
    name: "Navigation Layout",
    description: "Switch between an Arc-style vertical sidebar and a compact horizontal top bar.",
    showName: true,
    type: "enum",
    defaultValue: "sidebar",
    options: [
      {
        id: "sidebar",
        name: "Vertical Sidebar (Default)"
      },
      {
        id: "topbar",
        name: "Horizontal Top Bar"
      }
    ]
  },

  // Sidebar Side
  {
    id: "sidebarSide",
    name: "Sidebar Anchor Side",
    description: "Choose which window edge anchors the vertical sidebar.",
    showName: true,
    type: "enum",
    defaultValue: "left",
    options: [
      {
        id: "left",
        name: "Left"
      },
      {
        id: "right",
        name: "Right"
      }
    ]
  },

  // Archive Tab After
  {
    id: "archiveTabAfter",
    name: "Auto-Archive Inactive Tabs",
    description: "Automatically clean up idle tabs that haven't been visited recently.",
    showName: true,
    type: "enum",
    defaultValue: "12h",
    options: [
      {
        id: "12h",
        name: "12 Hours"
      },
      {
        id: "24h",
        name: "24 Hours"
      },
      {
        id: "7d",
        name: "7 Days"
      },
      {
        id: "30d",
        name: "30 Days"
      },
      {
        id: "never",
        name: "Never"
      }
    ]
  },

  // Sleep Tab After
  {
    id: "sleepTabAfter",
    name: "Sleep Background Tabs",
    description: "Unload inactive background tabs from memory to save battery and RAM.",
    showName: true,
    type: "enum",
    defaultValue: "30m",
    options: [
      {
        id: "5m",
        name: "5 Minutes"
      },
      {
        id: "10m",
        name: "10 Minutes"
      },
      {
        id: "30m",
        name: "30 Minutes"
      },
      {
        id: "1h",
        name: "1 Hour"
      },
      {
        id: "2h",
        name: "2 Hours"
      },
      {
        id: "4h",
        name: "4 Hours"
      },
      {
        id: "8h",
        name: "8 Hours"
      },
      {
        id: "12h",
        name: "12 Hours"
      },
      {
        id: "24h",
        name: "24 Hours"
      },
      {
        id: "never",
        name: "Never"
      }
    ]
  },

  // [EXPERIMENTAL] Enable Lumi PDF Viewer
  {
    id: "enableLumiPdfViewer",
    name: "Built-in Lumi PDF Viewer",
    description: "Use Lumi's custom PDF reader with annotations instead of Chromium's default viewer.",
    showName: true,
    type: "boolean",
    defaultValue: false
  },

  // [ADVANCED] Enable mv2 extensions
  {
    id: "enableMv2Extensions",
    name: "Manifest V2 Extensions Support",
    description: "Experimental compatibility for legacy MV2 Chrome extensions (requires restart).",
    showName: true,
    type: "boolean",
    defaultValue: false
  }
];

export const BasicSettingCards: BasicSettingCard[] = [
  // General Card
  {
    title: "General Settings",
    subtitle: "General settings for the application",
    settings: ["autoUpdate", "syncTabsAcrossWindows", "contentBlocker", "internal_setAsDefaultBrowser"]
  },

  // Update Card (Internal)
  {
    title: "INTERNAL_UPDATE",
    subtitle: "",
    settings: []
  },

  // New Tab Mode Card
  {
    title: "New Tab Mode",
    subtitle: "Choose how new tabs should open",
    settings: ["newTabMode"]
  },

  // Command Palette Card
  {
    title: "Command Palette",
    subtitle: "Choose how translucent the command palette should be",
    settings: ["commandPaletteOpacity"]
  },

  // Layout & Navigation Card
  {
    title: "Layout & Navigation",
    subtitle: "Choose between vertical sidebar or horizontal top bar navigation",
    settings: ["navigationLayout", "sidebarSide"]
  },

  // Performance Settings Card
  {
    title: "Performance Settings",
    subtitle: "Settings to improve performance",
    settings: ["archiveTabAfter", "sleepTabAfter"]
  },

  // Onboarding Card (Internal)
  {
    title: "INTERNAL_ONBOARDING",
    subtitle: "",
    settings: []
  },

  // Experimental Settings Card
  {
    title: "Experimental Settings",
    subtitle: "Experimental settings for Lumi",
    settings: ["enableLumiPdfViewer"]
  },

  // Advanced Settings Card
  {
    title: "Advanced Settings",
    subtitle: "Power users only (Some settings may require a restart)",
    settings: ["enableMv2Extensions"]
  }
];
