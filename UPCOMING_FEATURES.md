# Upcoming Features Roadmap

| Feature                               | Difficulty             | Estimated Effort  | Status     |
| :------------------------------------ | :--------------------- | :---------------- | :--------- |
| **Custom Search Engines**             | 🟢 Easy (1/5)          | Completed         | ✅ Done    |
| **Preview Tabs**                      | 🟢 Easy (1.5/5)        | Completed         | ✅ Done    |
| **Adblock Shield & Privacy Counter**  | 🟢 Easy–Moderate (2/5) | Completed         | ✅ Done    |
| **Space Scratchpad / Quick Notes**    | 🟢 Easy (1.5/5)        | Completed         | ✅ Done    |
| **Reorder Tabs**                      | 🟡 Easy–Moderate (2/5) | Completed         | ✅ Done    |
| **Space Themes & Custom Colors**      | 🟢 Easy–Moderate (2/5) | Completed         | ✅ Done    |
| **Command Palette (Cmd + K)**         | 🟡 Moderate (2.5/5)    | Completed         | ✅ Done    |
| **Tab Snooze & Auto-Archive**         | 🟡 Moderate (2.5/5)    | Completed         | ✅ Done    |
| **Favourites**                        | 🟡 Moderate (3/5)      | Completed         | ✅ Done    |
| **Collapsible Tab Groups / Folders**  | 🟡 Moderate (3/5)      | Completed         | ✅ Done    |
| **Reader Mode**                       | 🟡 Moderate (3/5)      | 3–5 hours         | ⏳ Pending |
| **Pinned Tabs in Spaces**             | 🟡 Moderate (3.5/5)    | 4–5 hours         | ⏳ Pending |
| **Downloads**                         | 🟠 Moderate–Hard (4/5) | 5–7 hours         | ⏳ Pending |
| **Topbar vs Sidebar**                 | 🔴 Hard (4.5/5)        | Completed         | ✅ Done    |
| **Rebranding to Lumi (Fork of Flow)** | 🟢 Easy–Moderate (2/5) | Completed         | ✅ Done    |
| **Safari Connectivity**               | 🔴 Very Hard (5/5)     | Multi-day project | ⏳ Pending |

---

## Feature Breakdown & Implementation Plan

### 1. ✅ Custom Search Engines (Completed)

- **Difficulty:** 🟢 Easy (1/5)
- **Status:** [x] Done
- **How it was implemented:**
  - Added SQLite/DataStore storage in Main process with IPC communication.
  - Built built-in search engine presets (Google, DuckDuckGo, Bing, Brave, Ecosia, Kagi) and support for custom query URLs with `%s`.
  - Integrated with omnibox search URL generator and live suggestion fetchers.
  - Added dedicated Settings section under **Settings → Search**.

---

### 2. ✅ Preview Tabs (Completed)

- **Difficulty:** 🟢 Easy (1.5/5)
- **Status:** [x] Done
- **How it was implemented:**
  - Added snapshot capture caching in Main process (`captureTabPreview` and IPC handler `tabs:get-tab-preview`).
  - Added `getTabPreview` API to preload and `FlowTabsAPI`.
  - Built a sleek glassmorphic `TabPreviewCard` component with `motion/react` spring animations.
  - Shows page title, clean domain badge, URL path, live 16:9 thumbnail preview (or domain fallback), audio/mute badges, and sleeping state.
  - Integrated into `SidebarTab` with an optimal 350ms hover delay, smart above/below positioning within the sidebar, and quick actions (Click to switch, Mute, Close).

---

### 3. ✅ Reorder Tabs (Completed)

