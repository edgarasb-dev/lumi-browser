import { cn, craftActiveFaviconURL } from "@/lib/utils";
import { XIcon, Volume2, VolumeX, Folder, ChevronDown, ChevronRight } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { TabGroup as TabGroupType } from "@/components/providers/tabs-provider";
import type { TabData } from "~/types/tabs";
import {
  draggable,
  dropTargetForElements,
  ElementDropTargetEventBasePayload
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge, Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { DropIndicator } from "@/components/browser-ui/browser-sidebar/_components/drop-indicator";
import { isPinnedTabSource } from "@/components/browser-ui/browser-sidebar/_components/drag-utils";
import { TabPreviewCard } from "@/components/browser-ui/browser-sidebar/_components/tab-preview-card";

/** Greater than 1 speeds up tab-group enter, exit, and layout motion. */
const TAB_GROUP_MOTION_SPEED_MULTIPLIER = 2;

// --- Types --- //

export type TabGroupSourceData = {
  type: "tab-group";
  tabGroupId: string;
  primaryTabId: number;
  profileId: string;
  spaceId: string;
  position: number;
};

function renderTabGroupDragPreview({
  container,
  element,
  isSpaceLight
}: {
  container: HTMLElement;
  element: HTMLElement;
  isSpaceLight: boolean;
}) {
  const clone = element.cloneNode(true) as HTMLElement;
  const { width, height } = element.getBoundingClientRect();

  Object.assign(container.style, {
    background: "transparent"
  });
  container.classList.toggle("dark", !isSpaceLight);

  Object.assign(clone.style, {
    width: `${width}px`,
    height: `${height}px`,
    margin: "0",
    transform: "none",
    pointerEvents: "none"
  });

  container.append(clone);

  return () => {
    container.removeChild(clone);
  };
}

// --- SidebarTab (memoized) --- //

interface SidebarTabProps {
  tab: TabData;
  isFocused: boolean;
}

const SidebarTab = memo(
  function SidebarTab({ tab, isFocused }: SidebarTabProps) {
    const [cachedFaviconUrl, setCachedFaviconUrl] = useState<string | null>(tab.faviconURL);
    const [isError, setIsError] = useState(false);
    const noFavicon = !cachedFaviconUrl || isError;

    const isMuted = tab.muted;
    const isPlayingAudio = tab.audible;

    useEffect(() => {
      if (tab.faviconURL) {
        setCachedFaviconUrl(tab.faviconURL);
      } else {
        setCachedFaviconUrl(null);
      }
      setIsError(false);
    }, [tab.faviconURL]);

    const handleClick = useCallback(() => {
      if (!tab.id) return;
      lumi.tabs.switchToTab(tab.id);
    }, [tab.id]);

    const handleCloseTab = useCallback(
      (e: React.MouseEvent) => {
        if (!tab.id) return;
        e.preventDefault();
        lumi.tabs.closeTab(tab.id);
      },
      [tab.id]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (e.button === 0) {
          handleClick();
        }
        if (e.button === 1) {
          handleCloseTab(e);
        }
      },
      [handleClick, handleCloseTab]
    );

    const handleToggleMute = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!tab.id) return;
        const newMutedState = !tab.muted;
        lumi.tabs.setTabMuted(tab.id, newMutedState);
      },
      [tab.id, tab.muted]
    );

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        lumi.tabs.showContextMenu(tab.id);
      },
      [tab.id]
    );

    const VolumeIcon = isMuted ? VolumeX : Volume2;

    const [isPressed, setIsPressed] = useState(false);
    const tabRef = useRef<HTMLDivElement>(null);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = useCallback(() => {
      if (isFocused) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        if (tabRef.current) {
          setAnchorRect(tabRef.current.getBoundingClientRect());
          setIsPreviewOpen(true);
        }
      }, 350);
    }, [isFocused]);

    const handleMouseLeave = useCallback(() => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      setIsPreviewOpen(false);
      setIsPressed(false);
    }, []);

    useEffect(() => {
      return () => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      };
    }, []);

    useEffect(() => {
      if (isFocused) {
        setIsPreviewOpen(false);
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      }
    }, [isFocused]);

    return (
      <>
        <motion.div
          ref={tabRef}
          onContextMenu={handleContextMenu}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          // motion's whileTap does not work in a different document,
          // so we have to use our own state.
          onMouseDown={(e) => {
            setIsPressed(true);
            setIsPreviewOpen(false);
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            handleMouseDown(e);
          }}
          onMouseUp={() => setIsPressed(false)}
          animate={{ scale: isPressed ? 0.99 : 1 }}
          transition={{ scale: { type: "spring", stiffness: 600, damping: 20 } }}
          className={cn(
            "group/tab h-9 w-full rounded-lg overflow-hidden min-w-0",
            "flex items-center gap-2 px-2",
            "transition-[background-color]",
            !isFocused && "hover:bg-black/10 dark:hover:bg-white/10",
            isFocused && "bg-white/90 dark:bg-white/15"
          )}
        >
          {/* Left side: favicon + audio + title */}
          <div className="flex flex-row items-center flex-1 min-w-0">
            {/* Favicon */}
            <div className="size-4 shrink-0 mr-1">
              {!noFavicon && (
                <img
                  src={craftActiveFaviconURL(tab.id, tab.faviconURL)}
                  alt={tab.title}
                  className={cn("size-full rounded-sm object-contain overflow-hidden", tab.asleep && "grayscale")}
                  style={{ userSelect: "none", WebkitUserDrag: "none" } as React.CSSProperties}
                  onError={() => setIsError(true)}
                />
              )}
              {noFavicon && <div className="size-full bg-gray-300 dark:bg-gray-300/30 rounded-sm" />}
            </div>

            {/* Audio Indicator */}
            <AnimatePresence initial={false}>
              {(isPlayingAudio || isMuted) && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: "auto" }}
                  exit={{ opacity: 0, scale: 0.8, width: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center overflow-hidden shrink-0"
                  onClick={handleToggleMute}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="size-5 flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/10">
                    <VolumeIcon className={cn("size-3.5", "text-black/50 dark:text-white/50")} />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Title */}
            <span
              className={cn(
                "ml-1 truncate min-w-0 flex-1 text-sm font-medium",
                tab.asleep ? "text-black/50 dark:text-white/50" : "text-black/90 dark:text-white/90"
              )}
            >
              {tab.title}
            </span>

            {/* Asleep indicator */}
            {tab.asleep && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 shrink-0 group-hover/tab:hidden"
                title="Tab is sleeping to save memory"
              >
                Zzz
              </span>
            )}
          </div>

          {/* Right side: close button */}
          <div className="shrink-0 items-center hidden group-hover/tab:flex">
            <button
              className={cn(
                "size-5.5 shrink-0 rounded-sm p-0.5",
                "hover:bg-black/10 dark:hover:bg-white/10",
                "active:bg-black/15 dark:active:bg-white/15",
                "opacity-0 pointer-events-none transition-opacity",
                "group-hover/tab:opacity-100 group-hover/tab:pointer-events-auto"
              )}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleCloseTab}
            >
              <XIcon className="size-4.5 text-black/60 dark:text-white/60" />
            </button>
          </div>
        </motion.div>

        <TabPreviewCard
          tab={tab}
          anchorRect={anchorRect}
          isOpen={isPreviewOpen && !isFocused}
          onClose={() => setIsPreviewOpen(false)}
          onSwitchTab={() => {
            setIsPreviewOpen(false);
            handleClick();
          }}
          onCloseTab={() => {
            setIsPreviewOpen(false);
            if (tab.id) lumi.tabs.closeTab(tab.id);
          }}
          onToggleMute={() => {
            if (tab.id) lumi.tabs.setTabMuted(tab.id, !tab.muted);
          }}
        />
      </>
    );
  },
  // The provider preserves tab object references for unchanged tabs.
  (prev, next) => {
    return prev.isFocused === next.isFocused && prev.tab === next.tab;
  }
);

