import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PageLayoutParams } from "~/lumi/types";
import { cn } from "@/lib/utils";
import { useBrowserSidebar } from "@/components/browser-ui/browser-sidebar/provider";
import { useAdaptiveTopbar } from "@/components/browser-ui/adaptive-topbar";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useFocusedTab, useTabsGroups } from "@/components/providers/tabs-provider";
import { ReaderView } from "@/components/browser-ui/reader-view";
import type { TabPlaceholderUpdate } from "~/types/tabs";
import "./browser-content.css";

const PLACEHOLDER_CLEAR_DELAY_MS = 180;

/**
 * BrowserContent is the placeholder div that represents the page content area.
 * Instead of measuring its bounds via getBoundingClientRect(), it sends
 * declarative layout parameters to the main process, which computes exact
 * pixel bounds from getContentSize() + these parameters.
 *
 * Uses useLayoutEffect (not useEffect) so the IPC message is sent BEFORE
 * the browser paints. This synchronizes the main-process interpolation start
 * with the CSS transition start — both originate from the same commit.
 * With useEffect, the IPC would fire after paint, putting the interpolation
 * a full frame (~16ms) behind the CSS transition.
 *
 * See design/DECLARATIVE_PAGE_BOUNDS.md for the full design.
 */
function BrowserContent() {
  const { mode, recordedSidebarSizeRef, isAnimating, attachedDirection, onSidebarResize } = useBrowserSidebar();
  const { topbarHeight, topbarVisible, contentTopOffset } = useAdaptiveTopbar();
  const { currentSpace } = useSpaces();
  const { activeTabGroup } = useTabsGroups();
  const focusedTab = useFocusedTab();

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragSplitRatio, setDragSplitRatio] = useState<number | null>(null);
  const splitRafRef = useRef<number | null>(null);
  const pendingSplitRatioRef = useRef<number | null>(null);

  // Tab-sync placeholder: screenshot shown when the active tab's view
  // has been moved to another window.
  const [placeholderSnapshotId, setPlaceholderSnapshotId] = useState<string | null>(null);
  const clearPlaceholderTimeoutRef = useRef<number | null>(null);
  const latestPlaceholderGenerationRef = useRef(0);
  const currentSpaceIdRef = useRef<string | null>(currentSpace?.id ?? null);

  useEffect(() => {
    const clearPendingPlaceholder = () => {
      if (clearPlaceholderTimeoutRef.current !== null) {
        window.clearTimeout(clearPlaceholderTimeoutRef.current);
        clearPlaceholderTimeoutRef.current = null;
      }
    };

    const unsub = lumi.tabs.onPlaceholderChanged(({ snapshotId, generation, spaceId }: TabPlaceholderUpdate) => {
      if (spaceId !== currentSpaceIdRef.current) {
        return;
      }
      if (generation < latestPlaceholderGenerationRef.current) {
        return;
      }
      latestPlaceholderGenerationRef.current = generation;
      clearPendingPlaceholder();

      if (snapshotId) {
        setPlaceholderSnapshotId(snapshotId);
        return;
      }

      setPlaceholderSnapshotId((currentSnapshotId) => {
        if (!currentSnapshotId) return currentSnapshotId;

        clearPlaceholderTimeoutRef.current = window.setTimeout(() => {
          clearPlaceholderTimeoutRef.current = null;
          setPlaceholderSnapshotId(null);
        }, PLACEHOLDER_CLEAR_DELAY_MS);

        return currentSnapshotId;
      });
    });

    return () => {
      clearPendingPlaceholder();
      unsub();
    };
  }, []);

  useEffect(() => {
    currentSpaceIdRef.current = currentSpace?.id ?? null;
    if (clearPlaceholderTimeoutRef.current !== null) {
      window.clearTimeout(clearPlaceholderTimeoutRef.current);
      clearPlaceholderTimeoutRef.current = null;
    }
    setPlaceholderSnapshotId(null);
  }, [currentSpace?.id]);

  const placeholderUrl = placeholderSnapshotId ? `lumi-internal://tab-snapshot?id=${placeholderSnapshotId}` : null;

  // Derive sidebar visibility from the mode.
  // Floating sidebars are overlays (PortalComponent) and have zero layout impact.
  const sidebarVisible = mode.startsWith("attached-");

  // Use attachedDirection (always correct) rather than deriving from mode.
  // When mode="hidden" during a close animation, mode doesn't encode the side,
  // but the main process still needs it to shrink space from the correct edge.
  const sidebarSide = attachedDirection;

  // Helper: build and send layout params to the main process.
  const sendLayoutParams = useCallback(
    (sidebarWidth: number) => {
      const params: PageLayoutParams = {
        topbarHeight,
        topbarVisible,
        sidebarWidth,
        sidebarSide,
        sidebarVisible,
        sidebarAnimating: isAnimating,
        contentTopOffset
      };
      lumi.page.setLayoutParams(params);
    },
    [contentTopOffset, isAnimating, sidebarSide, sidebarVisible, topbarHeight, topbarVisible]
  );

  // Send layout params whenever reactive state changes (visibility, animation,
  // topbar, direction). Uses the ref for sidebarWidth since it's always current.
  useLayoutEffect(() => {
    sendLayoutParams(recordedSidebarSizeRef.current);
  }, [
    topbarHeight,
    topbarVisible,
    sidebarVisible,
    sidebarSide,
    isAnimating,
    contentTopOffset,
    sendLayoutParams,
    recordedSidebarSizeRef
  ]);

  // Subscribe to sidebar resize (drag) events. The callback fires outside
  // the React render cycle, so it doesn't cause re-renders of any consumer.
  // We keep a ref to the latest sendLayoutParams so the subscription closure
  // always uses current topbar/sidebar state without needing to re-subscribe.
  const sendLayoutParamsRef = useRef(sendLayoutParams);
  sendLayoutParamsRef.current = sendLayoutParams;

  useLayoutEffect(() => {
    return onSidebarResize((width) => {
      sendLayoutParamsRef.current(width);
    });
  }, [onSidebarResize]);

  useEffect(() => {
    setDragSplitRatio(null);
  }, [activeTabGroup?.id, activeTabGroup?.mode]);

  useEffect(() => {
    return () => {
      if (splitRafRef.current !== null) {
        window.cancelAnimationFrame(splitRafRef.current);
      }
    };
  }, []);

  const isSplitGroup = activeTabGroup?.mode === "split" && activeTabGroup.tabs.length === 2;
  const isGlanceGroup = activeTabGroup?.mode === "glance" && activeTabGroup.tabs.length >= 2;
  const splitDirection = activeTabGroup?.splitDirection ?? "horizontal";
  const effectiveSplitRatio = dragSplitRatio ?? activeTabGroup?.splitRatio ?? 0.5;

  const computeSplitRatioFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return 0.5;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return 0.5;
      const raw =
        splitDirection === "vertical" ? (clientY - rect.top) / rect.height : (clientX - rect.left) / rect.width;
      return Math.min(0.8, Math.max(0.2, raw));
    },
    [splitDirection]
  );

  const handleSplitPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activeTabGroup || activeTabGroup.mode !== "split") return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const ratio = computeSplitRatioFromPointer(e.clientX, e.clientY);
      setDragSplitRatio(ratio);
      pendingSplitRatioRef.current = ratio;
      lumi.tabs.setSplitRatio(activeTabGroup.id, ratio);
    },
    [activeTabGroup, computeSplitRatioFromPointer]
  );

  const handleSplitPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activeTabGroup || activeTabGroup.mode !== "split") return;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const ratio = computeSplitRatioFromPointer(e.clientX, e.clientY);
      setDragSplitRatio(ratio);
      pendingSplitRatioRef.current = ratio;
      if (splitRafRef.current === null) {
        const groupId = activeTabGroup.id;
        splitRafRef.current = window.requestAnimationFrame(() => {
          splitRafRef.current = null;
          if (pendingSplitRatioRef.current !== null) {
            lumi.tabs.setSplitRatio(groupId, pendingSplitRatioRef.current);
          }
        });
      }
    },
    [activeTabGroup, computeSplitRatioFromPointer]
  );

  const handleSplitPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (splitRafRef.current !== null) {
        window.cancelAnimationFrame(splitRafRef.current);
        splitRafRef.current = null;
      }
      if (activeTabGroup && activeTabGroup.mode === "split" && pendingSplitRatioRef.current !== null) {
        lumi.tabs.setSplitRatio(activeTabGroup.id, pendingSplitRatioRef.current);
      }
      pendingSplitRatioRef.current = null;
      setDragSplitRatio(null);
    },
    [activeTabGroup]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-sm",
        "flex-1 relative remove-app-drag",
        "bg-white/15",
        // Better shadow for the browser content
        "browser-content-shadow"
        // "shadow-xl shadow-black/20"
      )}
    >
      {placeholderUrl && (
        <img
          src={placeholderUrl}
          alt=""
          draggable={false}
          onError={() => setPlaceholderSnapshotId(null)}
          className="absolute inset-0 w-full h-full rounded-md object-fill opacity-50 pointer-events-none"
        />
      )}

      {isGlanceGroup && activeTabGroup && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Dismiss Glance overlay"
          onClick={() => lumi.tabs.dismissGlance(activeTabGroup.id, false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") {
              e.preventDefault();
              lumi.tabs.dismissGlance(activeTabGroup.id, false);
            }
          }}
          className="absolute inset-0 bg-black/25 cursor-pointer z-elevated"
          title="Click outside Glance to dismiss"
        />
      )}

      {isSplitGroup && activeTabGroup && (
        <div
          role="separator"
          aria-orientation={splitDirection}
          tabIndex={0}
          title="Drag to resize panes • Double-click to reset (50/50)"
          onPointerDown={handleSplitPointerDown}
          onPointerMove={handleSplitPointerMove}
          onPointerUp={handleSplitPointerUp}
          onPointerCancel={handleSplitPointerUp}
          onDoubleClick={() => lumi.tabs.setSplitRatio(activeTabGroup.id, 0.5)}
          style={
            splitDirection === "vertical"
              ? { top: `calc((100% - 8px) * ${effectiveSplitRatio})` }
              : { left: `calc((100% - 8px) * ${effectiveSplitRatio})` }
          }
          className={cn(
            "group absolute z-controls flex items-center justify-center select-none touch-none",
            splitDirection === "vertical"
              ? "left-0 right-0 h-2 cursor-row-resize"
              : "top-0 bottom-0 w-2 cursor-col-resize"
          )}
        >
          <div
            className={cn(
              "rounded-full bg-black/25 dark:bg-white/30 transition-all duration-150",
              splitDirection === "vertical"
                ? "h-1 w-12 group-hover:h-1.5 group-hover:w-16 group-hover:bg-black/50 dark:group-hover:bg-white/60"
                : "w-1 h-12 group-hover:w-1.5 group-hover:h-16 group-hover:bg-black/50 dark:group-hover:bg-white/60"
            )}
          />
        </div>
      )}

      {/* Reader Mode overlays: works cleanly in normal, Glance, and per-pane Split View */}
      {isSplitGroup && activeTabGroup ? (
        <>
          {activeTabGroup.tabs[0]?.readerMode && (
            <ReaderView
              tab={activeTabGroup.tabs[0]}
              style={
                splitDirection === "vertical"
                  ? {
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      height: `calc((100% - 8px) * ${effectiveSplitRatio})`
                    }
                  : {
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: `calc((100% - 8px) * ${effectiveSplitRatio})`
                    }
              }
            />
          )}
          {activeTabGroup.tabs[1]?.readerMode && (
            <ReaderView
              tab={activeTabGroup.tabs[1]}
              style={
                splitDirection === "vertical"
                  ? {
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      top: `calc((100% - 8px) * ${effectiveSplitRatio} + 8px)`
                    }
                  : {
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      right: 0,
                      left: `calc((100% - 8px) * ${effectiveSplitRatio} + 8px)`
                    }
              }
            />
          )}
        </>
      ) : isGlanceGroup && activeTabGroup ? (
        activeTabGroup.tabs.find((t) => t.id === activeTabGroup.glanceFrontTabId && t.readerMode) ? (
          <ReaderView
            tab={activeTabGroup.tabs.find((t) => t.id === activeTabGroup.glanceFrontTabId)!}
            className="absolute top-0 bottom-0 left-[7.5%] w-[85%]"
          />
        ) : null
      ) : focusedTab?.readerMode ? (
        <ReaderView tab={focusedTab} className="absolute inset-0" />
      ) : null}
    </div>
  );
}

// Use memo to prevent unnecessary re-renders
export default memo(BrowserContent);
