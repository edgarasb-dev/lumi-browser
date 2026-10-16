# Changelog

All notable changes to **Lumi Browser** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