// --- TabGroup (memoized, with drag-and-drop) --- //

interface TabGroupProps {
  tabGroup: TabGroupType;
  isActive: boolean;
  isFocused: boolean;
  isSpaceLight: boolean;
  position: number;
  groupCount: number;
  moveTab: (tabId: number, newPosition: number) => void;
  unpinToTabList: (pinnedTabId: string, position?: number) => Promise<boolean>;
}

export const TabGroup = memo(
  function TabGroup({ tabGroup, isFocused, isSpaceLight, position, moveTab, unpinToTabList }: TabGroupProps) {
    const { tabs, focusedTab } = tabGroup;
    const ref = useRef<HTMLDivElement>(null);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
    const isMultiTabGroup = tabs.length > 1;
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
      if (isFocused && isCollapsed) {
        setIsCollapsed(false);
      }
    }, [isFocused, isCollapsed]);

    // Extract stable primitives for the drag-and-drop effect dependencies.
    // Previously, tabGroup.tabs (a new array each render) was in the dep array,
    // causing the effect to re-run on every tab data update.
    const primaryTabId = tabs[0]?.id;

    useEffect(() => {
      const el = ref.current;
      if (!el) return () => {};

      function onChange({ self }: ElementDropTargetEventBasePayload) {
        const edge = extractClosestEdge(self.data);
        setClosestEdge(edge);
      }

      function onDrop(args: ElementDropTargetEventBasePayload) {
        const closestEdgeOfTarget: Edge | null = extractClosestEdge(args.self.data);
        setClosestEdge(null);

        const sourceData = args.source.data;

        // Handle pinned tab drops — unpin to tab list at the drop position
        if (isPinnedTabSource(sourceData)) {
          let newPos: number;
          if (closestEdgeOfTarget === "top") {
            newPos = position - 0.5;
          } else {
            newPos = position + 0.5;
          }
          unpinToTabList(sourceData.pinnedTabId, newPos);
          return;
        }

        const tabGroupData = sourceData as TabGroupSourceData;
        const sourceTabId = tabGroupData.primaryTabId;

        let newPos: number | undefined = undefined;

        if (closestEdgeOfTarget === "top") {
          newPos = position - 0.5;
        } else if (closestEdgeOfTarget === "bottom") {
          newPos = position + 0.5;
        }

        if (tabGroupData.spaceId !== tabGroup.spaceId) {
          if (tabGroupData.profileId !== tabGroup.profileId) {
            // TODO: @MOVE_TABS_BETWEEN_PROFILES not supported yet
          } else {
            lumi.tabs.moveTabToWindowSpace(sourceTabId, tabGroup.spaceId, newPos);
          }
        } else if (newPos !== undefined) {
          moveTab(sourceTabId, newPos);
        }
      }

      const draggableCleanup = draggable({
        element: el,
        getInitialData: () => {
          const data: TabGroupSourceData = {
            type: "tab-group",
            tabGroupId: tabGroup.id,
            primaryTabId: primaryTabId,
            profileId: tabGroup.profileId,
            spaceId: tabGroup.spaceId,
            position: position
          };
          return data;
        },
        onGenerateDragPreview: ({ nativeSetDragImage, location }) => {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({
              element: el,
              input: location.current.input
            }),
            render: ({ container }) => renderTabGroupDragPreview({ container, element: el, isSpaceLight })
          });
        }
      });

      const cleanupDropTarget = dropTargetForElements({
        element: el,
        getData: ({ input, element }) => {
          return attachClosestEdge(
            {},
            {
              input,
              element,
              allowedEdges: ["top", "bottom"]
            }
          );
        },
        canDrop: (args) => {
          const sourceData = args.source.data;

          // Accept pinned tab drags (for unpinning)
          if (isPinnedTabSource(sourceData)) {
            return sourceData.profileId === tabGroup.profileId;
          }

          const tabGroupData = sourceData as TabGroupSourceData;
          if (tabGroupData.type !== "tab-group") {
            return false;
          }
          if (tabGroupData.tabGroupId === tabGroup.id) {
            return false;
          }
          if (tabGroupData.profileId !== tabGroup.profileId) {
            return false;
          }
          return true;
        },
        onDrop: onDrop,
        onDragEnter: onChange,
        onDrag: onChange,
        onDragLeave: () => setClosestEdge(null)
      });

      return () => {
        draggableCleanup();
        cleanupDropTarget();
      };
    }, [
      moveTab,
      unpinToTabList,
      tabGroup.id,
      position,
      primaryTabId,
      tabGroup.spaceId,
      tabGroup.profileId,
      isSpaceLight
    ]);

    return (
      <motion.div
        layout="position"
        initial={{ opacity: 0, height: 0 }}
        animate={{
          opacity: 1,
          height: "auto",
          transitionEnd: { overflow: "visible" }
        }}
        exit={{ opacity: 0, height: 0, overflow: "hidden" }}
        transition={{
          layout: {
            type: "spring",
            stiffness: 500 * TAB_GROUP_MOTION_SPEED_MULTIPLIER,
            damping: 35 * TAB_GROUP_MOTION_SPEED_MULTIPLIER
          },
          height: {
            type: "tween",
            duration: 0.2 / TAB_GROUP_MOTION_SPEED_MULTIPLIER,
            ease: "easeOut"
          },
          opacity: { duration: 0.15 / TAB_GROUP_MOTION_SPEED_MULTIPLIER }
        }}
        style={{ overflow: "hidden" }}
        className="relative flex flex-col gap-0.5"
        ref={ref}
      >
        {closestEdge === "top" && (
          <div className="absolute top-0 left-0 right-0 -translate-y-1/2 z-elevated pointer-events-none">
            <DropIndicator isSpaceLight={isSpaceLight} />
          </div>
        )}
        {isMultiTabGroup && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsCollapsed((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsCollapsed((prev) => !prev);
              }
            }}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer select-none",
              "text-black/60 dark:text-white/60 hover:text-black/90 dark:hover:text-white/90",
              "hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            )}
          >
            {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            <Folder className="size-3.5 text-amber-500/80" />
            <span className="truncate flex-1">Tab Group</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-semibold tabular-nums">
              {tabs.length}
            </span>
          </div>
        )}
        <AnimatePresence initial={false}>
          {(!isCollapsed || !isMultiTabGroup) && (
            <motion.div
              initial={isMultiTabGroup ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "flex flex-col gap-0.5",
                isMultiTabGroup && "pl-2 border-l border-black/10 dark:border-white/10 ml-2"
              )}
            >
              {tabs.map((tab) => (
                <SidebarTab key={tab.id} tab={tab} isFocused={isFocused && focusedTab?.id === tab.id} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {closestEdge === "bottom" && (
          <div className="absolute bottom-0 left-0 right-0 translate-y-1/2 z-elevated pointer-events-none">
            <DropIndicator isSpaceLight={isSpaceLight} />
          </div>
        )}
      </motion.div>
    );
  },
  // TabGroup references are stabilized by TabsProvider cache.
  (prev, next) => {
    return (
      prev.tabGroup === next.tabGroup &&
      prev.isActive === next.isActive &&
      prev.isFocused === next.isFocused &&
      prev.isSpaceLight === next.isSpaceLight &&
      prev.position === next.position &&
      prev.groupCount === next.groupCount &&
      prev.moveTab === next.moveTab &&
      prev.unpinToTabList === next.unpinToTabList
    );
  }
);
