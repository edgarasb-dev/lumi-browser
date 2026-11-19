import { Tab } from "./tab";
import { TabBoundsController, isRectangleEqual } from "./bounds";
import { TabLifecycleManager } from "./tab-lifecycle";
import { getCurrentTimestamp } from "@/modules/utils";
import { SplitDirection, TabGroupMode } from "~/types/tabs";
import { type LayerType } from "~/layers";
import { Rectangle } from "electron";
import { type TabsController } from "./index";

export const SPLIT_PANE_GAP = 8;

/**
 * Manages tab layout: bounds calculation, visibility, z-index positioning.
 *
 * Design notes:
 * - Reads tab state but only mutates it through tab.updateStateProperty()
 * - Uses TabBoundsController for spring-physics bounds animation
 * - Needs a reference to TabsController to query tab group membership
 *   (one-way dependency: layout -> controller, never controller -> layout)
 * - Needs a reference to TabLifecycleManager for wake-on-show and PiP transitions
 */
export class TabLayoutManager {
  private lastTabGroupMode: TabGroupMode | null = null;
  private lastBorderRadius: number | null = null;
  private lastLogicalVisible: boolean = false;

  constructor(
    private readonly tab: Tab,
    private readonly tabsController: TabsController,
    private readonly boundsController: TabBoundsController,
    private readonly lifecycleManager: TabLifecycleManager
  ) {}

  /**
   * Resets cached view state (bounds, border radius) when the underlying
   * WebContentsView is destroyed (e.g. on sleep). This ensures the next
   * updateLayout() call will re-apply bounds and border radius to the
   * newly created view instead of skipping due to stale equality checks.
   */
  onViewDestroyed(): void {
    this.boundsController.resetLastAppliedBounds();
    this.lastBorderRadius = null;
    this.lastLogicalVisible = false;
  }

  /**
   * Resets cached layout state when a tab moves to a different window.
   *
   * The new window likely has different pageBounds. Without this reset the
   * TabBoundsController's `lastAppliedBounds` still holds the old window's
   * values, and if the two windows happen to share the same dimensions (or
   * close enough after rounding) `updateViewBounds()` would skip applying
   * the new bounds entirely — causing the tab to render with stale bounds
   * or not appear at all.
   */
  onWindowChanged(): void {
    this.boundsController.resetLastAppliedBounds();
    this.lastBorderRadius = null;
  }

  /**
   * Shows the tab (sets visible = true and updates layout).
   */
  show(): void {
    const updated = this.tab.updateStateProperty("visible", true);
    if (!updated) return; // Already visible
    this.updateLayout();
  }

  /**
   * Hides the tab (sets visible = false and updates layout).
   */
  hide(): void {
    const updated = this.tab.updateStateProperty("visible", false);
    if (!updated) return; // Already hidden
    this.updateLayout();
  }

  /**
   * Full layout update for the tab. Handles:
   * - Visibility sync with the WebContentsView
   * - PiP enter/exit on visibility transitions
   * - Wake-on-show for sleeping tabs
   * - Bounds calculation based on tab group mode (normal/glance/split)
   * - Z-index management
   * - Spring-animated bounds transitions
   */
  updateLayout(immediate = false): void {
    const { tab, tabsController, boundsController } = this;
    const { visible } = tab;
    const window = tab.getWindow();

    // Sync view visibility (only if view exists — sleeping tabs have no view).
    // Note: when Reader Mode is active on a visible tab, keep logical visibility
    // true while hiding the WebContentsView layer so the React ReaderView is revealed.
    const wasLogicalVisible = this.lastLogicalVisible;
    this.lastLogicalVisible = visible;
    const shouldShowView = visible && !tab.readerMode;
    if (tab.layer && tab.layer.isVisible() !== shouldShowView) {
      tab.layer.setVisible(shouldShowView);
    }

    if (wasLogicalVisible !== visible) {
      // Handle PiP transitions on visibility change
      if (visible) {
        this.lifecycleManager.exitPictureInPicture();
      } else {
        // Only enter PiP if no other tab is already in PiP. Without this guard,
        // restoring a PiP tab hides the previously-active tab, which then tries
        // to enter PiP, creating a loop where each tab's PiP exit triggers the
        // other to enter PiP indefinitely.
        const windowId = tab.getWindow().id;
        const anyTabInPiP = this.tabsController
          .getTabsInWindow(windowId)
          .some((t) => t.id !== tab.id && t.isPictureInPicture);
        const isStillVisibleElsewhere = this.tabsController.isTabVisibleInAnotherWindow(tab);
        if (!anyTabInPiP && !isStillVisibleElsewhere) {
          this.lifecycleManager.enterPictureInPicture();
        }
      }
    }

    // Update lastActiveAt on visibility transitions
    const justHidden = wasLogicalVisible && !visible;
    const justShown = !wasLogicalVisible && visible;
    if (justHidden || justShown) {
      tab.updateStateProperty("lastActiveAt", getCurrentTimestamp());
    }

    if (!visible) return;

    // Update extensions on show
    if (justShown && tab.webContents) {
      const extensions = tab.loadedProfile.extensions;
      extensions.selectTab(tab.webContents);
    }

    // Auto-wake sleeping tabs when they become visible
    this.lifecycleManager.wakeUp();

    if (tab.readerMode) {
      return;
    }

    // Get base bounds and fullscreen state.
    // In fullscreen, bypass the renderer-reported pageBounds and use the
    // full window content area directly. This eliminates the timing gap
    // between entering fullscreen and the renderer remeasuring/reporting
    // new bounds — the tab fills the window immediately.
    let pageBounds: Rectangle;
    if (tab.fullScreen) {
      const [contentWidth, contentHeight] = window.browserWindow.getContentSize();
      pageBounds = { x: 0, y: 0, width: contentWidth, height: contentHeight };
    } else {
      pageBounds = window.pageBounds;
    }
    const borderRadius = tab.fullScreen ? 0 : 6;
    if (borderRadius !== this.lastBorderRadius && tab.view) {
      tab.view.setBorderRadius(borderRadius);
      this.lastBorderRadius = borderRadius;
    }

    // Determine tab group mode and calculate bounds
    const tabGroup = tabsController.getTabGroupByTabId(tab.id);
    const lastTabGroupMode = this.lastTabGroupMode;
    let newBounds: Rectangle | null = null;
    let newTabGroupMode: TabGroupMode | null = null;
    let layerType: LayerType = "tab";

    if (!tabGroup) {
      newTabGroupMode = "normal";
      newBounds = pageBounds;
    } else if (tabGroup.mode === "glance") {
      newTabGroupMode = "glance";
      const isFront = tabGroup.frontTabId === tab.id;
      newBounds = this.calculateGlanceBounds(pageBounds, isFront);

      layerType = isFront ? "tab" : "tabBack";
    } else if (tabGroup.mode === "split") {
      newTabGroupMode = "split";
      const tabsInGroup = tabGroup.tabs;
      const paneIndex = Math.max(
        0,
        tabsInGroup.findIndex((t) => t.id === tab.id)
      );
      newBounds = this.calculateSplitBounds(
        pageBounds,
        paneIndex,
        tabsInGroup.length,
        tabGroup.splitRatio,
        tabGroup.splitDirection
      );
    }

    // Update z-index via setWindow
    tab.setWindow(window, layerType);

    // Track mode changes
    if (newTabGroupMode !== lastTabGroupMode) {
      this.lastTabGroupMode = newTabGroupMode;
    }

    // Apply calculated bounds with spring animation (or immediately during interactive split drag)
    if (newBounds) {
      const useImmediateUpdate =
        immediate ||
        (newTabGroupMode === lastTabGroupMode &&
          isRectangleEqual(boundsController.bounds, boundsController.targetBounds));

      if (useImmediateUpdate) {
        boundsController.setBoundsImmediate(newBounds);
      } else {
        boundsController.setBounds(newBounds);
      }
    }
  }