- **Difficulty:** 🟡 Easy to Moderate (2/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **Context Menu Actions (`ipc/browser/tabs.ts`):** Added "Move Tab Up" and "Move Tab Down" with automated position normalization to prevent drift, "Duplicate Tab", and an interactive "Move to Space" submenu listing all target spaces for seamless cross-space organization.
  - **Keyboard Navigation (`SpaceContentPage` in `space-pages-carousel.tsx`):** Added `Cmd + Option + Up` and `Cmd + Option + Down` (`Ctrl + Alt + Up/Down`) shortcuts that immediately nudge the active tab up or down with zero lag.
  - **Spring Layout Animations:** Fully coordinated with `motion/react` layout springs for silky smooth visual position swapping.

---

### 4. ✅ Favourites (Completed)

- **Difficulty:** 🟡 Moderate (3/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **Storage & Engine (`saving/favourites.ts`):** Persistent storage in DataStore (`getDatastore("favourites")`), with URL normalization, UUID generation, duplicate prevention, and event broadcasting.
  - **Main IPC (`ipc/browser/favourites.ts`):** `favourites:get-all`, `favourites:add`, `favourites:remove`, `favourites:is-favourite` handlers, broadcasting updates via `listeners-manager`.
  - **Preload API (`FlowFavouritesAPI`):** Added `flow.favourites` with full typed async methods and change subscription.
  - **Address Bar Star Button (`FavouriteButton`):** Dynamic Star button in the address bar that shines gold when favorited, toggles on click, and listens to the universal `Cmd + D` shortcut.
  - **Quick Menu Integration:** Added Favourites section to `BottomExtrasMenu` for 1-click opening of bookmarked pages.

---

### 5. ⏳ Pinned Tabs in Spaces

- **Description:** Allow tabs to be pinned specifically per space, sitting pinned at the top of that space.
- **Difficulty:** 🟡 Moderate (3.5/5)
- **How we will do it:**
  - **Storage:** Extend tab state / Drizzle database schema to add an `is_pinned` flag and `pinned_order` scoped to `space_id`.
  - **Sidebar Layout:** In `browser-sidebar`, split the space's tabs into two sections:
    - **Pinned Section (Top):** Compact icon-only or mini-pill tabs that stay anchored at the top of the space.
    - **Normal Tabs (Bottom):** Regular tab list with scroll.
  - **Interactions:** Right-click tab → "Pin Tab in Space", drag between Pinned and Unpinned zones, keyboard shortcut (`Cmd + Shift + P`).

---

### 6. ⏳ Downloads

- **Description:** Full file download manager for files downloaded from the web.
- **Difficulty:** 🟠 Moderate to Hard (4/5)
- **How we will do it:**
  - **Main Process:** Intercept Electron's `session.defaultSession.on('will-download')`.
  - **Tracking & Storage:** Track real-time progress (`bytesReceived`, `totalBytes`, `speed`, state: `progressing` / `interrupted` / `completed` / `cancelled`), with download history stored in SQLite.
  - **UI / UX:**
    - Downloads toolbar button / popover showing active progress rings and recent downloads.
    - "Show in Finder", "Open File", "Cancel", and "Retry" actions.
    - Completion toast notifications via `sonner`.

---

### 7. ✅ Topbar vs Sidebar (Completed)

- **Difficulty:** 🔴 Hard (4.5/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **Setting & Persistence (`basic-settings.ts`):** Registered `navigationLayout` setting ("Vertical Sidebar (Default)" vs "Horizontal Top Bar") under **Settings → General → Layout & Navigation**.
  - **Horizontal Navigation Chrome (`TopbarLayout` in `components/browser-ui/topbar/index.tsx`):**
    - **Tab Strip:** Full horizontal tab bar displaying tab favicons, titles, sleeping indicators, audio/mute icons, close buttons, and 1-click new tab creation.
    - **Control Row:** Unified window traffic lights, Back/Forward/Reload navigation controls, full AddressBar with privacy shield and bookmark star, space switcher pills with theme popover access, and quick notepad/extras drawers.
    - **One-Click Switcher:** Added a 1-click layout toggle button in the topbar to instantly flip back to vertical sidebar mode.
  - **Declarative WebContents Bounds:** Measured layout offset automatically synchronizes through `contentTopOffset` and `flow.page.setLayoutParams`. The Electron main process dynamically adjusts `recomputePageBounds`, giving the webpage full window width without horizontal offset when topbar mode is engaged.

---

### 8. ⏳ Safari Connectivity

- **Description:** Sync open tabs, history, and bookmarks with mobile / Safari.
- **Difficulty:** 🔴 Very Hard (5/5)
- **How we will do it:**
  - Since Flow is a desktop-only app, connecting to iOS/Safari requires an external bridge:
    - **Option A (iCloud Sync):** Sync an encrypted JSON state file to the user's `~/Library/Mobile Documents/com~apple~CloudDocs/` (iCloud Drive) that an iOS Shortcut or companion reader accesses.
    - **Option B (Local Network / Bonjour):** Run a local WebSocket/HTTP companion server inside Electron to sync with mobile devices on the same Wi-Fi.
    - **Option C (Safari Import / AppleScript Bridge):** One-click import/sync from macOS Safari open tabs and reading list into Flow via macOS AppleScript IPC.

---

### 9. ✅ Adblock Shield & Privacy Counter (Completed)

- **Difficulty:** 🟢 Easy to Moderate (2/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **Backend (`content-blocker.ts`):**
    - Intercepted `ElectronBlocker` events (`request-blocked`, `request-redirected`) to track blocked count and detailed request items per tab WebContents.
    - Page counters reset automatically on tab navigation to keep page statistics accurate.
    - Wrapped `blocker.onBeforeRequest` and `blocker.onInjectCosmeticFilters` to cleanly bypass network blocking and cosmetic CSS/script injection on whitelisted domains.
    - Persisted user domain whitelist and lifetime blocked count in `DataStore` with debounced sync.
  - **IPC & Preload:**
    - Exposed `flow.contentBlocker` with `getTabStats`, `toggleDomainWhitelist`, `getWhitelistedDomains`, `isDomainWhitelisted`, `getTotalBlocked`, and live event listeners `onStatsUpdated` / `onWhitelistChanged`.
  - **UI / UX (`AdblockShield`):**
    - Integrated privacy shield indicator into `AddressBar`.
    - Live badge counter for blocked trackers/ads on the active page, emerald shield when protected, amber warning badge when paused.
    - Rich glassmorphic popover featuring domain lock badge, one-click protection toggle switch, "On this page" vs "All-time" stat cards, reload banner prompt, and an expandable list of blocked trackers categorized by resource type (scripts, images, XHR, subframes).

---

### 10. ✅ Space Scratchpad / Quick Notes (Completed)

- **Difficulty:** 🟢 Easy (1.5/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **Storage & IPC:** Saved per-space markdown content into `getDatastore("space-notes")` keyed by `spaceId`, with `spaces:get-notes` and `spaces:save-notes` IPC handlers.
  - **Preload APIs:** Added `flow.spaces.getSpaceNotes(spaceId)` and `flow.spaces.saveSpaceNotes(spaceId, content)`.
  - **Renderer UI (`SpaceScratchpad`):**
    - Integrated notepad trigger icon in the sidebar bottom bar (with active dot badge if notes exist for the current space).
    - Glassmorphic modal editor with automatic debounced auto-save (400ms).
    - Shows live word and character counters (`X words • Y chars`), "Copy all" to clipboard with checkmark confirmation, and 1-click "Clear" action.
    - Seamlessly reactive: switching spaces via `SpaceSwitcher` automatically loads the new space's scratchpad notes.

---

### 11. ✅ Space Themes & Custom Colors (Completed)

- **Difficulty:** 🟢 Easy to Moderate (2/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **Quick Theme Popover (`SpaceThemePopover`):** Built a sleek glassmorphic popover with live gradient preview banner, space name inline editing, 10 curated designer gradient presets (Sunset Flame, Aurora Emerald, Deep Ocean, Electric Violet, Midnight Indigo, etc.), and custom HTML hex color pickers.
  - **Harmonic Random Generator:** Added a smart "Randomize" generator calculating complementary and adjacent HSL hues for instant aesthetic themes.
  - **Phosphor Space Icon Picker:** Integrated 16 high-utility space icon selectors directly inside the popover.
  - **Ubiquitous Sidebar Access:** Triggerable via right-click on any `SpaceButton` in the bottom space switcher, as well as via a dedicated hover palette action on the `SpaceTitle` header.

---

### 12. ✅ Command Palette (Cmd + K) (Completed)

- **Difficulty:** 🟡 Moderate (2.5/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **Global Accelerator & WebContents Interception:** Registered `CommandOrControl+K` in application menu shortcuts and in `wc.on("before-input-event")` inside `tab-cycle-shortcuts.ts`, guaranteeing instant opening even when arbitrary web pages have native keyboard focus.
  - **Omnibox Command Mode:** Launches Flow's centered overlay command launcher with an empty search query, allowing instantaneous jumping to open tabs, browsing history, bookmark navigation, search engine queries, and browser pedals (Settings, New Window, Private Mode, Extensions, History).

---

### 13. ✅ Tab Snooze & Auto-Archive (Completed)

- **Difficulty:** 🟡 Moderate (2.5/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **Backend IPC (`tabs:snooze-tab`, `tabs:wake-tab`):** Connected IPC endpoints directly to `TabLifecycleManager`'s sleep/wake engine.
  - **Context Menu:** Updated sidebar tab right-click context menu with intuitive "Snooze Tab (Save Memory)" and "Wake Tab" actions.
  - **Sidebar Visual Indicator:** Sleeping tabs display an elegant soft `Zzz` pill badge and muted typography while sleeping to visibly indicate RAM savings.
  - **Preview Card Quick Controls:** Added instant 1-click Snooze/Wake moon button directly on the tab preview card.
  - **Preload API:** Exposed `flow.tabs.snoozeTab(tabId)` and `flow.tabs.wakeTab(tabId)`.

---

### 14. ✅ Collapsible Tab Groups / Folders (Completed)

- **Difficulty:** 🟡 Moderate (3/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **Folder Header & Pill Badge (`tab-group.tsx`):** Multi-tab groups display an interactive folder header with folder glyph, tab counter badge (`tabs.length`), and animated expand/collapse chevrons.
  - **Accordion Animation:** Connected with `AnimatePresence` and spring height motion; collapsing cleanly hides non-active tabs into the compact folder rail while retaining full drag-and-drop support.
  - **Smart Auto-Expand:** Automatically expands when a tab within the group gains active focus.

---

### 15. ✅ Topbar vs Sidebar Navigation Layout (Completed)

- **Difficulty:** 🔴 Hard (4.5/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **Setting Configuration (`basic-settings.ts`):** Added `navigationLayout` setting (`"sidebar"` | `"topbar"`) under `Settings → General → Layout & Navigation`.
  - **Dynamic Sidebar Removal (`main.tsx` & `BrowserSidebarProvider`):** When in Topbar mode, `hasSidebar` is dynamically set to `false`, eliminating empty sidebar offsets in both React layout and Electron main-process `PageLayoutParams` bounds.
  - **Theme-Integrated Horizontal Top Bar (`topbar/index.tsx`):**
    - Seamless frosted glass aesthetic that lets the active Space gradient shine through.
    - Top row features native macOS traffic lights, Space switcher capsule, horizontal tab strip with hover previews (`TabPreviewCard`), audio/mute controls, sleep indicators, new tab button, and 1-click layout toggle back to sidebar.
    - Bottom row integrates Flow's native navigation controls, address bar with full omnibox dropdown support, quick scratchpad, and extras menu.
    - Web page content is cleanly framed as a floating card with Flow's signature margins.

---

### 16. ⏳ Reader Mode

- **Description:** Clean, distraction-free reading view for articles, blogs, and news pages with font and theme options.
- **Difficulty:** 🟡 Moderate (3/5)
- **How we will do it:**
  - Inject Mozilla Readability script into the active page when an article is detected.
  - Present distilled article in an elegant overlay or dedicated reader view with font size, line spacing, and light/dark/sepia themes.

---

### 17. ✅ Rebranding to Lumi (Fork of Flow) (Completed)

- **Description:** Rebranded the browser to **Lumi**, establishing distinct branding and identity while honoring the original authors under GNU GPLv3.
- **Difficulty:** 🟢 Easy to Moderate (2/5)
- **Status:** [x] Done
- **How it was implemented:**
  - **App Metadata & Packaging:**
    - Update `package.json` (`"name": "lumi-browser"`, `"productName": "Lumi"`).
    - Update `electron-builder.ts` (`appId: "dev.lumi.browser"`, `productName: "Lumi"`, `executableName: "lumi"`).
  - **Visual Identity & Assets:**
    - Design and create modern Lumi application icons (`build/icon.png`, `build/icon.icns`, `favicon.png`).
    - Replace in-app branding text, welcome/onboarding dialogs, and window titles to reference Lumi.
  - **Legal Notices & Attribution (GPLv3 Compliance):**
    - Preserve the root `LICENSE` (GNU GPLv3).
    - Update `README.md` with clear attribution: _"Lumi is an open-source browser forked from Flow Browser by iamEvan / multiboxlabs, licensed under the GNU General Public License v3.0"_.
    - Add an "About Lumi" dialog with explicit attribution, copyright preservation, and links back to the original Flow repository.
