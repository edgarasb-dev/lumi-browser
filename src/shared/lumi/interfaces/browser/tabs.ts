import { IPCListener } from "~/lumi/types";
import {
  FolderColorId,
  RecentlyClosedTabData,
  SplitDirection,
  TabData,
  TabPlaceholderUpdate,
  TabTargetUrlUpdate,
  TidyResult,
  WindowTabsData
} from "~/types/tabs";

// API //
export interface LumiTabsAPI {
  /**
   * Get the data for all tabs
   * @returns The data for all tabs
   */
  getData: () => Promise<WindowTabsData>;

  /**
   * Add a callback to be called when the tabs data is updated (full refresh)
   * @param callback The callback to be called when the tabs data is updated
   */
  onDataUpdated: IPCListener<[WindowTabsData]>;

  /**
   * Add a callback for lightweight content-only tab updates.
   * Receives only the tabs whose content (title, url, isLoading, etc.) changed,
   * without a full WindowTabsData refresh.
   * @param callback Receives an array of updated TabData objects
   */
  onTabsContentUpdated: IPCListener<[TabData[]]>;

  /**
   * Add a callback for tab-sync screenshot placeholder updates.
   * When tab sync is enabled and a tab's view moves to another window,
   * the old window receives the snapshot ID of the tab's last screenshot.
   * The renderer resolves it through `lumi-internal://tab-snapshot?id=...`.
   * `snapshotId: null` means clear the placeholder.
   * `generation` is monotonic per window and lets the renderer ignore stale updates.
   * @param callback Receives the placeholder payload
   */
  onPlaceholderChanged: IPCListener<[TabPlaceholderUpdate]>;

  /**
   * Hover link target URL updates for the active tab (Chrome-like status bar).
   * `url` is empty when the cursor leaves a link or the tab is torn down.
   */
  onTargetUrlChanged: IPCListener<[TabTargetUrlUpdate]>;

  /**
   * Switch to a tab
   * @param tabId The id of the tab to switch to
   */
  switchToTab: (tabId: number) => Promise<boolean>;

  /**
   * Create a new tab
   * @param url The url to load in the tab
   * @param isForeground Whether to make the tab the foreground tab
   * @param spaceId The id of the space to create the tab in
   */
  newTab: (url?: string, isForeground?: boolean, spaceId?: string, typedFromAddressBar?: boolean) => Promise<boolean>;

  /**
   * Close a tab
   * @param tabId The id of the tab to close
   */
  closeTab: (tabId: number) => Promise<boolean>;

  /**
   * Show the context menu for a tab
   * @param tabId The id of the tab to show the context menu for
   */
  showContextMenu: (tabId: number) => void;

  /**
   * Disable Picture in Picture mode for a tab
   * @param goBackToTab Whether to go back to the tab after Picture in Picture mode is disabled
   */
  disablePictureInPicture: (goBackToTab: boolean) => Promise<boolean>;

  /**
   * Get preview information and screenshot snapshot for a tab
   * @param tabId The id of the tab to get a preview for
   */
  getTabPreview: (tabId: number) => Promise<{ snapshotUrl: string | null } | null>;

  /**
   * Set the muted state of a tab
   * @param tabId The id of the tab to set muted state for
   * @param muted Whether the tab should be muted
   */
  setTabMuted: (tabId: number, muted: boolean) => Promise<boolean>;

  /**
   * Put an inactive tab to sleep to free up memory
   * @param tabId The id of the tab to snooze
   */
  snoozeTab: (tabId: number) => Promise<boolean>;

  /**
   * Wake up a sleeping tab
   * @param tabId The id of the tab to wake
   */
  wakeTab: (tabId: number) => Promise<boolean>;

  /**
   * Move a tab to a new position
   * @param tabId The id of the tab to move
   * @param newPosition The new position of the tab
   */
  moveTab: (tabId: number, newPosition: number) => Promise<boolean>;