  /**
   * Calculates bounds for a tab inside a Split View group.
   * Leaves an 8px gap between panes so the renderer splitter handle sits cleanly in-between.
   */
  private calculateSplitBounds(
    pageBounds: Rectangle,
    paneIndex: number,
    totalPanes: number,
    ratio: number,
    direction: SplitDirection
  ): Rectangle {
    if (totalPanes <= 1) {
      return pageBounds;
    }

    const effectiveTotal = Math.max(2, totalPanes);
    const gapTotal = SPLIT_PANE_GAP * (effectiveTotal - 1);

    if (direction === "vertical") {
      const availableHeight = Math.max(0, pageBounds.height - gapTotal);
      if (effectiveTotal === 2) {
        const firstHeight = Math.floor(availableHeight * ratio);
        if (paneIndex === 0) {
          return { x: pageBounds.x, y: pageBounds.y, width: pageBounds.width, height: firstHeight };
        }
        return {
          x: pageBounds.x,
          y: pageBounds.y + firstHeight + SPLIT_PANE_GAP,
          width: pageBounds.width,
          height: Math.max(0, availableHeight - firstHeight)
        };
      }
      const sliceHeight = Math.floor(availableHeight / effectiveTotal);
      const y = pageBounds.y + paneIndex * (sliceHeight + SPLIT_PANE_GAP);
      const height = paneIndex === effectiveTotal - 1 ? Math.max(0, pageBounds.y + pageBounds.height - y) : sliceHeight;
      return { x: pageBounds.x, y, width: pageBounds.width, height };
    }

    const availableWidth = Math.max(0, pageBounds.width - gapTotal);
    if (effectiveTotal === 2) {
      const firstWidth = Math.floor(availableWidth * ratio);
      if (paneIndex === 0) {
        return { x: pageBounds.x, y: pageBounds.y, width: firstWidth, height: pageBounds.height };
      }
      return {
        x: pageBounds.x + firstWidth + SPLIT_PANE_GAP,
        y: pageBounds.y,
        width: Math.max(0, availableWidth - firstWidth),
        height: pageBounds.height
      };
    }

    const sliceWidth = Math.floor(availableWidth / effectiveTotal);
    const x = pageBounds.x + paneIndex * (sliceWidth + SPLIT_PANE_GAP);
    const width = paneIndex === effectiveTotal - 1 ? Math.max(0, pageBounds.x + pageBounds.width - x) : sliceWidth;
    return { x, y: pageBounds.y, width, height: pageBounds.height };
  }

  /**
   * Calculates bounds for a tab in glance mode.
   * Front tab is slightly smaller; back tab is larger but behind.
   */
  private calculateGlanceBounds(pageBounds: Rectangle, isFront: boolean): Rectangle {
    const widthPercentage = isFront ? 0.85 : 0.95;
    const heightPercentage = isFront ? 1 : 0.975;

    const newWidth = Math.floor(pageBounds.width * widthPercentage);
    const newHeight = Math.floor(pageBounds.height * heightPercentage);

    const xOffset = Math.floor((pageBounds.width - newWidth) / 2);
    const yOffset = Math.floor((pageBounds.height - newHeight) / 2);

    return {
      x: pageBounds.x + xOffset,
      y: pageBounds.y + yOffset,
      width: newWidth,
      height: newHeight
    };
  }
}
