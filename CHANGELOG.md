# Changelog

All notable changes to **Lumi Browser** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.4] — 2026-11-22

### Codename: Prism

### Fixed

- **macOS Unentitled Passkey Sign-In Hang Fix**: Added `WebauthnSupportMode` (`"macos-native" | "chromium" | "unsupported"`) and `"webauthn:get-support-mode"` IPC in `src/main/ipc/webauthn/index.ts` and `src/preload/webauthn/index.ts`. Unentitled macOS builds without native `electron-webauthn` report `false` for `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`, `isConditionalMediationAvailable()`, and passkey `getClientCapabilities()` flags, and reject `navigator.credentials.create()` / `.get()` (`publicKey`) immediately with `NotSupportedError` (or `AbortError` if aborted) instead of hanging indefinitely in Chromium's UI-less WebAuthn stub, allowing sites like Google to fall back smoothly to password/2FA flows.
- **Unified Sidebar Bottom Dock & Topbar Action Styling**: Replaced mixed `<Button>` wrappers and mismatched `size-3.5`/opacity overrides across `BottomDock`, `BottomExtrasMenu`, `DownloadsButton`, `RecentlyClosedPopover`, `SpaceScratchpad`, and `SpaceSwitcher` with shared `DOCK_BUTTON_CLASSES`, `DOCK_ICON_STROKE_WIDTH`, and `getDockButtonClassName` tokens (`size-7 rounded-lg` / `xs: size-6 rounded-md`). Kept `SpaceSwitcher` and all five dock action buttons integrated on one cohesive row down through default `200px` sidebar width (with CSS `order-*` balanced two-row wrapping only at narrower widths without unmounting open popovers), and matched `TopbarLayout` tool buttons to the same `size="sm"` styling.

### Added

- **Pinned Tab Unread Count Badges**: Added W3C App Badging API interception (`tryPatchAppBadge()` -> `"tabs:set-badge-count"` -> `Tab.badgeCount` persisted in tab serialization) alongside title-based unread parsing (`getTabUnreadCount()`, `formatUnreadCount()` in `src/renderer/src/lib/unread-badge.ts` supporting Gmail, mail/chat title patterns, and `99+` formatting) and a shared `usePinnedTabPresentation` + `<PinnedTabBadge />` Liquid Glass pill on pinned tabs.
- **Pinned Tabs in Horizontal Topbar & Right-Click Layout Switcher**: Added `TopbarPinnedTab` with live favicons, unread badge pills, click/double-click actions, and native pinned-tab context menus in `TopbarLayout`, and added `interface:show-navigation-layout-menu` with `useWindowDrag()` + `handleChromeBarContextMenu()` so right-clicking empty chrome in either the Vertical Sidebar or Horizontal Top Bar opens a native menu with `New Tab`, `Vertical Sidebar` / `Horizontal Top Bar` switching, and sidebar left/right placement.

---

## [0.4.3] — 2026-11-22

### Codename: Prism

### Fixed

- **Start Page & Session Restore Active Tab on Browser Open**: Fixed Lumi opening to a blank screen both on fresh/empty spaces and when restoring saved sessions. Added `waitForInitialWindowStartup()` gating on `tabs:get-data`, updated `restoreSession()` and `TabsController.restoreActiveTab()` to restore the most recently active tab or group per window and space (waking only the visible space while keeping inactive spaces asleep), and updated `AutoNewTab` to wait for `tabsData` and `currentSpace` instead of a 100ms timer and open the Start Page (`lumi://new-tab`) foreground tab whenever a normal window or space has no active tab (rather than popping only the Command Palette over an empty void under the default `newTabMode = "omnibox"` setting).

### Improved

- **Automatic Background & Focus Update Checks + Topbar Update Pill**: Added an `isChecking` re-entrancy guard in `AutoUpdateController`, shortened background update polling from 15 minutes to 5 minutes, added automatic `browser-window-focus` update checks (with a 2-minute cooldown when no download/install is active), and added a one-click `Update` / `Downloading...` / `Install Update` status pill to the Horizontal Topbar layout.
- **CPU, RAM & GPU Memory Footprint Optimizations**: Enabled `PartitionAllocMemoryReclaimer`, `MemorySaverModeRenderTuning`, and `MacAllowBackgroundingRenderProcesses` Chromium features, lowered `MAX_AWAKE_BACKGROUND_TABS` from 12 to 6, allowed idle background pinned tabs to sleep cleanly while still exempting them from auto-archival, enforced `backgroundThrottling: true` when hiding non-audible/non-PiP tabs, reduced SQLite page caches (`lumi.db` from 64 MB / 256 MB mmap to 8 MB / 32 MB mmap + `shrink_memory` after history prune; `favicons.db` from 64 MB to 4 MB), disabled `sharp` 50 MB native cache (`sharp.cache(false)`, `sharp.concurrency(1)`), and made password preload `scroll`/`resize` listeners passive with an early click fast-path.

