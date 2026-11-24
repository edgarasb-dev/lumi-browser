import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { motion } from "motion/react";
import type { PinnedTabData } from "~/types/pinned-tabs";
import type { TabData } from "~/types/tabs";
import {
  isFolderTabSource,
  isPinnedTabSource,
  isTabGroupSource
} from "@/components/browser-ui/browser-sidebar/_components/drag-utils";
import { PinnedTabBadge, usePinnedTabPresentation } from "./pinned-tab-presentation";
import type { PinGridDensity } from "./normal/use-pin-grid-columns";
import "./pin.css";

// Drag source type for pinned tab reordering
export type PinnedTabSourceData = {
  type: "pinned-tab";
  pinnedTabId: string;
  profileId: string;
  position: number;
};

interface PinnedTabButtonProps {
  pinnedTab: PinnedTabData;
  associatedTab?: TabData;
  profileId: string | null;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: () => void;
  onReorder: (pinnedTabId: string, newPosition: number) => void;
  onCreateFromTab: (tabId: number, position: number) => void;
  pinnedTabs: PinnedTabData[];
  /** Index of this pin in the list, used for edge-change reporting. */
  index: number;
  /** Called when the closest-edge changes during a drag over this pin. */
  onEdgeChange: (index: number, edge: "left" | "right" | null) => void;
  /** Normalized edge indicator controlled by the parent grid. */
  activeEdge?: "left" | "right";
  /** True when this pin is the first item in its grid row. */
  isFirstInRow?: boolean;
  /** True when this pin is the last item in its grid row. */
  isLastInRow?: boolean;
  /** When false, layout position changes are applied instantly (no spring animation). */
  layoutAnimationsEnabled?: boolean;
  /** Fluid pin tile density derived from total pin count and sidebar width. */
  density?: PinGridDensity;
}

