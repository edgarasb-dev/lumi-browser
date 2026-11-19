# Lumi Browser — Feature Roadmap & Archive

A comprehensive overview of planned upcoming features and completed engineering milestones for **Lumi Browser**.

---

## 📊 Roadmap Summary

| Category                          | Completed | In Progress | Planned | Total  |
| :-------------------------------- | :-------: | :---------: | :-----: | :----: |
| **Tab Management & Multitasking** |     7     |      0      |    0    |   7    |
| **Navigation, History & Search**  |     5     |      0      |    0    |   5    |
| **Spaces & Personalization**      |     3     |      0      |    0    |   3    |
| **Native Platform & Performance** |     3     |      0      |    0    |   3    |
| **Privacy, Media & Ecosystem**    |     3     |      0      |    0    |   3    |
| **Brand & Open-Source Identity**  |     2     |      0      |    0    |   2    |
| **Total**                         |  **23**   |    **0**    |  **0**  | **23** |

---

## 🗺️ Upcoming Features Roadmap (Live Progress)

| Feature                                          | Category            | Difficulty             | Estimated Effort | Status  |
| :----------------------------------------------- | :------------------ | :--------------------- | :--------------- | :------ |
| **Pinned Tabs in Spaces**                        | Tab Management      | 🟡 Moderate (3.5/5)    | 4–5 hours        | ✅ Done |
| **Split View & Glance Tab Groups**               | Tab Management      | 🟠 Moderate–Hard (4/5) | 6–8 hours        | ✅ Done |
| **Reader Mode**                                  | Tab Management      | 🟡 Moderate (3/5)      | 3–5 hours        | ✅ Done |
| **Next-Gen Omnibox & Zero Suggest**              | Navigation & Search | 🟡 Moderate (3/5)      | 3–5 hours        | ✅ Done |
| **Chromium-Inspired History & `lumi://history`** | Navigation & Search | 🟡 Moderate (3/5)      | 4–6 hours        | ✅ Done |
| **Declarative Page Bounds Engine**               | Native Platform     | 🟡 Moderate (2.5/5)    | 2–3 hours        | ✅ Done |
| **Native Download Manager**                      | Media & Files       | 🟠 Moderate–Hard (4/5) | 5–7 hours        | ✅ Done |

---

## ✅ Completed Milestones

| Feature                                          | Category            | Difficulty             | Shipped Version |
| :----------------------------------------------- | :------------------ | :--------------------- | :-------------- |
| **Custom Search Engines & Presets**              | Search & Tools      | 🟢 Easy (1/5)          | v0.1.0          |
| **Preview Tabs & Hover Cards**                   | Tab Management      | 🟢 Easy (1.5/5)        | v0.1.0          |
| **Space Scratchpad & Quick Notes**               | Spaces & Notes      | 🟢 Easy (1.5/5)        | v0.1.0          |
| **Reorder Tabs (Shortcuts & Menus)**             | Tab Management      | 🟡 Easy–Moderate (2/5) | v0.1.0          |
| **Space Themes & Custom Colors**                 | Spaces & UI         | 🟢 Easy–Moderate (2/5) | v0.1.0          |
| **Adblock Shield & Privacy Counter**             | Privacy & Tools     | 🟢 Easy–Moderate (2/5) | v0.1.0          |
| **Rebranding to Lumi (Phase 1: Inception)**      | Project Identity    | 🟢 Easy–Moderate (2/5) | v0.1.0          |
| **Command Palette (`Cmd + K`)**                  | Search & Tools      | 🟡 Moderate (2.5/5)    | v0.1.0          |
| **Tab Snooze & Memory Auto-Archive**             | Tab Management      | 🟡 Moderate (2.5/5)    | v0.1.0          |
| **Favourites & Quick Bookmarks**                 | Navigation          | 🟡 Moderate (3/5)      | v0.1.0          |
| **Collapsible Tab Groups / Folders**             | Tab Management      | 🟡 Moderate (3/5)      | v0.1.0          |
| **Horizontal Topbar vs Vertical Sidebar**        | Layout & Navigation | 🔴 Hard (4.5/5)        | v0.1.0          |
| **Multi-Platform DMG & Release CI**              | Packaging & DevOps  | 🟡 Moderate (3/5)      | v0.1.1          |
| **macOS Liquid Glass Icon**                      | Native Platform     | 🟡 Moderate (3/5)      | v0.1.1          |
| **Rebranding Phase 2: Complete Flow Removal**    | Project Identity    | 🟡 Moderate (3/5)      | v0.1.2          |
| **Safari Connectivity & External Sync**          | Ecosystem           | 🔴 Very Hard (5/5)     | v0.1.5          |
| **Chromium-Inspired History & `lumi://history`** | Navigation & Search | 🟡 Moderate (3/5)      | v0.1.5          |
| **Declarative Page Bounds Engine**               | Native Platform     | 🟡 Moderate (2.5/5)    | v0.1.5          |
| **Pinned Tabs in Spaces**                        | Tab Management      | 🟡 Moderate (3.5/5)    | v0.1.5          |
| **Split View & Glance Tab Groups**               | Tab Management      | 🟠 Moderate–Hard (4/5) | v0.1.5          |
| **Reader Mode**                                  | Tab Management      | 🟡 Moderate (3/5)      | v0.1.5          |
| **Next-Gen Omnibox & Zero Suggest**              | Navigation & Search | 🟡 Moderate (3/5)      | v0.1.5          |
| **Native Download Manager**                      | Media & Files       | 🟠 Moderate–Hard (4/5) | v0.1.5          |