---

## [0.4.2] — 2026-11-22

### Codename: Prism

### Fixed

- **Browser Importer >180-Day & Null-Timestamp History Diffing (Comet, Opera, Firefox & All Browsers)**: Fixed `importBrowsingHistoryEntries()` and `countNewBrowsingHistoryEntries()` clamping visits older than 180 days to a moving `Date.now() - RETENTION_MS + 1` timestamp (and `chromeTimeToUnixMs` / `prTimeToUnixMs` / `cocoaTimeToUnixMs` returning `Date.now()` for `0`/`NULL` dates), which shifted by $> 1,000\text{ ms}$ one second after import and caused history items from earlier in 2025/2026 (such as Perplexity Comet, Opera, and Firefox) to remain listed as importable. Preserved real historical visit timestamps, extended history retention to 10 years, added automatic cleanup of legacy mass-clamped duplicate visit rows in `pruneBrowsingHistory()`, matched existing `history_urls.lastVisitTime >= visitTime - 1000` in $O(1)$ memory time, deduplicated source search engines and `(origin, username)` password pairs during preview, guarded password/cookie ledger watermarks against cancelled Keychain prompts, and cleared cross-browser preview caches after import.
- **Shift + Left Click Opens New Tab & Popup Window Renderer Fix**: Updated `TabsController.handleNewTabRequested()` so `disposition === "new-window"` without explicit popup window features (`popup`, `width`, `height`, `left`, `top`) opens the link in a new foreground tab in the current window instead of spawning a separate window, and wrapped popup windows (`type === "popup"`) in `PinnedTabsProvider`, `BrowserActionProvider`, and `ExtensionsProviderWithSpaces` so OAuth/login popups with `<PopupToolbar />` render properly instead of crashing with a blank view.
- **Atomic Draft-Until-Ready Release Publishing & Pending Manifest Handling**: Updated `.github/workflows/build-and-release.yml` to keep releases in `--draft` (`EP_DRAFT=true`) without pushing the public Git tag until all four OS runners finish uploading all artifacts and `latest*.yml` manifests, switched `autoUpdater.allowPrerelease` to `false` (`/releases/latest`), and silenced transient manifest `404` checks so Lumi never leaks incoming builds or displays `Update Check Failed` while CI is building.

---

## [0.4.1] — 2026-11-22

### Codename: Prism

### Fixed

- **macOS Liquid Glass Tinted, Clear & Light Dock Icon Border (`Assets.car`)**: Decontaminated the 4-pixel dark background fringe (`rgb(17, 18, 22)`) and reconstructed a smooth sub-pixel anti-aliased alpha contour on `logo-mark.png`, disabled synthetic outer specular rim highlights (`"specular": false`) on the pre-shaded 3D ribbon group in `build/AppIcon.icon/icon.json`, and recompiled `Assets.car`, `icon.icns`, and `AppIcon.appiconset` so Tinted, Clear, and Light macOS Dock modes no longer render a jagged white/black border around the Lumi mark.
- **Diff-Aware Browser Importer Preview & Post-Import State Refresh**: Updated `previewBrowserProfile()` to compare source bookmarks, browsing history, pinned tabs, search engines, saved passwords, and active sessions (cookie watermarks, `Local Storage/leveldb` origin hashes, and `IndexedDB` origin directories) against the target Lumi profile without triggering macOS Keychain prompts during preview. Imported categories now refresh automatically after import completion, uncheck and display `Already imported (<count>)` when up to date, and report `<N> new • <M> imported` when incremental items are added or modified in the source browser.
- **Single-Prompt macOS Keychain Safe Storage Caching**: Added in-memory session caching and concurrent lookup deduplication per Keychain service name in `getChromiumSafeStorageAesKey()` along with a non-prompting service existence check (`security find-generic-password -s <service>` without `-w`) so importing Passwords and Active Sessions together never prompts for the same Keychain service twice.
- **Vertical Sidebar Address Bar Decluttering**: Compacted the vertical sidebar address bar by removing the redundant left `<Lock />` icon (already represented by the Site Controls shield), rendering a compact icon-only Shield trigger at rest, showing the Password Key button only when saved logins exist for the current site, hiding the Extensions puzzle button when no extensions are installed, and revealing inactive Reader/Bookmark actions on address bar hover so the site domain is always readable.
- **Imported & Unvisited Pinned Tab Favicon Auto-Resolution**: Updated pinned tab tiles (`PinnedTabButton` and `PinVisual`) to fall back to `lumi://favicon?url=<defaultUrl>` when `faviconUrl` is null or fails to load, added on-demand `${origin}/favicon.ico` fetching, `sharp` PNG normalization, and `favicons.db` persistence in `getFavicon()`, and added `Access-Control-Allow-Origin: *` on `lumi://favicon` so `useFaviconColors` extracts brand gradient rings without canvas CORS taint.

