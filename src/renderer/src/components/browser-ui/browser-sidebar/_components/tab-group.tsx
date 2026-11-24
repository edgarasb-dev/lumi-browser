import { cn, craftActiveFaviconURL } from "@/lib/utils";
import { getTabUnreadCount } from "@/lib/unread-badge";
import {
  XIcon,
  VolumeX,
  Folder,
  ChevronDown,
  Columns2,
  Rows2,
  Layers,
  ArrowLeftRight,
  Ungroup,
  Maximize2
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AudioVisualizerBars } from "@/components/ui/audio-visualizer";
import type { TabGroup as TabGroupType } from "@/components/providers/tabs-provider";
import type { FolderColorId, TabData, TabGroupMode } from "~/types/tabs";
import {
  draggable,
  dropTargetForElements,
  ElementDropTargetEventBasePayload
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge, Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { DropIndicator } from "@/components/browser-ui/browser-sidebar/_components/drop-indicator";
import {
  isFolderTabSource,
  isPinnedTabSource,
  isTabGroupSource
} from "@/components/browser-ui/browser-sidebar/_components/drag-utils";
import { TabPreviewCard } from "@/components/browser-ui/browser-sidebar/_components/tab-preview-card";

/** Greater than 1 speeds up tab-group enter, exit, and layout motion. */
const TAB_GROUP_MOTION_SPEED_MULTIPLIER = 2;

const FOLDER_CARD_CLASSES: Record<FolderColorId, string> = {
  neutral: "bg-black/[0.045] dark:bg-white/[0.06] border-black/[0.07] dark:border-white/[0.09]",
  amber: "bg-amber-500/[0.11] dark:bg-amber-400/[0.11] border-amber-500/20 dark:border-amber-300/18",
  blue: "bg-sky-500/[0.10] dark:bg-sky-400/[0.11] border-sky-500/20 dark:border-sky-300/18",
  violet: "bg-violet-500/[0.10] dark:bg-violet-400/[0.11] border-violet-500/20 dark:border-violet-300/18",
  emerald: "bg-emerald-500/[0.10] dark:bg-emerald-400/[0.11] border-emerald-500/20 dark:border-emerald-300/18",
  rose: "bg-rose-500/[0.10] dark:bg-rose-400/[0.11] border-rose-500/20 dark:border-rose-300/18"
};

// --- Types --- //

export type TabGroupSourceData = {
  type: "tab-group";
  tabGroupId: string;
  mode: TabGroupMode;
  primaryTabId: number;
  profileId: string;
  spaceId: string;
  position: number;
};

export type FolderTabSourceData = {
  type: "folder-tab";
  tabId: number;
  folderGroupId: string;
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

function getSourceSingleTabId(
  sourceData: Record<string, unknown>
): { tabId: number; profileId: string; spaceId: string } | null {
  if (isFolderTabSource(sourceData)) {
    return { tabId: sourceData.tabId, profileId: sourceData.profileId, spaceId: sourceData.spaceId };
  }
  if (isTabGroupSource(sourceData) && sourceData.mode === "normal") {
    return { tabId: sourceData.primaryTabId, profileId: sourceData.profileId, spaceId: sourceData.spaceId };
  }
  return null;
}

// --- SidebarTab (memoized) --- //

interface SidebarTabProps {
  tab: TabData;
  isFocused: boolean;
  isSpaceLight: boolean;
  inFolder?: boolean;
  folderGroupId?: string;
  activeTabLayoutId?: string;
  moveTab: (tabId: number, newPosition: number) => void;
}

const SidebarTab = memo(
  function SidebarTab({
    tab,
    isFocused,
    isSpaceLight,
    inFolder = false,
    folderGroupId,
    activeTabLayoutId,
    moveTab
  }: SidebarTabProps) {
    const [cachedFaviconUrl, setCachedFaviconUrl] = useState<string | null>(tab.faviconURL);
    const [isError, setIsError] = useState(false);
    const noFavicon = !cachedFaviconUrl || isError;

    const isMuted = tab.muted;
    const isPlayingAudio = tab.audible;
    const showUnreadDot = !isFocused && (Boolean(tab.hasUnseenUpdate) || getTabUnreadCount(tab) !== null);

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
        lumi.tabs.setTabMuted(tab.id, !tab.muted);
      },
      [tab.id, tab.muted]
    );

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        lumi.tabs.showContextMenu(tab.id);
      },
      [tab.id]
    );

    const [isPressed, setIsPressed] = useState(false);
    const tabRef = useRef<HTMLDivElement>(null);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [closestChildEdge, setClosestChildEdge] = useState<Edge | null>(null);
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

    // Enable per-tab dragging & reordering when inside a Folder
    useEffect(() => {
      const el = tabRef.current;
      if (!el || !inFolder || !folderGroupId) return () => {};

      const cleanupDrag = draggable({
        element: el,
        getInitialData: (): FolderTabSourceData => ({
          type: "folder-tab",
          tabId: tab.id,
          folderGroupId,
          profileId: tab.profileId,
          spaceId: tab.spaceId,
          position: tab.position
        }),
        onGenerateDragPreview: ({ nativeSetDragImage, location }) => {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({ element: el, input: location.current.input }),
            render: ({ container }) => renderTabGroupDragPreview({ container, element: el, isSpaceLight })
          });
        }
      });

      const cleanupDrop = dropTargetForElements({
        element: el,
        getData: ({ input, element }) => attachClosestEdge({}, { input, element, allowedEdges: ["top", "bottom"] }),
        canDrop: ({ source }) => {
          const single = getSourceSingleTabId(source.data);
          if (!single) return false;
          return single.profileId === tab.profileId && single.tabId !== tab.id;
        },
        onDragEnter: ({ self }) => setClosestChildEdge(extractClosestEdge(self.data)),
        onDrag: ({ self }) => setClosestChildEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestChildEdge(null),
        onDrop: ({ source, self }) => {
          const edge = extractClosestEdge(self.data);
          setClosestChildEdge(null);
          const single = getSourceSingleTabId(source.data);
          if (!single || !edge) return;

          const newPos = edge === "top" ? tab.position - 0.5 : tab.position + 0.5;
          if (isFolderTabSource(source.data) && source.data.folderGroupId === folderGroupId) {
            moveTab(single.tabId, newPos);
          } else {
            void lumi.tabs.addTabToFolder(folderGroupId, single.tabId, newPos);
          }
        }
      });

      return () => {
        cleanupDrag();
        cleanupDrop();
      };
    }, [inFolder, folderGroupId, tab.id, tab.profileId, tab.spaceId, tab.position, isSpaceLight, moveTab]);

    const showCloseAlways = inFolder && isFocused;

    return (
      <div className="relative">
        {closestChildEdge === "top" && (
          <div className="absolute top-0 left-0 right-0 -translate-y-1/2 z-elevated pointer-events-none">
            <DropIndicator isSpaceLight={isSpaceLight} />
          </div>
        )}

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
            "group/tab relative h-9 w-full overflow-hidden min-w-0",
            inFolder ? "rounded-lg px-2" : "rounded-xl px-2.5",
            "flex items-center gap-2",
            "transition-[background-color,box-shadow] duration-150",
            !isFocused && "hover:bg-black/[0.06] dark:hover:bg-white/[0.09]"
          )}
        >
          {isFocused && (
            <motion.div
              layoutId={activeTabLayoutId ?? `sidebar-active-tab-${tab.spaceId}`}
              transition={{ type: "spring", stiffness: 520, damping: 36 }}
              className={cn(
                "pointer-events-none absolute inset-0 z-0",
                inFolder ? "rounded-lg" : "rounded-xl",
                "bg-white/92 dark:bg-white/[0.17] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-black/[0.06] dark:ring-white/[0.14]"
              )}
            />
          )}

          {/* Left side: favicon + title (strictly uniform horizontal alignment) */}
          <div className="relative z-10 flex flex-row items-center flex-1 min-w-0">
            <div className="size-4 shrink-0 mr-1.5">
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

            <span
              className={cn(
                "truncate min-w-0 flex-1 text-sm font-medium",
                tab.asleep ? "text-black/50 dark:text-white/50" : "text-black/90 dark:text-white/90"
              )}
            >
              {tab.title}
            </span>
          </div>

          {/* Right side: unread dot, asleep badge, audio toggle, close button */}
          <div className="relative z-10 shrink-0 flex items-center gap-1 ml-1">
            {showUnreadDot && (
              <span
                title="Updated in background"
                className="lumi-soft-breathe size-1.5 rounded-full bg-primary dark:bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.65)] shrink-0 group-hover/tab:hidden"
              />
            )}

            {tab.asleep && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 shrink-0 group-hover/tab:hidden"
                title="Tab is sleeping to save memory"
              >
                Zzz
              </span>
            )}

            <AnimatePresence initial={false}>
              {(isPlayingAudio || isMuted) && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.78 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.78 }}
                  transition={{ type: "spring", stiffness: 520, damping: 28 }}
                  type="button"
                  className="size-5 flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 transition-transform shrink-0 cursor-pointer"
                  onClick={handleToggleMute}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={isMuted ? "Unmute tab" : "Mute tab"}
                >
                  {isMuted ? (
                    <VolumeX className="size-3.5 text-black/55 dark:text-white/60" />
                  ) : (
                    <AudioVisualizerBars active={isPlayingAudio} />
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            <div className={cn("shrink-0 items-center", showCloseAlways ? "flex" : "hidden group-hover/tab:flex")}>
              <button
                type="button"
                className={cn(
                  "size-5.5 shrink-0 rounded-sm p-0.5 flex items-center justify-center",
                  "hover:bg-black/10 dark:hover:bg-white/10",
                  "active:bg-black/15 dark:active:bg-white/15 active:scale-90",
                  showCloseAlways
                    ? "opacity-75 hover:opacity-100 transition-[opacity,transform] duration-150"
                    : "opacity-0 scale-90 pointer-events-none transition-[opacity,transform] duration-150 group-hover/tab:opacity-100 group-hover/tab:scale-100 group-hover/tab:pointer-events-auto"
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleCloseTab}
                title="Close Tab"
              >
                <XIcon className="size-4 text-black/60 dark:text-white/60" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isFocused && tab.isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-none absolute inset-x-2 bottom-0 z-10 h-[1.5px] overflow-hidden rounded-full"
              >
                <div className="lumi-loading-sheen h-full w-1/2 rounded-full bg-linear-to-r from-transparent via-primary/80 to-transparent dark:via-white/80" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {closestChildEdge === "bottom" && (
          <div className="absolute bottom-0 left-0 right-0 translate-y-1/2 z-elevated pointer-events-none">
            <DropIndicator isSpaceLight={isSpaceLight} />
          </div>
        )}

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
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.isFocused === next.isFocused &&
      prev.tab === next.tab &&
      prev.isSpaceLight === next.isSpaceLight &&
      prev.inFolder === next.inFolder &&
      prev.folderGroupId === next.folderGroupId &&
      prev.activeTabLayoutId === next.activeTabLayoutId &&
      prev.moveTab === next.moveTab
    );
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
  activeTabLayoutId?: string;
  moveTab: (tabId: number, newPosition: number) => void;
  unpinToTabList: (pinnedTabId: string, position?: number) => Promise<boolean>;
}

export const TabGroup = memo(
  function TabGroup({
    tabGroup,
    isFocused,
    isSpaceLight,
    position,
    activeTabLayoutId,
    moveTab,
    unpinToTabList
  }: TabGroupProps) {
    const { tabs, focusedTab } = tabGroup;
    const ref = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
    const [isDropIntoFolder, setIsDropIntoFolder] = useState(false);

    const isFolder = tabGroup.mode === "folder";
    const isMultiTabGroup = !isFolder && tabs.length > 1;
    const [localCollapsed, setLocalCollapsed] = useState(false);
    const isCollapsed = isFolder ? Boolean(tabGroup.collapsed) : localCollapsed;

    const [isEditingName, setIsEditingName] = useState(false);
    const [draftName, setDraftName] = useState(tabGroup.name || "Folder");
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (!isEditingName) {
        setDraftName(tabGroup.name || "Folder");
      }
    }, [tabGroup.name, isEditingName]);

    useEffect(() => {
      if (isEditingName) {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }
    }, [isEditingName]);

    useEffect(() => {
      if (!isFolder && isFocused && localCollapsed) {
        setLocalCollapsed(false);
      }
    }, [isFolder, isFocused, localCollapsed]);

    const commitRename = useCallback(() => {
      setIsEditingName(false);
      const trimmed = draftName.trim();
      if (trimmed && trimmed !== (tabGroup.name || "Folder")) {
        void lumi.tabs.renameFolder(tabGroup.id, trimmed);
      } else {
        setDraftName(tabGroup.name || "Folder");
      }
    }, [draftName, tabGroup.id, tabGroup.name]);

    const toggleCollapse = useCallback(() => {
      if (isEditingName) return;
      if (isFolder) {
        void lumi.tabs.setFolderCollapsed(tabGroup.id, !isCollapsed);
      } else {
        setLocalCollapsed((prev) => !prev);
      }
    }, [isEditingName, isFolder, isCollapsed, tabGroup.id]);

    const primaryTabId = tabs[0]?.id;
    const firstPosition = tabs[0]?.position ?? position;
    const lastPosition = tabs[tabs.length - 1]?.position ?? position;

    // Folder header dedicated drop target: dropping single tabs onto the header always adds into the folder
    useEffect(() => {
      const headerEl = headerRef.current;
      if (!headerEl || !isFolder) return () => {};

      return dropTargetForElements({
        element: headerEl,
        canDrop: ({ source }) => {
          const single = getSourceSingleTabId(source.data);
          if (!single) return false;
          if (single.profileId !== tabGroup.profileId) return false;
          if (isFolderTabSource(source.data) && source.data.folderGroupId === tabGroup.id) return false;
          return true;
        },
        onDragEnter: () => setIsDropIntoFolder(true),
        onDragLeave: () => setIsDropIntoFolder(false),
        onDrop: ({ source }) => {
          setIsDropIntoFolder(false);
          const single = getSourceSingleTabId(source.data);
          if (!single) return;
          void lumi.tabs.addTabToFolder(tabGroup.id, single.tabId);
        }
      });
    }, [isFolder, tabGroup.id, tabGroup.profileId]);

    useEffect(() => {
      const el = ref.current;
      if (!el) return () => {};

      function onChange({ source, self, location }: ElementDropTargetEventBasePayload) {
        // Defer to innermost child drop target (folder header or child SidebarTab) if active
        if (location.current.dropTargets[0]?.element !== el) {
          setClosestEdge(null);
          return;
        }

        // For collapsed folders or folder edges, check if a single tab is hovering middle vs top/bottom
        const edge = extractClosestEdge(self.data);
        if (isFolder && isCollapsed && getSourceSingleTabId(source.data)) {
          const rect = el!.getBoundingClientRect();
          const relY = (location.current.input.clientY - rect.top) / Math.max(1, rect.height);
          if (relY > 0.24 && relY < 0.76) {
            setClosestEdge(null);
            setIsDropIntoFolder(true);
            return;
          }
          setIsDropIntoFolder(false);
        }
        setClosestEdge(edge);
      }

      function onDrop(args: ElementDropTargetEventBasePayload) {
        if (args.location.current.dropTargets[0]?.element !== el) {
          setClosestEdge(null);
          setIsDropIntoFolder(false);
          return;
        }

        const closestEdgeOfTarget: Edge | null = extractClosestEdge(args.self.data);
        const wasDropIntoFolder = isDropIntoFolder;
        setClosestEdge(null);
        setIsDropIntoFolder(false);

        const sourceData = args.source.data;
        const single = getSourceSingleTabId(sourceData);

        if (isFolder && isCollapsed && wasDropIntoFolder && single) {
          void lumi.tabs.addTabToFolder(tabGroup.id, single.tabId);
          return;
        }

        const newPos = closestEdgeOfTarget === "top" ? firstPosition - 0.5 : lastPosition + 0.5;

        // Handle pinned tab drops — unpin to tab list at the drop position
        if (isPinnedTabSource(sourceData)) {
          void unpinToTabList(sourceData.pinnedTabId, newPos);
          return;
        }

        // Pulling a tab out of a folder onto another group/loose row edge
        if (isFolderTabSource(sourceData)) {
          if (sourceData.folderGroupId === tabGroup.id) return;
          if (sourceData.profileId !== tabGroup.profileId) return;
          if (isFolder) {
            void lumi.tabs.addTabToFolder(tabGroup.id, sourceData.tabId, newPos);
          } else {
            void lumi.tabs.removeTabFromFolder(sourceData.tabId, newPos);
          }
          return;
        }

        if (!isTabGroupSource(sourceData)) return;

        // Dropping an entire folder or grouped unit
        if (sourceData.mode === "folder" || sourceData.mode === "split" || sourceData.mode === "glance") {
          if (sourceData.spaceId !== tabGroup.spaceId) {
            if (sourceData.profileId === tabGroup.profileId) {
              void lumi.tabs.moveTabGroupToSpace(sourceData.tabGroupId, tabGroup.spaceId, newPos);
            }
          } else {
            void lumi.tabs.moveTabGroup(sourceData.tabGroupId, newPos);
          }
          return;
        }

        const sourceTabId = sourceData.primaryTabId;
        if (sourceData.spaceId !== tabGroup.spaceId) {
          if (sourceData.profileId === tabGroup.profileId) {
            void lumi.tabs.moveTabToWindowSpace(sourceTabId, tabGroup.spaceId, newPos);
          }
        } else {
          moveTab(sourceTabId, newPos);
        }
      }

      const draggableCleanup = draggable({
        element: el,
        canDrag: () => !isEditingName,
        getInitialData: (): TabGroupSourceData => ({
          type: "tab-group",
          tabGroupId: tabGroup.id,
          mode: tabGroup.mode,
          primaryTabId: primaryTabId,
          profileId: tabGroup.profileId,
          spaceId: tabGroup.spaceId,
          position: firstPosition
        }),
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
        getData: ({ input, element }) => attachClosestEdge({}, { input, element, allowedEdges: ["top", "bottom"] }),
        canDrop: (args) => {
          const sourceData = args.source.data;

          if (isPinnedTabSource(sourceData)) {
            return sourceData.profileId === tabGroup.profileId;
          }

          if (isFolderTabSource(sourceData)) {
            if (sourceData.folderGroupId === tabGroup.id) return false;
            return sourceData.profileId === tabGroup.profileId;
          }

          if (!isTabGroupSource(sourceData)) return false;
          if (sourceData.tabGroupId === tabGroup.id) return false;
          if (sourceData.profileId !== tabGroup.profileId) return false;
          return true;
        },
        onDrop,
        onDragEnter: onChange,
        onDrag: onChange,
        onDragLeave: () => {
          setClosestEdge(null);
          setIsDropIntoFolder(false);
        }
      });

      return () => {
        draggableCleanup();
        cleanupDropTarget();
      };
    }, [
      moveTab,
      unpinToTabList,
      tabGroup.id,
      tabGroup.mode,
      firstPosition,
      lastPosition,
      primaryTabId,
      tabGroup.spaceId,
      tabGroup.profileId,
      isSpaceLight,
      isFolder,
      isCollapsed,
      isEditingName,
      isDropIntoFolder
    ]);

    const folderCardClass = FOLDER_CARD_CLASSES[tabGroup.color ?? "neutral"];

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
        className={cn(
          "relative flex flex-col gap-0.5",
          isFolder && [
            "rounded-xl border p-1 transition-[background-color,border-color,box-shadow] duration-150",
            folderCardClass,
            isDropIntoFolder && "ring-2 ring-primary/65"
          ]
        )}
        ref={ref}
      >
        {closestEdge === "top" && (
          <div className="absolute top-0 left-0 right-0 -translate-y-1/2 z-elevated pointer-events-none">
            <DropIndicator isSpaceLight={isSpaceLight} />
          </div>
        )}

        {isFolder && (
          <div
            ref={headerRef}
            role="button"
            tabIndex={0}
            onClick={toggleCollapse}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditingName(true);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lumi.tabs.showFolderContextMenu(tabGroup.id);
            }}
            onKeyDown={(e) => {
              if (!isEditingName && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                toggleCollapse();
              }
            }}
            className={cn(
              "group/header flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium cursor-pointer select-none",
              "text-black/75 dark:text-white/80 hover:text-black dark:hover:text-white",
              "hover:bg-black/[0.045] dark:hover:bg-white/[0.06] transition-colors"
            )}
          >
            <motion.span
              animate={{ scale: isCollapsed ? 0.94 : 1 }}
              transition={{ type: "spring", stiffness: 460, damping: 28 }}
              className="inline-flex shrink-0 items-center"
            >
              <Folder className="size-3.5 opacity-75" />
            </motion.span>

            {isEditingName ? (
              <input
                ref={renameInputRef}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRename();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setDraftName(tabGroup.name || "Folder");
                    setIsEditingName(false);
                  }
                }}
                className="min-w-0 flex-1 bg-transparent outline-none border-b border-black/30 dark:border-white/40 text-xs font-medium px-0.5"
              />
            ) : (
              <span className="truncate font-semibold">{tabGroup.name || "Folder"}</span>
            )}

            {!isEditingName && (
              <motion.span
                animate={{ rotate: isCollapsed ? -90 : 0 }}
                transition={{ type: "spring", stiffness: 460, damping: 30 }}
                className="inline-flex shrink-0 items-center justify-center opacity-60"
              >
                <ChevronDown className="size-3" />
              </motion.span>
            )}

            <AnimatePresence initial={false}>
              {isCollapsed && !isEditingName && (
                <motion.div
                  initial={{ opacity: 0, x: 6, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 4, scale: 0.9 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="ml-auto flex items-center gap-1 shrink-0"
                >
                  <div className="flex items-center -space-x-1">
                    {tabs.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className="size-3.5 rounded-[3px] overflow-hidden bg-black/15 dark:bg-white/15 ring-1 ring-black/15 dark:ring-white/20 flex items-center justify-center shrink-0"
                      >
                        {t.faviconURL ? (
                          <img
                            src={craftActiveFaviconURL(t.id, t.faviconURL)}
                            alt=""
                            className="size-3.5 object-contain"
                            style={{ userSelect: "none", WebkitUserDrag: "none" } as React.CSSProperties}
                          />
                        ) : (
                          <span className="size-1.5 rounded-full bg-black/35 dark:bg-white/40" />
                        )}
                      </span>
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums text-black/55 dark:text-white/55">
                    {tabs.length}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!isFolder && isMultiTabGroup && (
          <div
            role="button"
            tabIndex={0}
            onClick={toggleCollapse}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleCollapse();
              }
            }}
            className={cn(
              "group/header flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer select-none",
              "text-black/60 dark:text-white/60 hover:text-black/90 dark:hover:text-white/90",
              "hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            )}
          >
            <motion.span
              animate={{ rotate: isCollapsed ? -90 : 0 }}
              transition={{ type: "spring", stiffness: 460, damping: 30 }}
              className="inline-flex shrink-0 items-center justify-center"
            >
              <ChevronDown className="size-3.5" />
            </motion.span>
            {tabGroup.mode === "split" ? (
              tabGroup.splitDirection === "vertical" ? (
                <Rows2 className="size-3.5 text-sky-500/90" />
              ) : (
                <Columns2 className="size-3.5 text-sky-500/90" />
              )
            ) : tabGroup.mode === "glance" ? (
              <Layers className="size-3.5 text-violet-500/90" />
            ) : (
              <Folder className="size-3.5 text-amber-500/80" />
            )}
            <span className="truncate flex-1">{tabGroup.mode === "split" ? "Split View" : "Glance"}</span>

            {tabGroup.mode === "split" && (
              <div
                className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => lumi.tabs.swapSplitPanes(tabGroup.id)}
                  title="Swap Split Panes"
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/15"
                >
                  <ArrowLeftRight className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    lumi.tabs.setSplitDirection(
                      tabGroup.id,
                      tabGroup.splitDirection === "vertical" ? "horizontal" : "vertical"
                    )
                  }
                  title={
                    tabGroup.splitDirection === "vertical"
                      ? "Switch to Side-by-Side Split"
                      : "Switch to Top/Bottom Split"
                  }
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/15"
                >
                  {tabGroup.splitDirection === "vertical" ? (
                    <Columns2 className="size-3" />
                  ) : (
                    <Rows2 className="size-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => lumi.tabs.ungroupTabGroup(tabGroup.id, focusedTab?.id)}
                  title="Unsplit Tabs"
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/15"
                >
                  <Ungroup className="size-3" />
                </button>
              </div>
            )}

            {tabGroup.mode === "glance" && (
              <div
                className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => lumi.tabs.dismissGlance(tabGroup.id, true)}
                  title="Promote Glance Tab to Full Tab"
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/15"
                >
                  <Maximize2 className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => lumi.tabs.dismissGlance(tabGroup.id, false)}
                  title="Dismiss Glance Overlay"
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/15"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            )}

            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-semibold tabular-nums">
              {tabs.length}
            </span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {(!isCollapsed || (!isFolder && !isMultiTabGroup)) && (
            <motion.div
              initial={isFolder || isMultiTabGroup ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }}
              exit={{ opacity: 0, height: 0, overflow: "hidden" }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
              className={cn(
                "flex flex-col gap-0.5",
                !isFolder && isMultiTabGroup && "pl-2 border-l border-black/10 dark:border-white/10 ml-2"
              )}
            >
              {tabs.map((tab) => (
                <SidebarTab
                  key={tab.id}
                  tab={tab}
                  isFocused={isFocused && focusedTab?.id === tab.id}
                  isSpaceLight={isSpaceLight}
                  inFolder={isFolder}
                  folderGroupId={isFolder ? tabGroup.id : undefined}
                  activeTabLayoutId={activeTabLayoutId}
                  moveTab={moveTab}
                />
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
  (prev, next) => {
    return (
      prev.tabGroup === next.tabGroup &&
      prev.isActive === next.isActive &&
      prev.isFocused === next.isFocused &&
      prev.isSpaceLight === next.isSpaceLight &&
      prev.position === next.position &&
      prev.groupCount === next.groupCount &&
      prev.activeTabLayoutId === next.activeTabLayoutId &&
      prev.moveTab === next.moveTab &&
      prev.unpinToTabList === next.unpinToTabList
    );
  }
);
