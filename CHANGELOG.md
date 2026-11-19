# Changelog

All notable changes to **Lumi Browser** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.5] — 2026-11-19

### Codename: Spark

### Added

- **Split View & Glance Tab Groups**:
  - Added `SplitTabGroup` (`horizontal` side-by-side and `vertical` top/bottom split panes) with interactive draggable divider, double-click 50/50 reset, Swap Panes, Orientation toggle, Unsplit actions, `Cmd+Shift+\` shortcut, and persisted SQLite layout (`split_direction`, `split_ratio`).
  - Enhanced `GlanceTabGroup` with `"Open Link in Glance"` / `"Open Link in Split View"` page context menus, sidebar/topbar quick promote & dismiss controls, and click-outside backdrop dismissal.
- **Reader Mode**:
  - Added Readability-style DOM article extractor & allowlisted double-sanitized `<ReaderView />` overlay inside `BrowserContent` (compatible with normal, Glance, and per-pane Split View), hiding `WebContentsView` cleanly while preserving scroll state.
  - Added Light / Sepia / Dark themes, Serif / Sans / Mono typography, font size / line-height / width controls, address bar `ReaderButton`, View menu action, and `Cmd+Option+R` shortcut.
- **Native Download Manager & `lumi://downloads`**:
  - Hooked `will-download` across default & profile sessions with SQLite persistence (`downloads` table), real-time smoothed speed calculation, progress-ring popover in sidebar & topbar, Pause/Resume/Cancel/Retry/Open/Show in Finder controls, toast completion notifications, and dedicated `lumi://downloads` internal page.
- **Pinned Tabs Completion & Omnibox Pedals**:
  - Unified Pinned Tabs shortcuts (`Cmd+Shift+P`), View/Tab menu items, and `"Pin Tab"` context menu action.
  - Added `open_downloads` (`lumi://downloads`) and `clear_browsing_data` (`lumi://history?clear=1`) omnibox pedals.
- **SHA-512 Ad-Hoc macOS Self-Updater**:
  - Implemented SHA-512-verified `.zip` streaming download and `/usr/bin/ditto` atomic bundle swap self-updater for ad-hoc macOS builds in `/Applications` / `~/Applications` with App Translocation & permission guards and manual GitHub Releases fallback, plus merged arm64/x64 `latest-mac.yml` publishing in CI.
- **Safari Connectivity & External Sync**:
  - **macOS Safari Bridge**: Non-intrusive open-tab discovery via JXA, `"Open in Safari"` tab context menu action, `Bookmarks.plist` and Netscape HTML import, Reading List extraction, read-only `History.db` import, and optional live open-tab sync.
  - **iCloud Drive Encrypted Sync**: AES-256-GCM + PBKDF2-SHA256 encrypted snapshots stored in iCloud Drive (or custom sync folder) with OS keychain passphrase storage (`safeStorage`) and an `inbox/` watcher for Apple iOS Shortcuts.
  - **Local Wi-Fi & Bonjour Companion Server**: Embedded HTTP + RFC 6455 WebSocket companion server with rate-limited 6-digit pairing, QR code onboarding, and macOS Bonjour advertisement (`_lumi-sync._tcp`).
  - **UI & Onboarding**: Added **Settings → Safari & Sync** and a macOS-only **Import from Safari** onboarding step with deferred tab opening.

### Changed

- **Native Liquid Glass Icon Simplification**: Standardized exclusively on Lumi's native macOS Liquid Glass icon (`Assets.car`) and default Lumi icon across platforms.
- **Documentation & Roadmap**: Audited remaining legacy Flow references across code and docs, updated README and Flathub screenshots, and completed all 23/23 items in `UPCOMING_FEATURES.md`.

### Removed

- Removed legacy Flow app icon sets, custom icon switcher UI in Settings and Onboarding, `lumi.icons` preload/IPC endpoints, `DockTilePlugIn.plugin` packaging hooks, and unused agent/design files.

---

## [0.1.2] — 2026-10-16

### Codename: Spark

### 🚀 Highlights

- **Zero-Alias Rebranding**: Complete eradication of legacy "Flow" protocols and aliases across the entire codebase, achieving a 100% pure native "Lumi" architecture.

### Added

- Native Linux desktop metadata and AppStream specification: `dev.lumi.browser.desktop`, `dev.lumi.browser.metainfo.xml`, and `dev.lumi.browser.png`.
- Pure `window.lumi` global API typing and direct exposure via Electron's context bridge.
- Native `Lumi*API` shared TypeScript interface definitions under `src/shared/lumi/interfaces/`.
- Conditional ARC-safe deallocation in `LumiDockTilePlugin.m` to eliminate static analyzer warnings in non-ARC IDE modes.

### Changed

- **Protocol Schemes**: Migrated all internal browser protocols from `flow://`, `flow-internal://`, and `flow-external://` to `lumi://`, `lumi-internal://`, and `lumi-external://`.
- **Preload & Renderer**: Migrated 70+ renderer components, hooks, and providers from `flow.<prop>` to direct `lumi.<prop>` calls.
- **Shared Paths & Imports**: Migrated all shared type imports from `~/flow/` to `~/lumi/`.
- **Settings & Directories**:
  - Renamed internal PDF viewer setting ID from `enableFlowPdfViewer` to `enableLumiPdfViewer`.
  - Consolidated data directory references into `LUMI_DATA_DIR`.
  - Updated default browser registration command lines on Linux and Windows (`APP_NAME_SHORT = "lumi"`).
- **macOS DockTile Plugin**: Renamed to `LumiDockTilePlugin` with bundle identifier `dev.lumi.browser.DockTilePlugin`.

### Removed

- Removed legacy `window.flow` and `flow.*` alias bindings from preload.
- Removed deprecated `src/shared/flow/` directory and alias shim `src/shared/lumi/flow.ts`.
- Removed legacy `flow:` scheme registrations and transformations from URL handlers.
- Removed legacy `com.flow_browser.flow.*` compatibility symlinks.

---

## [0.1.1] — 2026-10-14

### Codename: Spark

### Added

- **Multi-Layered macOS Liquid Glass Icon Architecture**:
  - Native Objective-C DockTile plugin (`DockTilePlugIn.plugin`) for displaying dynamic custom icons when the browser is inactive or closed.
  - Support for custom spaces/profile dock icons with live notification dispatching via `NSDistributedNotificationCenter`.
- **Packaging & CI/CD**:
  - Multi-platform DMG background rendering and asset positioning.
  - Release workflows for macOS and Linux packaging.
- **Auto-Updater Hardening**:
  - Configured auto-updater with comprehensive error handling and UI status indicators in Settings.

---

## [0.1.0] — 2026-10-12

### Codename: Spark

### Added

- **Initial Fork & Rebranding**: Forked from Flow Browser by iamEvan / multiboxlabs, rebranded to Lumi Browser under GNU GPLv3.
- **Layout Architecture**: Horizontal topbar vs vertical collapsible sidebar navigation switcher.
- **Spaces & Personalization**: Space scratchpad, notes, and custom background gradient / color theme popovers.
- **Tab Multitasking**:
  - Live tab hover cards and thumbnail previews.
  - Tab reordering via drag-and-drop and keyboard shortcuts.
  - Collapsible tab groups and folder organization.
  - Tab auto-snooze and memory management.
- **Navigation & Privacy**:
  - Centralized Command Palette (`Cmd + K`) for instant tab, history, and action navigation.
  - Adblock shield with live blocked tracker counters and domain whitelist toggle.
  - Custom search engine manager with keyword shortcuts and preset providers.