---

## [0.4.0] — 2026-11-21

### Codename: Prism

### Added

- **OS-Encrypted Password Manager & Touch ID Vault (`lumi://passwords`)**: Built-in per-profile password manager backed by SQLite (`saved_passwords` and `password_never_save_sites`) and Electron OS Keychain / Keyring encryption (`safeStorage` on macOS Keychain, Windows DPAPI, and GNOME Keyring / KWallet—with zero plaintext fallback, refusing writes if no OS keyring is active). Includes macOS Touch ID verification (`systemPreferences.promptTouchID`) before revealing, copying, or exporting passwords, a closed-Shadow-DOM in-page autofill and CSPRNG strong password generator dropdown, a non-intrusive top-right Save/Update prompt, an Address Bar Key popover, `CommandOrControl+Alt+P` shortcut, Settings → Passwords controls, and Chrome-compatible RFC-4180 CSV import/export.
- **Cross-Browser Password & Active Session Migration (Cookies, `localStorage` & `IndexedDB`)**: Extended the Browser Importer in Onboarding and `lumi://settings?section=import` with **Saved Passwords** (decrypting Chromium `v10`/`v11` Safe Storage logins and Firefox/Zen/Waterfox/LibreWolf/Floorp NSS `key4.db` PBES2 AES-256-CBC & 3DES `logins.json` credentials) and **Cookies & Active Sessions** (decrypting Chromium cookies including DB `version >= 24` 32-byte `SHA256(host_key)` prefixes, decoding Chromium `Local Storage/leveldb` Snappy `.ldb` SSTables and `.log` WAL write batches via a pure-TypeScript LevelDB reader, injecting `localStorage` offline via parallel hidden CDP workers without overwriting existing Lumi keys, and copying missing origin `IndexedDB` directories).

### Changed

- **Browsing History Import Limit**: Raised `HISTORY_IMPORT_LIMIT` from `8,000` to `50,000` entries across Chromium, Gecko/Firefox, Safari, and Flow importers.

### Fixed

- **Shield Content Blocker Firestore & Firebase Keepalive Exceptions**: Added `$ping,3p` (`ping`, `beacon`, `xhr`, `subdocument`) exception rules for `firestore.googleapis.com`, `firebase.googleapis.com`, `firebaseio.com`, `identitytoolkit.googleapis.com`, and `securetoken.googleapis.com` so EasyPrivacy's generic third-party `$ping,3p` rule no longer terminates Firestore WebChannel streams while keeping analytics/tracker blocking intact.
- **macOS Passkey Access Entitlement Guard**: Added `hasWebBrowserPasskeyEntitlement()` to check whether the running macOS binary holds Apple's restricted `com.apple.developer.web-browser.public-key-credential` entitlement before loading `electron-webauthn`, avoiding permanent `Passkey access was not allowed` errors on builds without Apple's restricted web-browser entitlement.

---

## [0.3.5] — 2026-11-21

### Codename: Prism

### Fixed

- **macOS Browser Importer Detection & Permission Handling**: Stopped swallowing `EPERM`/`EACCES` errors inside the Chromium, Gecko/Firefox, Safari, and Flow importer scanners (`utils.ts`, `chromium.ts`, `gecko.ts`, `safari.ts`, `flow.ts`) and updated `isFileReadable()` to verify real read access via `fs.open(..., "r")` instead of `fs.stat()` alone so macOS privacy-protected browsers (such as Chrome, Firefox, and Safari) remain visible with an accurate `Locked` state instead of disappearing or reporting `0` items.

### Added