  /**
   * Move a tab to a new space
   * @param tabId The id of the tab to move
   * @param spaceId The id of the space to move the tab to
   * @param newPosition The new position of the tab
   */
  moveTabToWindowSpace: (tabId: number, spaceId: string, newPosition?: number) => Promise<boolean>;

  /**
   * Move multiple tabs to a new space in one operation
   * @param tabIds The ids of the tabs to move
   * @param spaceId The target space id
   * @param newPositionStart The starting position for the moved tabs
   */
  batchMoveTabs: (tabIds: number[], spaceId: string, newPositionStart?: number) => Promise<boolean>;

  /**
   * Get all recently closed tabs
   * @returns Array of recently closed tab data, sorted by most recently closed first
   */
  getRecentlyClosed: () => Promise<RecentlyClosedTabData[]>;

  /**
   * Restore a recently closed tab by its unique ID
   * @param uniqueId The unique ID of the tab to restore
   * @returns Whether the tab was successfully restored
   */
  restoreRecentlyClosed: (uniqueId: string) => Promise<boolean>;

  /**
   * Clear all recently closed tabs
   * @returns Whether the operation was successful
   */
  clearRecentlyClosed: () => Promise<boolean>;

  /**
   * Pair two tabs into a side-by-side or stacked Split View group
   */
  createSplitView: (tabIds: [number, number], direction?: SplitDirection) => Promise<boolean>;

  /**
   * Adjust the pane ratio [0.2..0.8] of an active Split View group
   */
  setSplitRatio: (groupId: string, ratio: number) => Promise<boolean>;

  /**
   * Switch Split View orientation between horizontal and vertical
   */
  setSplitDirection: (groupId: string, direction: SplitDirection) => Promise<boolean>;

  /**
   * Swap the panes inside a Split View group
   */
  swapSplitPanes: (groupId: string) => Promise<boolean>;

  /**
   * Ungroup a Split or Glance group without destroying its tabs
   */
  ungroupTabGroup: (groupId: string, preferredActiveTabId?: number) => Promise<boolean>;

  /**
   * Dismiss a Glance overlay group (close front tab or promote front tab to full view)
   */
  dismissGlance: (groupId: string, promoteFront?: boolean) => Promise<boolean>;

  /**
   * Create a named collapsible folder from one or more tabs
   */
  createFolder: (tabIds: number[], options?: { name?: string; color?: FolderColorId }) => Promise<string | null>;

  /**
   * Rename an existing folder tab group
   */
  renameFolder: (groupId: string, name: string) => Promise<boolean>;

  /**
   * Set the surface tint color of a folder tab group
   */
  setFolderColor: (groupId: string, color: FolderColorId) => Promise<boolean>;

  /**
   * Persist folder collapse/expand state
   */
  setFolderCollapsed: (groupId: string, collapsed: boolean) => Promise<boolean>;

  /**
   * Add a tab into an existing folder tab group
   */
  addTabToFolder: (groupId: string, tabId: number, position?: number) => Promise<boolean>;

  /**
   * Remove a tab from its folder group back to a loose tab
   */
  removeTabFromFolder: (tabId: number, newPosition?: number) => Promise<boolean>;

  /**
   * Move an entire folder tab group to a new position in the current space
   */
  moveTabGroup: (groupId: string, newPosition: number) => Promise<boolean>;

  /**
   * Move an entire folder tab group to another space
   */
  moveTabGroupToSpace: (groupId: string, spaceId: string, newPosition?: number) => Promise<boolean>;

  /**
   * Show the native context menu for a folder tab group
   */
  showFolderContextMenu: (groupId: string) => void;

  /**
   * Deterministically tidy ungrouped tabs in a space (domain folders + duplicate/blank cleanup)
   */
  tidySpace: (spaceId: string) => Promise<TidyResult>;

  /**
   * Revert a previously applied Tidy action using its undo token
   */
  undoTidy: (undoId: string) => Promise<boolean>;
}