---

# Part 1: Planned Features & Specifications

Organized by functional domain.

---

## Domain 1: Tab Architecture & Advanced Multitasking

### 1. ✅ Pinned Tabs in Spaces

- **Description:** Allow tabs to be pinned specifically per space, sitting as an anchored top grid in that space.
- **Difficulty:** 🟡 Moderate (3.5/5)
- **Status:** [x] Done (Finalized in v0.1.5)
- **How we will do it:**
  - [x] **Storage & Schema:** SQLite `pinned_tabs` table + `pinnedTabsController` scoped to `profileId` with per-space ephemeral associations.
  - [x] **Sidebar Layout:** `PinGrid` anchored at top of `browser-sidebar`, plus normal scrollable tab list below.
  - [x] **Interactions:** Drag-and-drop between Pinned and Normal zones, right-click context menu ("Pin Tab"), and dedicated shortcut (`Cmd + Shift + P` via `tab.togglePin`).

---

### 2. ✅ Split View & Glance Multi-Tab Groups

- **Source Document:** [`design/TAB_REWRITE_PLAN.md`](design/TAB_REWRITE_PLAN.md) & [`design/LAYERING_SYSTEM.md`](design/LAYERING_SYSTEM.md)
- **Description:** Advanced multitasking tab layouts enabling side-by-side split browsing and peek-and-glance overlay tabs within a single window and space.
- **Difficulty:** 🟠 Moderate to Hard (4/5)
- **Status:** [x] Done (Completed in v0.1.5)
- **How we did it:**
  - **Glance Mode (`GlanceTabGroup`):**
    - [x] Float a secondary preview/reference tab (`ViewLayer.TAB`) over the primary active tab (`ViewLayer.TAB_BACK`).
    - [x] Page link & tab context menu triggers ("Open Link in Glance"), sidebar/topbar quick promote & dismiss controls, and clickable outer backdrop in `BrowserContent`.
  - **Split View (`SplitTabGroup`):**
    - [x] Side-by-side (`horizontal`) and top/bottom (`vertical`) multi-pane `WebContentsView` layout within `TabLayoutManager` with an 8px gap.
    - [x] Interactive draggable splitter divider in `BrowserContent` with double-click reset, Swap Panes, Rotate Split Orientation, Unsplit, and shortcut (`Cmd + Shift + \`).
    - [x] Persisted `splitDirection` and `splitRatio` in `PersistedTabGroupData` + SQLite (`drizzle/0004_split_view_tab_groups.sql`).

---

### 3. ✅ Reader Mode

- **Description:** Clean, distraction-free reading view for articles, blogs, and news pages with font and theme options.
- **Difficulty:** 🟡 Moderate (3/5)
- **Status:** [x] Done (Completed in v0.1.5)
- **How we did it:**
  - [x] Distill clean article content via Readability-style DOM scoring & allowlisted HTML sanitization in [`reader-mode.ts`](src/main/modules/reader-mode.ts) + double-sanitized renderer rendering.
  - [x] Synchronize `tab.readerMode` across `TabLayoutManager` (hiding the underlying `WebContentsView` layer cleanly while preserving scroll & navigation state) and per-pane `BrowserContent` `<ReaderView />`.
  - [x] Added Light / Sepia / Dark themes, Serif / Sans / Mono fonts, font size, line height, max width controls persisted via datastore, address bar `ReaderButton`, View menu item, and `Cmd + Option + R` shortcut.

---

## Domain 2: Navigation, History & Search Intelligence

### 4. ✅ Next-Gen Omnibox Pipeline & Zero Suggest

- **Source Document:** [`src/renderer/src/lib/omnibox-new/README.md`](src/renderer/src/lib/omnibox-new/README.md) & [`docs/references/omnibox.md`](docs/references/omnibox.md)
- **Description:** High-performance omnibox autocomplete architecture featuring single-frame synchronous suggestion batching, empty-input Zero Suggest, and frecency ranking.
- **Difficulty:** 🟡 Moderate (3/5)
- **Status:** [x] Done (Completed in v0.1.5)
- **How we did it:**
  - [x] **Synchronous vs Asynchronous Suggestion Pipeline:** Single-frame synchronous flush (`Verbatim`, `Quick History`, `Open Tabs`, `Pedals`) + debounced asynchronous search suggestions.
  - [x] **Zero Suggest:** Empty-input open tabs and top frecency history suggestions.
  - [x] **Action Pedals:** Quick omnibox jump commands (`Settings`, `History`, `Downloads`, `Clear Browsing Data`, `New Window`, `Incognito Window`, `Extensions`) in `pedals.ts`, `pedal-glyph.tsx`, and `omnibox/main.tsx`.
  - [x] **Frecency Ranking:** Match quality combined with typed/visit frequency and exponential time decay.

---

### 5. ✅ Chromium-Inspired Browsing History & `lumi://history`

- **Source Document:** [`design/chromium-inspired-browsing-history.md`](design/chromium-inspired-browsing-history.md)
- **Status:** [x] Done (Verified in v0.1.5)
- **Description:** Complete browser history persistence and dedicated internal page (`lumi://history`) modeled after Chromium's dual-table visit architecture, with automatic retention pruning, day grouping, and search filtering.
- **Difficulty:** 🟡 Moderate (3/5)
- **How it was implemented:**
  - **SQLite Dual-Table Model (`saving/db/schema.ts`):** `history_urls` + `history_visits` with cascading foreign keys and per-profile scoping.
  - **Typed Count & Address Bar Scoring (`saving/history/browsing-history.ts`):** Distinguishes `typedFromAddressBar` navigations for omnibox ranking.
  - **Retention Pruning (`pruneBrowsingHistory`):** Purges old visits and reconciles URL aggregate counts on startup.
  - **Dedicated `lumi://history` Page (`routes/history/page.tsx`):** Day-by-day grouping, debounced search filtering, copy link, open in new tab, single/site delete, and Clear History dialog.

---

## Domain 3: Native Platform Polish & Performance

### 6. ✅ Declarative Page Bounds Engine

- **Source Document:** [`design/DECLARATIVE_PAGE_BOUNDS.md`](design/DECLARATIVE_PAGE_BOUNDS.md)
- **Status:** [x] Done (Verified in v0.1.5)
- **Description:** Arithmetic zero-latency layout synchronization between the renderer and Electron main process, eliminating DOM reflows and sidebar tween gaps.
- **Difficulty:** 🟡 Moderate (2.5/5)
- **How it was implemented:**
  - **Parameter Broadcast (`browser-content.tsx`):** Computes `PageLayoutParams` (`sidebarWidth`, `topbarHeight`, `sidebarVisible`, `contentTopOffset`) in `useLayoutEffect` and dispatches via `lumi.page.setLayoutParams`.
  - **Main Process Bounds Calculation (`windows-controller/types/browser.ts`, `tabs-controller/bounds.ts`):** Arithmetically computes exact `WebContentsView` bounds with spring interpolation and zero layout reflows.

---

## Domain 4: Media, File Management & Ecosystem

### 7. ✅ Native Download Manager

- **Description:** Full file download manager for files downloaded from the web with real-time speed, progress rings, and historical tracking.
- **Difficulty:** 🟠 Moderate to Hard (4/5)
- **Status:** [x] Done (Completed in v0.1.5)
- **How we did it:**
  - [x] Hooked Electron session `will-download` across `defaultSession` and profile sessions in [`downloads-controller/index.ts`](src/main/controllers/downloads-controller/index.ts).
  - [x] Persisted download history in SQLite `downloads` table (`drizzle/0005_native_downloads.sql`) alongside real-time `receivedBytes`, `totalBytes`, smoothed `speedBytesPerSec`, and state tracking.
  - [x] Built `DownloadsProvider`, `DownloadsButton` progress ring + popover (`Pause`, `Resume`, `Cancel`, `Retry`, `Open`, `Show in Finder`, `Clear`), `BottomExtrasMenu` entry, `lumi://downloads` internal manager page (`routes/downloads/page.tsx`), and toast completion alerts (`MinimalToastProvider` & `sonner`).

---

# Part 2: Completed Milestones Archive

Detailed records of delivered features organized by domain.

---

## Domain 1: Layout & Core Navigation

### ✅ Horizontal Topbar vs Vertical Sidebar

- **Difficulty:** 🔴 Hard (4.5/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - **Setting & Persistence (`basic-settings.ts`):** Registered `navigationLayout` setting (`"sidebar"` | `"topbar"`) under **Settings → General → Layout & Navigation**.
  - **Dynamic Layout Offset:** When in Topbar mode, `hasSidebar` is dynamically set to `false`, eliminating empty sidebar offsets in both React layout and Electron main-process `PageLayoutParams` bounds.
  - **Frosted Glass Horizontal Chrome (`topbar/index.tsx`):**
    - Top row features macOS traffic lights, Space switcher capsule, horizontal tab strip with hover previews (`TabPreviewCard`), audio/mute controls, sleep indicators, new tab button, and 1-click layout toggle back to sidebar.
    - Bottom row integrates native navigation controls, address bar with omnibox dropdown support, quick scratchpad, and extras menu.
    - Web page content is cleanly framed as a floating card with Lumi's signature margins.

---

### ✅ Reorder Tabs (Shortcuts & Menus)

- **Difficulty:** 🟡 Easy to Moderate (2/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - **Context Menu Actions (`ipc/browser/tabs.ts`):** Added "Move Tab Up" and "Move Tab Down" with automated position normalization to prevent drift, "Duplicate Tab", and an interactive "Move to Space" submenu listing all target spaces for seamless cross-space organization.
  - **Keyboard Navigation (`SpaceContentPage` in `space-pages-carousel.tsx`):** Added `Cmd + Option + Up` and `Cmd + Option + Down` (`Ctrl + Alt + Up/Down`) shortcuts that immediately nudge the active tab up or down with zero lag.
  - **Spring Layout Animations:** Fully coordinated with `motion/react` layout springs for silky smooth visual position swapping.

---

### ✅ Favourites & Quick Bookmarks

- **Difficulty:** 🟡 Moderate (3/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - **Storage & Engine (`saving/favourites.ts`):** Persistent storage in DataStore (`getDatastore("favourites")`), with URL normalization, UUID generation, duplicate prevention, and event broadcasting.
  - **Main IPC (`ipc/browser/favourites.ts`):** `favourites:get-all`, `favourites:add`, `favourites:remove`, `favourites:is-favourite` handlers, broadcasting updates via `listeners-manager`.
  - **Preload API (`LumiFavouritesAPI`):** Added `lumi.favourites` with full typed async methods and change subscription.
  - **Address Bar Star Button (`FavouriteButton`):** Dynamic Star button in the address bar that shines gold when favorited, toggles on click, and listens to the universal `Cmd + D` shortcut.
  - **Quick Menu Integration:** Added Favourites section to `BottomExtrasMenu` for 1-click opening of bookmarked pages.

---

## Domain 2: Tab Management & Visual Polish

### ✅ Preview Tabs & Hover Cards

- **Difficulty:** 🟢 Easy (1.5/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - Added snapshot capture caching in Main process (`captureTabPreview` and IPC handler `tabs:get-tab-preview`).
  - Added `getTabPreview` API to preload and `LumiTabsAPI`.
  - Built a sleek glassmorphic `TabPreviewCard` component with `motion/react` spring animations.
  - Shows page title, clean domain badge, URL path, live 16:9 thumbnail preview (or domain fallback), audio/mute badges, and sleeping state.
  - Integrated into `SidebarTab` with an optimal 350ms hover delay, smart above/below positioning within the sidebar, and quick actions (Click to switch, Mute, Close).

---

### ✅ Tab Snooze & Memory Auto-Archive

- **Difficulty:** 🟡 Moderate (2.5/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - **Backend IPC (`tabs:snooze-tab`, `tabs:wake-tab`):** Connected IPC endpoints directly to `TabLifecycleManager`'s sleep/wake engine.
  - **Context Menu:** Updated sidebar tab right-click context menu with intuitive "Snooze Tab (Save Memory)" and "Wake Tab" actions.
  - **Sidebar Visual Indicator:** Sleeping tabs display an elegant soft `Zzz` pill badge and muted typography while sleeping to visibly indicate RAM savings.
  - **Preview Card Quick Controls:** Added instant 1-click Snooze/Wake moon button directly on the tab preview card.
  - **Preload API:** Exposed `lumi.tabs.snoozeTab(tabId)` and `lumi.tabs.wakeTab(tabId)`.

---

### ✅ Collapsible Tab Groups / Folders

- **Difficulty:** 🟡 Moderate (3/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - **Folder Header & Pill Badge (`tab-group.tsx`):** Multi-tab groups display an interactive folder header with folder glyph, tab counter badge (`tabs.length`), and animated expand/collapse chevrons.
  - **Accordion Animation:** Connected with `AnimatePresence` and spring height motion; collapsing cleanly hides non-active tabs into the compact folder rail while retaining full drag-and-drop support.
  - **Smart Auto-Expand:** Automatically expands when a tab within the group gains active focus.

---

## Domain 3: Spaces & Personalization

### ✅ Space Themes & Custom Colors

- **Difficulty:** 🟢 Easy to Moderate (2/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - **Quick Theme Popover (`SpaceThemePopover`):** Built a sleek glassmorphic popover with live gradient preview banner, space name inline editing, 10 curated designer gradient presets (Sunset Flame, Aurora Emerald, Deep Ocean, Electric Violet, Midnight Indigo, etc.), and custom HTML hex color pickers.
  - **Harmonic Random Generator:** Added a smart "Randomize" generator calculating complementary and adjacent HSL hues for instant aesthetic themes.
  - **Phosphor Space Icon Picker:** Integrated 16 high-utility space icon selectors directly inside the popover.
  - **Ubiquitous Sidebar Access:** Triggerable via right-click on any `SpaceButton` in the bottom space switcher, as well as via a dedicated hover palette action on the `SpaceTitle` header.

---

### ✅ Space Scratchpad / Quick Notes

- **Difficulty:** 🟢 Easy (1.5/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - **Storage & IPC:** Saved per-space markdown content into `getDatastore("space-notes")` keyed by `spaceId`, with `spaces:get-notes` and `spaces:save-notes` IPC handlers.
  - **Preload APIs:** Added `lumi.spaces.getSpaceNotes(spaceId)` and `lumi.spaces.saveSpaceNotes(spaceId, content)`.
  - **Renderer UI (`SpaceScratchpad`):**
    - Integrated notepad trigger icon in the sidebar bottom bar (with active dot badge if notes exist for the current space).
    - Glassmorphic modal editor with automatic debounced auto-save (400ms).
    - Shows live word and character counters (`X words • Y chars`), "Copy all" to clipboard with checkmark confirmation, and 1-click "Clear" action.
    - Seamlessly reactive: switching spaces via `SpaceSwitcher` automatically loads the new space's scratchpad notes.

---

## Domain 4: Privacy, Search & Power Tools

### ✅ Custom Search Engines & Presets

- **Difficulty:** 🟢 Easy (1/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - Added SQLite/DataStore storage in Main process with IPC communication.
  - Built built-in search engine presets (Google, DuckDuckGo, Bing, Brave, Ecosia, Kagi) and support for custom query URLs with `%s`.
  - Integrated with omnibox search URL generator and live suggestion fetchers.
  - Added dedicated Settings section under **Settings → Search**.

---

### ✅ Adblock Shield & Privacy Counter

- **Difficulty:** 🟢 Easy to Moderate (2/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - **Backend (`content-blocker.ts`):**
    - Intercepted `ElectronBlocker` events (`request-blocked`, `request-redirected`) to track blocked count and detailed request items per tab WebContents.
    - Page counters reset automatically on tab navigation to keep page statistics accurate.
    - Wrapped `blocker.onBeforeRequest` and `blocker.onInjectCosmeticFilters` to cleanly bypass network blocking and cosmetic CSS/script injection on whitelisted domains.
    - Persisted user domain whitelist and lifetime blocked count in `DataStore` with debounced sync.
  - **IPC & Preload:**
    - Exposed `lumi.contentBlocker` with `getTabStats`, `toggleDomainWhitelist`, `getWhitelistedDomains`, `isDomainWhitelisted`, `getTotalBlocked`, and live event listeners `onStatsUpdated` / `onWhitelistChanged`.
  - **UI / UX (`AdblockShield`):**
    - Integrated privacy shield indicator into `AddressBar`.
    - Live badge counter for blocked trackers/ads on the active page, emerald shield when protected, amber warning badge when paused.
    - Rich glassmorphic popover featuring domain lock badge, one-click protection toggle switch, "On this page" vs "All-time" stat cards, reload banner prompt, and an expandable list of blocked trackers categorized by resource type (scripts, images, XHR, subframes).

---

### ✅ Command Palette (`Cmd + K`)

- **Difficulty:** 🟡 Moderate (2.5/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **How it was implemented:**
  - **Global Accelerator & WebContents Interception:** Registered `CommandOrControl+K` in application menu shortcuts and in `wc.on("before-input-event")` inside `tab-cycle-shortcuts.ts`, guaranteeing instant opening even when arbitrary web pages have native keyboard focus.
  - **Omnibox Command Mode:** Launches Lumi's centered overlay command launcher with an empty search query, allowing instantaneous jumping to open tabs, browsing history, bookmark navigation, search engine queries, and browser pedals (Settings, New Window, Private Mode, Extensions, History).

---

## Domain 5: Project Identity & Open-Source Attribution

### ✅ Rebranding to Lumi (Phase 1: Inception & Legal Attribution)

- **Description:** Rebranded the browser to **Lumi**, establishing distinct branding, assets, and identity while honoring the original authors under GNU GPLv3.
- **Difficulty:** 🟢 Easy to Moderate (2/5)
- **Status:** [x] Done (Shipped in v0.1.0)
- **Note:** Deep scheme deprecation (`flow://` $\rightarrow$ `lumi://`), Linux packaging renaming, and code namespace migrations were completed under **Rebranding Phase 2**.
- **How it was implemented:**
  - **App Metadata & Packaging:**
    - Update `package.json` (`"name": "lumi-browser"`, `"productName": "Lumi"`).
    - Update `electron-builder.ts` (`appId: "dev.lumi.browser"`, `productName: "Lumi"`, `executableName: "lumi"`).
  - **Visual Identity & Assets:**
    - Design and create modern Lumi application icons (`build/icon.png`, `build/icon.icns`, macOS `AppIcon.icon`).
    - Replace in-app branding text, welcome/onboarding dialogs, and window titles to reference Lumi.
  - **Legal Notices & Attribution (GPLv3 Compliance):**
    - Preserve the root `LICENSE` (GNU GPLv3).
    - Update `README.md` with clear attribution: _"Lumi is an open-source browser forked from Flow Browser by iamEvan / multiboxlabs, licensed under the GNU General Public License v3.0"_.
    - Add an "About Lumi" dialog with explicit attribution, copyright preservation, and links back to the original Flow repository.

---

### ✅ Rebranding Phase 2: Complete Flow Removal & Zero-Alias Migration

- **Description:** Complete eradication of legacy "Flow" protocols, aliases, and code identifiers throughout the entire application, migrating to a pure, native "Lumi" architecture with zero alias indirection.
- **Difficulty:** 🟡 Moderate (3/5)
- **Status:** [x] Done (Shipped in v0.1.2)
- **How it was implemented:**
  - **1. Protocol Schemes (`lumi://`, `lumi-internal://`, `lumi-external://`):**
    - Removed `flow`, `flow-internal`, and `flow-external` from Electron privileged scheme registrations and session protocol handlers.
    - Renamed protocol handlers directory from `src/main/controllers/sessions-controller/protocols/_protocols/flow*` to `lumi*` and functions to `registerLumiProtocol`, `registerLumiInternalProtocol`, and `registerLumiExternalProtocol`.
    - Updated all internal routes (`lumi://settings`, `lumi://history`, `lumi://new-tab`, `lumi://extensions`, `lumi://error`, `lumi://pdf-viewer`, `lumi-internal://tab-snapshot`, `lumi-internal://active-favicon`, `lumi://pdf-cache`, `lumi://extension-icon`).
    - Updated URL normalization, whitelist matching, and display URL transformations in `src/renderer/src/lib/url.ts`.
  - **2. Full Removal of Aliases (`window.lumi` Exclusivity):**
    - Completely removed `window.flow` and `flow.*` aliases from preload script (`contextBridge.exposeInMainWorld`).
    - Migrated all frontend providers, hooks, and components across 70+ files in `src/renderer/src` to call `lumi.*` directly (`lumi.tabs`, `lumi.browser`, `lumi.spaces`, `lumi.settings`, `lumi.omnibox`, etc.).
  - **3. Shared Type & Interface Migration:**
    - Replaced `src/shared/flow/` directory with `src/shared/lumi/` and updated all TypeScript path imports across the codebase (`~/flow/` $\rightarrow$ `~/lumi/`).
    - Renamed all IPC API interfaces from `Flow*API` to `Lumi*API` (`LumiAppAPI`, `LumiBrowserAPI`, `LumiTabsAPI`, etc.).
    - Deleted alias file `src/shared/lumi/flow.ts`.
  - **4. Linux & Packaging Cleanup:**
    - Generated native Linux desktop metadata: `dev.lumi.browser.desktop`, `dev.lumi.browser.metainfo.xml`, and `dev.lumi.browser.png`.
    - Removed legacy `com.flow_browser.flow.*` compatibility symlinks.
    - Updated macOS DockTile plugin to `LumiDockTilePlugin` with bundle identifier `dev.lumi.browser.DockTilePlugin`.
  - **5. Settings & Internal Paths:**
    - Renamed internal setting ID `enableFlowPdfViewer` $\rightarrow$ `enableLumiPdfViewer`.
    - Replaced `FLOW_DATA_DIR` with `LUMI_DATA_DIR` across all data stores, icon caches, database initializers, and profile paths.
    - Updated default browser registration scripts for Linux and Windows (`APP_NAME_SHORT = "lumi"`).

---

## Domain 6: Ecosystem & Cross-Device Sync

### ✅ Safari Connectivity & External Sync

- **Description:** Unified bridge connecting Lumi to macOS Safari, encrypted iCloud Drive snapshots, and iOS/mobile browsers over local Wi-Fi and Bonjour.
- **Difficulty:** 🔴 Very Hard (5/5)
- **Status:** [x] Done (Shipped in v0.1.5)
- **How it was implemented:**
  - **macOS Safari Bridge (`src/main/modules/safari-sync/safari-bridge.ts`):**
    - Non-intrusive Safari open-tab discovery via JXA (`osascript -l JavaScript`) when Safari is running, plus `"Open in Safari"` in the tab right-click context menu.
    - Binary/XML `Bookmarks.plist` parsing via `/usr/bin/plutil`, Netscape HTML bookmark file import fallback, Reading List extraction, and read-only `History.db` snapshot import with CoreData epoch conversion.
    - Flexible target mapping (import into an existing Space, auto-create a `"Safari"` Space, save bookmarks/Reading List to Favourites, and import history into `lumi.db`), plus optional live open-tab polling.
  - **iCloud Drive Encrypted Sync (`src/main/modules/safari-sync/icloud-sync.ts`, `crypto.ts`):**
    - AES-256-GCM + PBKDF2-SHA256 encrypted state snapshots (`devices/<deviceId>.enc.json` and `lumi-sync-state.enc.json`) written to iCloud Drive (`~/Library/Mobile Documents/com~apple~CloudDocs/Lumi`) or any custom sync directory, with OS keychain passphrase protection via Electron `safeStorage`.
    - Watches `inbox/` for `.json`/`.txt` drops from Apple iOS Shortcuts and merges remote device tabs, favourites, and history.
  - **Local Wi-Fi & Bonjour Companion Server (`src/main/modules/safari-sync/companion-server.ts`, `websocket.ts`, `companion-html.ts`):**
    - Embedded local HTTP + RFC 6455 WebSocket server with token/6-digit pairing authentication, rate-limited `/api/pair`, macOS Bonjour advertisement (`_lumi-sync._tcp` via `/usr/bin/dns-sd`), self-contained mobile Safari web UI, and pure-TypeScript QR code pairing (`src/renderer/src/lib/qr-code.ts`).
  - **UI & Onboarding Integration:**
    - Added **Settings → Safari & Sync** (`src/renderer/src/components/settings/sections/safari-sync/`) with Safari Bridge, iCloud Sync, Wi-Fi/Bonjour QR pairing, Sync Inbox, and Activity Log.
    - Added an optional macOS **Import from Safari** step in Onboarding (`src/renderer/src/components/onboarding/stages/safari-import.tsx`) with deferred tab opening upon onboarding completion.