- **One-Click Privacy Settings & Auto-Rescan in Browser Importer**: Added direct macOS System Settings links (`Open Full Disk Access` and `Files & Folders`), automatic silent rescan on window focus when any detected browser needs permission, and permission-aware Onboarding and Settings Import guidance.

---

## [0.3.4] — 2026-11-21

### Codename: Prism

### Fixed

- **MCP Internal Protocol Isolation**: Hardened `isInternalPageUrl()` in the local MCP server to block `lumi://`, `chrome-extension://`, and `file://` pages (alongside `lumi-internal://`, `chrome://`, and `devtools://`) from JavaScript evaluation, DOM snapshots/interaction, Reader extraction, and screenshots so privileged preload APIs (such as `lumi://settings`) cannot be inspected or scripted even when Full Automation + Script Execution is enabled, while preserving outbound `lumi_navigate_tab` navigation from `lumi://new-tab`.

---

## [0.3.3] — 2026-11-21

### Codename: Prism

### Fixed

- **Split View & Glance Tab Teardown Crash**: Fixed `BaseTabGroup.removeTab()` emitting `"changed"` after `SplitTabGroup` or `GlanceTabGroup` destroyed itself inside `"tab-removed"` (which raised `EventEmitter already destroyed!` during `Tab.destroy()` and left closed tabs' views orphaned), and ensured `internalDestroyTabGroup()` updates surviving tab layouts and activates the remaining tab when a group collapses.
- **MCP Split View & Activity Log Details**: Fixed `lumi_open_split_view` waiting for initial pane navigation so both split tabs return populated URLs, and updated the MCP Live Agent Activity feed to display specific error summaries instead of generic `"Returned error"`.

---

## [0.3.2] — 2026-11-21

### Codename: Prism

### Added

- **Native Local MCP Server (`lumi://settings?section=mcp`)**: Opt-in local Model Context Protocol server (`127.0.0.1` loopback Streamable HTTP + `out/main/mcp-stdio.js` stdio bridge for Claude Desktop) exposing 16 scoped tools and 3 resources (`lumi_list_workspaces`, `lumi_list_tabs`, `lumi_read_page`, `lumi_get_page_snapshot`, `lumi_capture_screenshot`, `lumi_search_history`, `lumi_search_bookmarks`, `lumi_open_tab`, `lumi_navigate_tab`, `lumi_activate_tab`, `lumi_close_tab`, `lumi_switch_space`, `lumi_open_split_view`, `lumi_interact_page`, `lumi_add_bookmark`, and gated `lumi_evaluate_js`) with tiered permissions (`Read Only` / `Interactive` / `Full`), profile scoping, constant-time Bearer auth, web origin CSRF rejection, and a live Activity Log.
- **README Animated Motion Previews**: Added animated GIFs showcasing Workspace transitions, Spaces tinting, Layout morphing, Split Side Panel, and the 5-step Onboarding Studio flow.

### Changed

- **Upgraded Onboarding Studio & `motion/react` Animations**: Upgraded onboarding with a living sapphire aurora backdrop, spring-animated step indicator and macOS traffic-light-cleared Back navigation, live Workspace preview on Welcome, unified **Craft Your First Space** studio with real-time chrome preview, interactive Layout morph preview, and personalized Setup Summary launch screen—alongside sliding spring highlights and transitions in Omnibox, New Tab Speed Dial, and Split Side Panel.

---

## [0.3.1] — 2026-11-21

### Codename: Prism

### Added

- **Import from Other Browsers**: Added automatic cross-platform scanning across 37 browsers (`Safari`, `Chrome`, `Firefox`, `Zen Browser`, `Arc`, `Dia`, `Perplexity Comet`, `ChatGPT Atlas`, `Brave`, `Edge`, `Vivaldi`, `Opera`, `Helium`, `Orion`, `Flow Browser`, and more) plus Netscape Bookmarks HTML file import, bringing bookmarks, Reading List, browsing history, pinned tabs (including Arc `StorableSidebar.json`, Zen `zen-sessions.jsonlz4` / `zen_pins`, and Firefox `sessionstore.jsonlz4`), and custom search engines into Lumi via both `lumi://settings?section=import` and the first-run Onboarding flow.

### Changed

- **GitHub Actions CI & Multi-Platform Packaging Speedups**: Parallelized `tsc`, `eslint`, and `prettier --cache` on `checks`, switched CI runners to preinstalled toolcache Node 22+, added Windows Defender + same-drive `D:` caching with `7z`-packed `node_modules`, added macOS `node_modules` caching, configured `gz` `.deb` packaging compression and faster archive compression levels, and gated PR Flatpak runs to relevant packaging/dependency changes.

---

## [0.3.0] — 2026-11-21

### Codename: Prism

### Added

- **Unified Tab Settings (`lumi://settings`)**: Migrated Settings out of its standalone popup window into a first-class internal browser tab (`lumi://settings` and `chrome://settings` alias) with URL deep-linking (`?section=...`), browser Back/Forward history across sections, and `Cmd/Ctrl + ,` / **About Lumi** singleton tab focus-or-open behavior.
- **Spacious Full-Tab Settings Redesign**: Replaced the embedded window titlebar with a sticky breadcrumb header bar and expanded layout grids across General, Appearance, Search Engines, Privacy & External Apps, Shortcuts, Profiles, and a side-by-side Live Preview + Icon Picker workbench inside the Space Editor.

### Changed

- **Renderer Bundle & Protocol Optimizations**: Removed CJS production barrel aliases for `lucide-react` and `@phosphor-icons/react`, introduced cached on-demand duotone SVG serving (`phosphor/<name>`), extracted `SettingsInput` out of full Settings cards, lazy-loaded `bangs` search triggers (`O(1)` Map) with paginated `lumi://bangs`, and scoped `UmamiScriptLoader` to top-level shell windows after idle.
- **Cold Startup, SQLite & File I/O**: Removed artificial `50ms` session/window delays, moved Widevine/ephemeral cleanup/PostHog/auto-updater (`async codesign`) off critical boot, parallelized window tab restoration, cached `DataStore` atomic writes + bulk settings hydration, enabled `lumi.db` memory-mapped I/O with composite history indexes (`drizzle/0007_history_composite_indexes.sql`), and made `favicons.db` lazy with cached prepared statements.
- **Memory & Lifecycle Management**: Set default background tab sleep to `30m` with audible/PiP/active-group exemptions and a `12`-tab awake cap, slimmed the idle portal pool (`MIN_IDLE_PORTALS = 1`, `0` in popups) with inactive overlay unmounting, omitted redundant providers from popup windows, fixed tab/session `WeakMap` and listener leaks, and added Adblocker binary engine disk caching.
- **Zero-Polling IPC & Reactive Rendering**: Switched cursor edge tracking to on-demand states, replaced media mini-player and default-browser intervals with event-driven updates, bounded MV3 service worker backoff, stopped floating sidebar continuous `rAF` loops, coalesced `useBoundingRect` observers via a shared `WeakMap`, and memoized core context providers.
- **GitHub Actions CI & Packaging Speedups**: Merged lint/format checks with ESLint & incremental `tsc` caches, skipped docs-only PR builds, cached Flatpak/fpm/pip/Bun artifacts across workflows, and tightened macOS notarization key handling.

### Fixed

- **macOS About Lumi Menu Action**: Clicking **Lumi → About Lumi** now opens Settings directly to the **About Lumi** section.
- **Responsive Sidebar Bottom Dock**: Fixed button sizing and wrapping when resizing the vertical sidebar ([bottom-dock.tsx](file:///Users/edgarasbareika/Developer/lumi-browser/lumi-browser/src/renderer/src/components/browser-ui/browser-sidebar/_components/bottom/bottom-dock.tsx)).

---

## [0.2.1] — 2026-11-20

### Codename: Glow

### Changed

- **Chromium & Electron Engine Upgrade**: Upgraded `@castlabs/electron-releases` from `v41.1.1+wvcus` (Chromium 146) to `v45.2.1+wvcus` (Chromium `156.0.8078.75`) along with compatible dependency updates (`@ghostery/adblocker-electron`, `better-sqlite3`, `drizzle-orm`, `electron-updater`, `react`, `tailwindcss`, `vite`, `@base-ui/react`, `motion`, and native ABI tooling).
- **macOS Release Targets**: Streamlined macOS CI and release distribution exclusively for Apple Silicon (`arm64`), removing legacy Intel (`x64`) builds.

### Fixed

- **Chrome Web Store & Extension Packaging**: Bundled `chrome-web-store.preload.js` and `chrome-extension-api.preload.js` alongside `out/main/` so packaged releases expose extension APIs properly, and added Chrome `Sec-CH-UA` headers for Chrome Web Store requests (`"Add to Lumi"` works out of the box).
- **Sidebar Popover Drag Sticking (`useWindowDrag`)**: Guarded against synthetic clicks bubbling across `createPortal` boundaries, cleared drag state if the left mouse button is released over a web page or external window (`(e.buttons & 1) === 0`), and reset on blur/pointer-cancel/contextmenu.
- **macOS App Menu Blank Item**: Replaced invalid `{ role: "showAllTabs" }` under the application menu with `{ role: "unhide" }` (`Show All`).

---

## [0.2.0] — 2026-11-20

### Codename: Glow

### Added

- **Unified Site Control Center**: Per-origin page zoom stepping, persisted `Ask / Allow / Block` site permissions (Camera, Microphone, Location, Notifications, Clipboard, MIDI, Serial), Ghostery blocker telemetry & whitelist toggle, **Smart Night Shade** dynamic dark CSS injection, and quick site storage cleanup.
- **Omnibox Superpowers**: Inline math evaluator, CSS & physical unit converter, `#hex` / `rgb` / `hsl` live color swatches, timezone converter, QR code sharing card, and dynamic workspace command pedals (`open_bangs`, `toggle_zen_mode`, `toggle_side_panel`, `capture_region`, `capture_full_page`, `recently_closed`, `save_snapshot`).
- **Live Media Mini-Player & Universal PiP**: Real-time background audio playback controls and Picture-in-Picture toggle across tabs.
- **Focus / Zen Mode, Workspace Snapshots & Recently Closed**: `⌘⇧Z` distraction-free Zen chrome mode with floating Pomodoro timer pill and optional Focus distraction blocklist, SQLite-backed `workspace_snapshots` save/restore (`drizzle/0006_snapshots_and_widgets.sql`), and a unified Recently Closed Tabs popover.
- **Persistent Split Side Panel & Page Capture**: `⌘⇧.` resizable right panel (`side-panel-controller.ts`) with Markdown checklist Scratchpad v2 and live Companion `WebContentsView`, plus `⌘⇧2` built-in Page Capture (`sharp`-stitched full scrolling, visible viewport, or region crop with Canvas annotations, clipboard copy, and PNG export).
- **Global Settings Search (`⌘F`) & Appearance Controls**: Instant fuzzy cross-section search with row jump/highlight, wireframe layout pickers, and live mini-Lumi theme previews for Spaces & Profiles.

### Changed

- **Native Liquid Glass UI Overhaul**: Unified macOS `under-window` / `popover` vibrancy and Lumi Sapphire accent palette across Settings, Browser Sidebar/Topbar/Address Bar, Command Palette, Modular New Tab v2 (Studio Wallpapers & widgets), First-Run Onboarding, and `lumi://*` internal routes (`about`, `bangs`, `downloads`, `extensions`, `games`, `history`, `error`).
- **CI Performance & Node 24 Readiness**: Added Bun/Electron dependency caching across GitHub Actions workflows and upgraded actions to Node 24-compatible versions.
- **Documentation**: Rebuilt `README.md` with updated Retina screenshots, showcase gallery grids, keyboard shortcuts reference, and `lumi://*` index.

### Fixed

- **macOS Dock Activation & Settings Z-Order**: Tracked MRU `focusOrder` in `WindowsController` and updated `app.on("activate")` so clicking Lumi's Dock icon raises `SettingsWindow` above browser windows whenever it is open, alongside persistent window bounds and `⌘W` support.

### Removed

- **Safari Sync**: Removed Safari Bridge, iCloud Drive encrypted sync, Local Wi-Fi / Bonjour companion server, and associated Settings/Onboarding screens per user feedback.

---

## [0.1.7] — 2026-11-19

### Codename: Spark

### Fixed

- **macOS Full Disk Access Registration & UX**: Replaced `access()`/`existsSync()` early returns in Safari Sync with direct main-process `open()` / `readdir()` probes (`probeSafariFullDiskAccess`) and added a **Reveal Lumi.app** button plus clearer guidance in Settings and Onboarding.
- **Release Publishing & Updater Messaging**: Updated `build-and-release.yml` to create releases as drafts until all platform builds and `latest-mac.yml` finish uploading, and improved `UpdateCard` 404 messaging during release builds.

---

## [0.1.6] — 2026-11-19

### Codename: Spark

### Fixed

- Fixed a startup circular-import initialization crash in bundled production builds caused by `src/main/ipc/browser/pinned-tabs.ts` being imported from `tabs.ts` and `menu/items/tabs.ts` before `tabsController` had finished constructing, by extracting shared pinned-tab helpers into `src/main/controllers/pinned-tabs-controller/actions.ts`.

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