export function PinnedTabButton({
  pinnedTab,
  associatedTab,
  profileId,
  isActive,
  onClick,
  onDoubleClick,
  onContextMenu,
  onReorder,
  onCreateFromTab,
  pinnedTabs,
  index,
  onEdgeChange,
  activeEdge,
  isFirstInRow = false,
  isLastInRow = false,
  layoutAnimationsEnabled = true,
  density = "comfortable"
}: PinnedTabButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { faviconUrl, handleImageError, hasColors, activeBorderStyle, activeOverlayStyle, unreadCount, tooltipTitle } =
    usePinnedTabPresentation({
      pinnedTab,
      associatedTab,
      isActive
    });
  const [isDragging, setIsDragging] = useState(false);

  // Drag-and-drop for reordering
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const dragCleanup = draggable({
      element: el,
      getInitialData: () => {
        const data: PinnedTabSourceData = {
          type: "pinned-tab",
          pinnedTabId: pinnedTab.uniqueId,
          profileId: pinnedTab.profileId,
          position: pinnedTab.position
        };
        return data;
      },
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false)
    });

    const dropCleanup = dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        const data = source.data;
        if (isPinnedTabSource(data)) {
          return !profileId || data.profileId === profileId;
        }
        if (isTabGroupSource(data) || isFolderTabSource(data)) {
          // Only accept tabs from the same profile
          return !profileId || data.profileId === profileId;
        }
        return false;
      },
      getData: ({ input, element }) => {
        return attachClosestEdge({}, { input, element, allowedEdges: ["left", "right"] });
      },
      onDragEnter: ({ self }) => {
        onEdgeChange(index, extractClosestEdge(self.data) as "left" | "right" | null);
      },
      onDrag: ({ self }) => {
        onEdgeChange(index, extractClosestEdge(self.data) as "left" | "right" | null);
      },
      onDragLeave: () => {
        onEdgeChange(index, null);
      },
      onDrop: ({ source, self }) => {
        onEdgeChange(index, null);
        const sourceData = source.data;

        const edge = extractClosestEdge(self.data);
        if (!edge) return;

        // Calculate new position based on edge
        const targetIndex = pinnedTabs.findIndex((pt) => pt.uniqueId === pinnedTab.uniqueId);
        let newPosition: number;
        if (edge === "left") {
          newPosition = targetIndex - 0.5;
        } else {
          newPosition = targetIndex + 0.5;
        }

        if (isPinnedTabSource(sourceData)) {
          onReorder(sourceData.pinnedTabId, newPosition);
        } else if (isTabGroupSource(sourceData)) {
          onCreateFromTab(sourceData.primaryTabId, newPosition);
        } else if (isFolderTabSource(sourceData)) {
          onCreateFromTab(sourceData.tabId, newPosition);
        }
      }
    });

    return () => {
      dragCleanup();
      dropCleanup();
    };
  }, [
    pinnedTab.uniqueId,
    pinnedTab.profileId,
    pinnedTab.position,
    pinnedTabs,
    profileId,
    onReorder,
    onCreateFromTab,
    index,
    onEdgeChange
  ]);

  // Use onClick (not onMouseDown) so the browser's native click suppression
  // after a drag prevents the handler from firing on drag-to-reorder.
  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu();
    },
    [onContextMenu]
  );

  const [isPressed, setIsPressed] = useState(false);
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      // Only opt into layout projection while reorder/create animations run; keeping
      // `layout` enabled otherwise makes Motion measure every pin on unrelated updates
      // (e.g. active tab), which adds main-thread + compositor work on top of webview activation.
      layout={layoutAnimationsEnabled ? "position" : false}
      transition={{
        opacity: { duration: 0.18 },
        scale: { type: "spring", stiffness: 460, damping: 28 },
        layout: layoutAnimationsEnabled ? { type: "spring", stiffness: 500, damping: 35 } : { duration: 0 }
      }}
    >
      {/* Drop indicator - left */}
      {activeEdge === "left" && (
        <div
          className={cn(
            "absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-white/60",
            // On the first item in a row there is no gap to the left, so
            // render the indicator flush with the cell edge instead of
            // translating it outside (where it would be clipped).
            !isFirstInRow && "-translate-x-1"
          )}
        />
      )}
      {/* Drop indicator - right */}
      {activeEdge === "right" && (
        <div
          className={cn(
            "absolute right-0 top-1 bottom-1 w-0.5 rounded-full bg-white/60",
            !isLastInRow && "translate-x-1"
          )}
        />
      )}

      <motion.div
        ref={ref}
        data-pinned-tab-id={pinnedTab.uniqueId}
        title={tooltipTitle}
        // motion's whileTap does not work in a different document,
        // so we have to use our own state.
        onMouseDown={() => {
          setIsPressed(true);
          handleClick();
        }}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        animate={{ scale: isPressed ? 0.99 : 1 }}
        transition={{ scale: { type: "spring", stiffness: 600, damping: 20 } }}
        className={cn(
          "group/pin lumi-glass-sheen relative w-full overflow-hidden transform-gpu",
          density === "compact" ? "h-10 rounded-lg" : density === "balanced" ? "h-11 rounded-xl" : "h-12 rounded-xl",
          "bg-black/10 hover:bg-black/15",
          "dark:bg-white/15 dark:hover:bg-white/20",
          "transition-[background-color,border-color,box-shadow,opacity,height] duration-150 hover:shadow-xs",
          "flex items-center justify-center",
          isActive && !hasColors && "border-2 border-white",
          isActive && hasColors && "pinned-tab-active-border",
          isDragging && "opacity-40"
        )}
        style={activeBorderStyle}
        onDoubleClick={onDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <div className={cn("size-full", isActive && "bg-white/80 dark:bg-white/30")}>
          <div className={cn("size-full", "flex items-center justify-center")} style={activeOverlayStyle}>
            <div
              className={cn(
                "relative flex items-center justify-center transition-transform duration-200 ease-out group-hover/pin:scale-110",
                density === "compact" ? "size-4" : density === "balanced" ? "size-4.5" : "size-5"
              )}
            >
              {faviconUrl ? (
                <>
                  <img
                    src={faviconUrl}
                    alt=""
                    onError={handleImageError}
                    className={cn(
                      "absolute rounded-sm user-drag-none object-contain overflow-hidden",
                      density === "compact" ? "size-4" : density === "balanced" ? "size-4.5" : "size-5"
                    )}
                  />
                  <div className="img-container">
                    <img src={faviconUrl} alt="" onError={handleImageError} className="user-drag-none" />
                  </div>
                </>
              ) : (
                <Globe
                  className={cn("text-black/55 dark:text-white/75", density === "compact" ? "size-3.5" : "size-4.5")}
                />
              )}
            </div>
          </div>
        </div>
        <PinnedTabBadge count={unreadCount} variant={density === "compact" ? "tile-compact" : "tile"} />
      </motion.div>
    </motion.div>
  );
}
