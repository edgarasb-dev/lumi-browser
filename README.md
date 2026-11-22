<div align="center">

  <img src="./build/icon.png" alt="Lumi Browser Logo" width="112" height="112" />

  <h1>Lumi Browser</h1>

  <p>
    <strong>Cleaner browsing, sharper focus.</strong><br />
    <em>A privacy-first desktop browser with a Native Liquid Glass workspace, Spaces, Split View, OS-Encrypted Password Vault, Focus Mode, and Chrome extension support.</em>
  </p>

  <p>
    <a href="https://github.com/edgarasb-dev/lumi-browser/releases"><img src="https://img.shields.io/badge/Release-v0.4.6-2563EB?style=flat-square&logo=github" alt="Release v0.4.6" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-GPL%20v3-10B981?style=flat-square" alt="License GPL-3.0" /></a>
    <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-6366F1?style=flat-square" alt="Platforms" />
    <img src="https://img.shields.io/badge/Electron-45+-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 45+" />
    <img src="https://img.shields.io/badge/React-19-0EA5E9?style=flat-square&logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="TailwindCSS v4" />
  </p>

  <p>
    <a href="#highlights">Highlights</a> ·
    <a href="#visual-tour">Visual Tour</a> ·
    <a href="#internal-pages">Internal Pages</a> ·
    <a href="#keyboard-shortcuts">Shortcuts</a> ·
    <a href="#download--installation">Download</a> ·
    <a href="#development-setup">Development</a> ·
    <a href="#open-source-heritage">Attribution</a>
  </p>

  <br />

  <img src="./docs/assets/screenshots/beta-browser-1.png" alt="Lumi Browser — Liquid Glass Workspace" width="880" />

</div>

---

<a id="highlights"></a>

## Highlights

Lumi combines Chromium's speed and Chrome Web Store compatibility with a calm, focused desktop interface designed around workspaces instead of tab clutter:

- **Native Liquid Glass & Adaptive Chrome:** Built with true macOS `under-window` and `popover` vibrancy, Lumi Sapphire accents, Left Sidebar, Right Sidebar, and compact Horizontal Topbar layouts—switching live across all windows.
- **Spaces, Split View & Workspace Snapshots:** Keep work, study, and personal browsing isolated into themed Spaces with pinned tiles, side-by-side or stacked Split Panes (`⌘⇧\`), Glance overlays, Recently Closed recovery, and SQLite-backed **Workspace Snapshots**.
- **Command Palette & Instant Tools (`⌘L` / `⌘K`):** Jump across open tabs, history, and 13,500+ search bangs—or type live expressions (`24 * (12 + 3.5)`), unit/CSS conversions (`24px to rem`), colors (`#2563EB`), timezones, or `qr` to copy answers or beam the active tab to mobile.
- **Unified Site Control Center:** Click the address bar shield to inspect Ghostery blocker telemetry, step per-origin page zoom, toggle **Smart Night Shade**, manage persisted `Ask / Allow / Block` permissions (Camera, Microphone, Location, Notifications, Clipboard), and clear site storage.
- **Focus Mode, Split Side Panel & Page Capture:** Press `⌘⇧Z` for distraction-free Focus Mode with an integrated Pomodoro timer and optional focus blocklist. Press `⌘⇧.` to open the persistent right **Side Panel** (Markdown checklist Scratchpad v2 + live Companion Web View), or `⌘⇧2` for Area, Visible, or Full Scroll screenshots with built-in Canvas annotation.
- **Media Mini-Player, Reader Mode & DRM:** Control background audio playback & Picture-in-Picture from any tab, switch articles into double-sanitized Reader View (`⌘⌥R`), install Chrome Web Store extensions, and stream Netflix, Spotify, and YouTube out of the box via bundled Widevine DRM.
- **OS-Encrypted Password Vault & Touch ID Autofill (`lumi://passwords`):** Per-profile isolated password vaults encrypted with OS Keychain / Keyring (`safeStorage` on macOS Keychain, Windows DPAPI, and GNOME Keyring / KWallet—with **zero plaintext fallback**, refusing writes if no OS keyring is available). Protected by **macOS Touch ID** before revealing, copying, or exporting secrets, with a closed-Shadow-DOM in-page autofill & strong password generator dropdown, non-intrusive Save/Update prompts, and RFC-4180 CSV import/export.
- **Cross-Browser Importer & Active Session Migration:** Automatically scans 37 installed desktop browsers (Arc, Dia, Zen, Firefox, Safari, Orion, DuckDuckGo, Chrome, Brave, Edge, Vivaldi, Opera, Flow, Perplexity Comet, and more) plus universal Netscape HTML bookmark exports to bring over **saved passwords, active logged-in sessions (cookies, `localStorage`, and `IndexedDB`)**, bookmarks, history (up to 50,000 entries), pinned tabs, and custom `@shortcut` search engines right from first-run Onboarding or `lumi://settings?section=import`.
- **Native Local MCP Server:** Opt-in Model Context Protocol server (`127.0.0.1` loopback Streamable HTTP + stdio bridge) allowing external agents (Antigravity, Claude Code, Claude Desktop, Cursor) to inspect tabs and Spaces, extract clean Reader Mode articles, capture screenshots, and automate pages with tiered permissions (`Read Only` / `Interactive` / `Full`), profile scoping, Bearer auth, and web origin CSRF blocking.

---

<a id="visual-tour"></a>

## Visual Tour

### Lumi in Motion

<div align="center">

|                         **Workspace Transitions, Layout Morph, Spaces & Side Panel**                          |                                 **Interactive First-Run Onboarding & Space Studio**                                 |
| :-----------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------------------------------: |
| <img src="./docs/assets/screenshots/showcase-workspace-motion.gif" width="460" alt="Lumi Workspace Motion" /> | <img src="./docs/assets/screenshots/showcase-onboarding-flow.gif" width="460" alt="Upgraded Onboarding Flow GIF" /> |

</div>

### Core Workspace & Navigation

<div align="center">

|                         **Vertical Spaces, Pinned Grid & Liquid Glass Address Bar**                          |                             **Horizontal Topbar & Frosted Tab Strip**                              |
| :----------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------: |
| <img src="./docs/assets/screenshots/beta-browser-1.png" width="460" alt="Vertical Spaces and Address Bar" /> | <img src="./docs/assets/screenshots/beta-topbar-1.png" width="460" alt="Horizontal Topbar Mode" /> |

|                         **Command Palette & Instant Tab Switcher (`⌘L` / `⌘K`)**                          |                         **New Tab v2 with Studio Backdrop & Widgets**                          |
| :-------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------: |
| <img src="./docs/assets/screenshots/beta-command-1.png" width="460" alt="Command Palette Zero Suggest" /> | <img src="./docs/assets/screenshots/beta-newtab-1.png" width="460" alt="Modular New Tab v2" /> |

</div>

### Productivity, Privacy & Focus Capabilities

<div align="center">

|                               **Persistent Split Side Panel & Markdown Checklists**                                |                               **Unified Site Control Center, Zoom & Permissions**                                |
| :----------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------: |
| <img src="./docs/assets/screenshots/showcase-split-sidepanel.png" width="460" alt="Split Side Panel Scratchpad" /> | <img src="./docs/assets/screenshots/showcase-site-controls.png" width="340" alt="Unified Site Control Center" /> |

|                                   **Inline Calculators, Units & Color Converters**                                   |                               **Focus / Zen Mode & Floating Pomodoro Pill**                                |
| :------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------: |
| <img src="./docs/assets/screenshots/showcase-omnibox-tools.png" width="460" alt="Omnibox Instant Color Converter" /> | <img src="./docs/assets/screenshots/showcase-media-zen.png" width="460" alt="Focus Mode and Timer Pill" /> |

</div>

### Settings, Customization & Built-in Utilities

<div align="center">

|                           **Full-Tab Settings (`lumi://settings`) & Layout Wireframes**                            |                                          **Spaces Workbench: Live Preview & Icon Picker**                                           |
| :----------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------: |
| <img src="./docs/assets/screenshots/beta-settings-1.png" width="460" alt="Full-Tab Settings and Layout Pickers" /> | <img src="./docs/assets/screenshots/showcase-spaces-settings.png" width="460" alt="Spaces Settings Live Preview and Icon Picker" /> |

|                                 **Search Bangs Directory (`lumi://bangs`)**                                  |                              **Liquid Glass First-Run Onboarding**                              |
| :----------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------: |
| <img src="./docs/assets/screenshots/showcase-internal-pages.png" width="460" alt="Search Bangs Directory" /> | <img src="./docs/assets/screenshots/beta-onboarding-1.png" width="460" alt="Onboarding Flow" /> |

|                                 **Cross-Browser Importer (`lumi://settings?section=import`)**                                 |                                              **Onboarding Browser Migration**                                              |
| :---------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------: |
| <img src="./docs/assets/screenshots/showcase-browser-import.png" width="460" alt="Cross-Browser Importer in Lumi Settings" /> | <img src="./docs/assets/screenshots/showcase-onboarding-import.png" width="460" alt="Onboarding Browser Migration Step" /> |

|                    **OS-Encrypted Password Vault & Touch ID Protection (`lumi://passwords`)**                     |                                   **Local MCP Server & Agent Control (`lumi://settings?section=mcp`)**                                   |
| :---------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="./docs/assets/screenshots/showcase-passwords.png" width="460" alt="Lumi OS-Encrypted Password Vault" /> | <img src="./docs/assets/screenshots/showcase-mcp-settings.png" width="460" alt="Lumi Local MCP Server Settings and Live Activity Log" /> |

</div>

---

<a id="keyboard-shortcuts"></a>

## Keyboard Shortcuts

| Action                            | macOS             | Windows / Linux         |
| :-------------------------------- | :---------------- | :---------------------- |
| **Command Palette / Address Bar** | `⌘ + L` / `⌘ + K` | `Ctrl + L` / `Ctrl + K` |
| **Toggle Sidebar**                | `⌘ + S`           | `Ctrl + S`              |
| **Toggle Focus / Zen Mode**       | `⌘ + ⇧ + Z`       | `Ctrl + Shift + Z`      |
| **Toggle Split Side Panel**       | `⌘ + ⇧ + .`       | `Ctrl + Shift + .`      |
| **Capture Page Screenshot**       | `⌘ + ⇧ + 2`       | `Ctrl + Shift + 2`      |
| **Toggle Reader Mode**            | `⌘ + ⌥ + R`       | `Ctrl + Alt + R`        |
| **Open Password Manager**         | `⌘ + ⌥ + P`       | `Ctrl + Alt + P`        |
| **Find in Page**                  | `⌘ + F`           | `Ctrl + F`              |
| **Open Settings**                 | `⌘ + ,`           | `Ctrl + ,`              |

---

<a id="internal-pages"></a>

## Internal Pages

Lumi provides fast, offline-ready internal routes via the `lumi://` protocol:

| Protocol            | Description                                                                                                                                   |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `lumi://new-tab`    | Customizable start page with omnibox search, Studio Wallpapers, Speed Dial, Recently Closed, and Space Scratchpad                             |
| `lumi://settings`   | Unified browser settings workspace for General, Appearance, Search, Privacy, Passwords, Spaces, Profiles, Import Data, MCP Server & Shortcuts |
| `lumi://passwords`  | Per-profile OS Keychain-encrypted password vault with Touch ID reveal/export, strong password generator, and CSV/browser import               |
| `lumi://history`    | Infinite-scroll browsing timeline grouped by day with instant search and site-wide cleanup                                                    |
| `lumi://downloads`  | Native download manager with filter pills, live transfer speed, pause/resume, and Reveal in Finder                                            |
| `lumi://bangs`      | Filterable directory of `!` quick search shortcuts (`!gh`, `!mdn`, `!yt`, and 13,500+ more)                                                   |
| `lumi://extensions` | Chrome Web Store extension manager and per-extension permissions inspector                                                                    |
| `lumi://games`      | Lightweight offline casual games library                                                                                                      |
| `lumi://about`      | Directory of all available internal `lumi://` URLs                                                                                            |

---

<a id="download--installation"></a>

## Download & Installation

Pre-built binaries are published on the [GitHub Releases](https://github.com/edgarasb-dev/lumi-browser/releases) page:

| Platform    | Package Format          | Architecture            |
| :---------- | :---------------------- | :---------------------- |
| **macOS**   | `.dmg` / `.zip`         | Apple Silicon (`arm64`) |
| **Windows** | `.exe` (NSIS Installer) | 64-bit (`x64`)          |
| **Linux**   | `.AppImage` / `.deb`    | `x64` & `arm64`         |

---

<a id="development-setup"></a>

## Development Setup

Lumi is built with **Node.js 22+**, **Bun v1.2+**, **TypeScript**, **Electron**, **React 19**, **TailwindCSS v4**, and embedded **SQLite** via **Drizzle ORM**.

### Prerequisites

- **Node.js** v22+
- **Bun** v1.2.0+ (`curl -fsSL https://bun.sh/install | bash`)
- **Python 3** and standard C/C++ build tools (`xcode-select --install` on macOS, `build-essential` on Linux) for `better-sqlite3` native compilation

### Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/edgarasb-dev/lumi-browser.git
cd lumi-browser

# 2. Install dependencies and rebuild native modules
bun install

# 3. Launch in development mode
bun dev
```

### Useful Scripts

| Command               | Description                                                        |
| :-------------------- | :----------------------------------------------------------------- |
| `bun dev`             | Run Electron + Vite development instance with hot reload           |
| `bun dev:watch`       | Run development instance with active file watcher                  |
| `bun run format`      | Format source files and Markdown with Prettier                     |
| `bun run lint`        | Run ESLint across the repository                                   |
| `bun run typecheck`   | Run TypeScript typechecking for main, preload, and renderer        |
| `bun run build:quick` | Build production assets and package a local unpacked `.app` bundle |

---

<a id="open-source-heritage"></a>

## Open Source Heritage

Lumi Browser is an open-source project proudly forked from [Flow Browser](https://github.com/multiboxlabs/flow-browser), originally created by **iamEvan** and the **multiboxlabs** team.

We also express deep gratitude to [Samuel Maddock](https://github.com/samuelmaddock) for [electron-browser-shell](https://github.com/samuelmaddock/electron-browser-shell), as well as the ergonomic ideas pioneered by [Arc](https://arc.net) and [Zen Browser](https://zen-browser.app/).

In compliance with the **GNU General Public License v3.0 (GPLv3)**:

- Lumi is, and will always remain, free and open-source software.
- All original copyright notices, license headers, and contributor attributions are preserved.

---

<a id="license"></a>

## License

This project is licensed under the [GNU General Public License v3.0](./LICENSE).
