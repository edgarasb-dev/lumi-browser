import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AudioVisualizerBars } from "@/components/ui/audio-visualizer";
import { useAdaptiveTopbar } from "@/components/browser-ui/adaptive-topbar";
import { usePlatform } from "@/components/main/platform";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useFocusedTab, useTabs } from "@/components/providers/tabs-provider";
import { usePinnedTabs } from "@/components/providers/pinned-tabs-provider";
import { SidebarWindowControlsMacOS } from "@/components/browser-ui/window-controls/macos";
import { NavigationControls } from "@/components/browser-ui/browser-sidebar/_components/navigation-controls";
import { AddressBar } from "@/components/browser-ui/browser-sidebar/_components/address-bar";
import { SpaceSwitcher } from "@/components/browser-ui/browser-sidebar/_components/bottom/space-switcher";
import { SpaceScratchpad } from "@/components/browser-ui/browser-sidebar/_components/space-scratchpad";
import { BottomExtrasMenu } from "@/components/browser-ui/browser-sidebar/_components/bottom/bottom-extras-menu";
import {
  DOCK_BUTTON_CLASSES,
  DOCK_ICON_STROKE_WIDTH,
  getDockButtonClassName
} from "@/components/browser-ui/browser-sidebar/_components/bottom/dock-button-sizes";
import { DownloadsButton } from "@/components/browser-ui/browser-sidebar/_components/downloads-button";
import { RecentlyClosedPopover } from "@/components/browser-ui/browser-sidebar/_components/recently-closed-popover";
import { TabPreviewCard } from "@/components/browser-ui/browser-sidebar/_components/tab-preview-card";
import {
  PinnedTabBadge,
  usePinnedTabPresentation
} from "@/components/browser-ui/browser-sidebar/_components/pin-grid/pinned-tab-presentation";
import "@/components/browser-ui/browser-sidebar/_components/pin-grid/pin.css";
import { MediaMiniPlayer } from "@/components/browser-ui/media-mini-player";
import { useSidePanel } from "@/components/providers/side-panel-provider";
import { useAppUpdates } from "@/components/providers/app-updates-provider";
import { useSetting } from "@/components/providers/settings-provider";
import { useWindowDrag } from "@/hooks/use-window-drag";
import { handleChromeBarContextMenu, shouldIgnoreWindowDragTarget } from "@/lib/chrome-interactions";
import { cn, craftActiveFaviconURL } from "@/lib/utils";
import {
  Plus,
  X,
  PanelLeft,
  PanelRight,
  VolumeX,
  Columns2,
  Rows2,
  ArrowLeftRight,
  Ungroup,
  Maximize2,
  ArrowUpCircle,
  Download,
  RefreshCw,
  Globe
} from "lucide-react";
import type { PinnedTabData } from "~/types/pinned-tabs";
import type { TabData } from "~/types/tabs";

interface TopbarTabProps {
  tab: TabData;
  isActive: boolean;
  activeTabLayoutId: string;
}

function TopbarTab({ tab, isActive, activeTabLayoutId }: TopbarTabProps) {
  const [isFaviconError, setIsFaviconError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tabRef = useRef<HTMLDivElement>(null);

  const noFavicon = !tab.faviconURL || isFaviconError;

  const handleClick = useCallback(() => {
    lumi.tabs.switchToTab(tab.id);
  }, [tab.id]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsPreviewOpen(false);
      lumi.tabs.closeTab(tab.id);
    },
    [tab.id]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      lumi.tabs.showContextMenu(tab.id);
    },
    [tab.id]
  );

  const handleToggleMute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      lumi.tabs.setTabMuted(tab.id, !tab.muted);
    },
    [tab.id, tab.muted]
  );

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      if (tabRef.current) {
        setAnchorRect(tabRef.current.getBoundingClientRect());
        setIsPreviewOpen(true);
      }
    }, 450);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsPreviewOpen(false);
  }, []);

  return (
    <>
      <motion.div
        ref={tabRef}
        layout="position"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{
          layout: { type: "spring", stiffness: 480, damping: 34 },
          duration: 0.16,
          ease: "easeOut"
        }}
        role="button"
        tabIndex={0}
        data-tab-id={tab.id}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        className={cn(
          "group relative flex items-center gap-1.5 h-8 px-2.5 rounded-xl max-w-[210px] min-w-[110px] flex-1 remove-app-drag overflow-hidden",
          "text-xs select-none transition-[color,background-color] duration-150 cursor-pointer active:scale-[0.985]",
          isActive
            ? "text-black/90 dark:text-white/95 font-medium"
            : "bg-black/[0.045] dark:bg-white/[0.05] hover:bg-black/[0.09] dark:hover:bg-white/[0.11] text-black/70 dark:text-white/75"
        )}
        title={tab.title}
      >
        {isActive && (
          <motion.div
            layoutId={activeTabLayoutId}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            className="pointer-events-none absolute inset-0 z-0 rounded-xl bg-white/90 dark:bg-white/[0.18] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.45)] border border-black/[0.06] dark:border-white/[0.14]"
          />
        )}

        {/* Favicon */}
        <div className="relative z-10 size-3.5 shrink-0">
          {!noFavicon && (
            <img
              src={craftActiveFaviconURL(tab.id, tab.faviconURL)}
              alt={tab.title}
              className={cn("size-full rounded-xs object-contain", tab.asleep && "grayscale")}
              onError={() => setIsFaviconError(true)}
            />
          )}
          {noFavicon && <div className="size-full bg-black/20 dark:bg-white/20 rounded-xs" />}
        </div>

        {/* Title */}
        <span className={cn("relative z-10 truncate min-w-0 flex-1 font-medium", tab.asleep && "opacity-60")}>
          {tab.title || "New Tab"}
        </span>

        {/* Audio indicator */}
        {(tab.audible || tab.muted) && (
          <button
            onClick={handleToggleMute}
            className="relative z-10 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-black/60 dark:text-white/60 shrink-0 cursor-pointer"
            title={tab.muted ? "Unmute tab" : "Mute tab"}
          >
            {tab.muted ? (
              <VolumeX className="size-3 text-red-500" />
            ) : (
              <AudioVisualizerBars active={tab.audible} className="h-2.5" />
            )}
          </button>
        )}

        {/* Sleeping indicator */}
        {tab.asleep && (
          <span className="relative z-10 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 rounded shrink-0">
            Zzz
          </span>
        )}

        {/* Close button */}
        <button
          onClick={handleClose}
          className={cn(
            "relative z-10 size-4 rounded flex items-center justify-center shrink-0",
            "opacity-0 group-hover:opacity-100 hover:bg-black/15 dark:hover:bg-white/20 text-black/60 dark:text-white/60 hover:text-black/90 dark:hover:text-white/90 transition-opacity cursor-pointer"
          )}
          title="Close tab"
        >
          <X className="size-3" />
        </button>
      </motion.div>

      <TabPreviewCard
        tab={tab}
        anchorRect={anchorRect}
        isOpen={isPreviewOpen && !isActive}
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
}

interface TopbarPinnedTabProps {
  pinnedTab: PinnedTabData;
  associatedTab?: TabData;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: () => void;
}

function TopbarPinnedTab({
  pinnedTab,
  associatedTab,
  isActive,
  onClick,
  onDoubleClick,
  onContextMenu
}: TopbarPinnedTabProps) {
  const { faviconUrl, handleImageError, hasColors, activeBorderStyle, activeOverlayStyle, unreadCount, tooltipTitle } =
    usePinnedTabPresentation({
      pinnedTab,
      associatedTab,
      isActive
    });

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu();
    },
    [onContextMenu]
  );

  return (
    <div className="relative shrink-0 remove-app-drag" data-pinned-tab-id={pinnedTab.uniqueId}>
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={handleContextMenu}
        title={tooltipTitle}
        style={activeBorderStyle}
        className={cn(
          "lumi-glass-sheen relative size-8 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer",
          "transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.96]",
          isActive
            ? cn(
                "bg-white/90 dark:bg-white/[0.18] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.45)]",
                !hasColors && "border border-black/15 dark:border-white/60",
                hasColors && "pinned-tab-active-border"
              )
            : "bg-black/[0.045] hover:bg-black/[0.09] dark:bg-white/[0.06] dark:hover:bg-white/[0.13] border border-transparent"
        )}
      >
        <div className="size-full flex items-center justify-center" style={activeOverlayStyle}>
          {faviconUrl ? (
            <img
              src={faviconUrl}
              alt=""
              onError={handleImageError}
              className={cn("size-4 rounded-xs object-contain user-drag-none", associatedTab?.asleep && "opacity-75")}
            />
          ) : (
            <Globe className="size-4 text-black/55 dark:text-white/75" />
          )}
        </div>
      </button>

      <PinnedTabBadge count={unreadCount} variant="compact" />
    </div>
  );
}

export function TopbarLayout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const topbarTabLayoutId = useId();
  const { setContentTopOffset } = useAdaptiveTopbar();
  const { platform } = usePlatform();
  const { currentSpace, isCurrentSpaceLight, isProfileEphemeral } = useSpaces();
  const { tabsData, getTabGroups, activeTabGroup } = useTabs();
  const {
    getPinnedTabs,
    click: clickPinnedTab,
    doubleClick: doubleClickPinnedTab,
    showContextMenu: showPinnedTabContextMenu
  } = usePinnedTabs();
  const focusedTab = useFocusedTab();
  const [, setNavigationLayout] = useSetting<"sidebar" | "topbar">("navigationLayout");
  const { isOpen: sidePanelOpen, toggleOpen: toggleSidePanel } = useSidePanel();
  const { handleMouseDown } = useWindowDrag({
    shouldIgnoreTarget: shouldIgnoreWindowDragTarget
  });
  const {
    updateStatus,
    isDownloadingUpdate,
    isInstallingUpdate,
    isAutoUpdateSupported,
    downloadUpdate,
    installUpdate,
    openDownloadPage
  } = useAppUpdates();

  const isUpdateDownloaded = updateStatus?.updateDownloaded === true;
  const hasUpdateAvailable = Boolean(updateStatus?.availableUpdate);
  const showTopbarUpdatePill = hasUpdateAvailable || isUpdateDownloaded || isDownloadingUpdate || isInstallingUpdate;

  const handleTopbarUpdateClick = useCallback(async () => {
    if (isUpdateDownloaded) {
      const ok = await installUpdate();
      if (!ok) openDownloadPage();
      return;
    }
    if (hasUpdateAvailable && !isAutoUpdateSupported) {
      openDownloadPage();
      return;
    }
    if (hasUpdateAvailable && !isDownloadingUpdate) {
      const started = await downloadUpdate();
      if (!started) openDownloadPage();
    }
  }, [
    isUpdateDownloaded,
    hasUpdateAvailable,
    isAutoUpdateSupported,
    isDownloadingUpdate,
    installUpdate,
    downloadUpdate,
    openDownloadPage
  ]);

  // Measure element height and report as contentTopOffset so WebContentsView sits right below topbar
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const report = () => setContentTopOffset(el.offsetHeight);
    report();

    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setContentTopOffset(0);
    };
  }, [setContentTopOffset]);

  const tabs = useMemo(() => {
    if (!currentSpace) return [];
    const groups = getTabGroups(currentSpace.id);
    return groups.flatMap((g) => g.tabs);
  }, [currentSpace, getTabGroups]);

  const pinnedTabs = useMemo(() => {
    if (!currentSpace || isProfileEphemeral(currentSpace.profileId)) return [];
    return getPinnedTabs(currentSpace.profileId);
  }, [currentSpace, isProfileEphemeral, getPinnedTabs]);

  const tabsById = useMemo(() => {
    const map = new Map<number, TabData>();
    if (!tabsData) return map;
    for (const tab of tabsData.tabs) {
      map.set(tab.id, tab);
    }
    return map;
  }, [tabsData]);

  const handleNewTab = useCallback(() => {
    if (currentSpace) {
      lumi.tabs.newTab(undefined, true, currentSpace.id);
    } else {
      lumi.newTab.open();
    }
  }, [currentSpace]);

  const handleSwitchToSidebar = useCallback(() => {
    setNavigationLayout("sidebar");
  }, [setNavigationLayout]);

  const handleBarDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target || target.ownerDocument !== e.currentTarget.ownerDocument || !e.currentTarget.contains(target)) {
      return;
    }
    if (shouldIgnoreWindowDragTarget(target)) return;
    lumi.interface.maximizeWindow();
  }, []);

  const spaceInjectedClasses = useMemo(() => (isCurrentSpaceLight ? "" : "dark"), [isCurrentSpaceLight]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleBarDoubleClick}
      onContextMenu={handleChromeBarContextMenu}
      className={cn(
        spaceInjectedClasses,
        "w-full flex flex-col gap-1 px-2.5 pt-2 pb-0.5 select-none",
        "transition-colors duration-150 remove-app-drag"
      )}
    >
      {/* Row 1: Traffic lights + Pinned Tabs + Horizontal Tab Strip + Space Switcher + Layout Switch */}
      <div className="w-full flex items-center gap-2 min-w-0">
        {platform === "darwin" && (
          <div className="shrink-0 flex items-center pr-1.5 remove-app-drag">
            <SidebarWindowControlsMacOS />
          </div>
        )}

        {/* Tab strip container */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar py-1.5">
          {pinnedTabs.map((pinnedTab) => {
            const associatedTabId = currentSpace ? pinnedTab.associatedTabIdsBySpace[currentSpace.id] : undefined;
            const associatedTab = associatedTabId !== undefined ? tabsById.get(associatedTabId) : undefined;
            return (
              <TopbarPinnedTab
                key={pinnedTab.uniqueId}
                pinnedTab={pinnedTab}
                associatedTab={associatedTab}
                isActive={associatedTabId !== undefined && associatedTabId === focusedTab?.id}
                onClick={() => clickPinnedTab(pinnedTab.uniqueId)}
                onDoubleClick={() => doubleClickPinnedTab(pinnedTab.uniqueId)}
                onContextMenu={() => showPinnedTabContextMenu(pinnedTab.uniqueId)}
              />
            );
          })}

          {pinnedTabs.length > 0 && tabs.length > 0 && (
            <div className="h-4 w-px bg-black/12 dark:bg-white/15 shrink-0 mx-0.5" />
          )}

          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <TopbarTab
                key={tab.id}
                tab={tab}
                isActive={focusedTab?.id === tab.id}
                activeTabLayoutId={topbarTabLayoutId}
              />
            ))}
          </AnimatePresence>

          <button
            onClick={handleNewTab}
            className={cn(
              "group size-7 rounded-lg flex items-center justify-center shrink-0 remove-app-drag cursor-pointer",
              "text-black/60 dark:text-white/60 hover:text-black/90 dark:hover:text-white/90 hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 transition-all duration-150"
            )}
            title="New Tab"
          >
            <Plus className="size-4 transition-transform duration-200 group-hover:rotate-90" />
          </button>
        </div>

        {/* Split / Glance Quick Controls + Spaces + Layout Toggle on right */}
        <div className="shrink-0 flex items-center gap-1.5 remove-app-drag">
          {activeTabGroup?.mode === "split" && activeTabGroup.tabs.length >= 2 && (
            <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-black/5 dark:bg-white/10">
              <button
                type="button"
                onClick={() => lumi.tabs.swapSplitPanes(activeTabGroup.id)}
                className="size-6 rounded flex items-center justify-center text-black/70 dark:text-white/75 hover:bg-black/10 dark:hover:bg-white/15"
                title="Swap Split Panes"
              >
                <ArrowLeftRight className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  lumi.tabs.setSplitDirection(
                    activeTabGroup.id,
                    activeTabGroup.splitDirection === "vertical" ? "horizontal" : "vertical"
                  )
                }
                className="size-6 rounded flex items-center justify-center text-black/70 dark:text-white/75 hover:bg-black/10 dark:hover:bg-white/15"
                title={
                  activeTabGroup.splitDirection === "vertical"
                    ? "Switch to Side-by-Side Split"
                    : "Switch to Top/Bottom Split"
                }
              >
                {activeTabGroup.splitDirection === "vertical" ? (
                  <Columns2 className="size-3.5" />
                ) : (
                  <Rows2 className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => lumi.tabs.ungroupTabGroup(activeTabGroup.id, focusedTab?.id)}
                className="size-6 rounded flex items-center justify-center text-black/70 dark:text-white/75 hover:bg-black/10 dark:hover:bg-white/15"
                title="Unsplit Tabs"
              >
                <Ungroup className="size-3.5" />
              </button>
            </div>
          )}

          {activeTabGroup?.mode === "glance" && activeTabGroup.tabs.length >= 2 && (
            <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-black/5 dark:bg-white/10">
              <button
                type="button"
                onClick={() => lumi.tabs.dismissGlance(activeTabGroup.id, true)}
                className="size-6 rounded flex items-center justify-center text-black/70 dark:text-white/75 hover:bg-black/10 dark:hover:bg-white/15"
                title="Promote Glance Tab"
              >
                <Maximize2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => lumi.tabs.dismissGlance(activeTabGroup.id, false)}
                className="size-6 rounded flex items-center justify-center text-black/70 dark:text-white/75 hover:bg-black/10 dark:hover:bg-white/15"
                title="Dismiss Glance Overlay"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <div className="max-w-[150px]">
            <SpaceSwitcher size="sm" availableWidth={150} />
          </div>

          <button
            type="button"
            onClick={handleSwitchToSidebar}
            className={cn(getDockButtonClassName("sm"), "remove-app-drag")}
            title="Switch back to vertical sidebar layout"
          >
            <PanelLeft strokeWidth={DOCK_ICON_STROKE_WIDTH} className={DOCK_BUTTON_CLASSES.sm.icon} />
          </button>
        </div>
      </div>

      {/* Row 2: Navigation controls + Address Bar + Tools */}
      <div className="w-full flex items-center gap-2">
        <div className="shrink-0 remove-app-drag">
          <NavigationControls />
        </div>

        <div className="min-w-0 flex-1 remove-app-drag">
          <AddressBar />
        </div>

        <div className="shrink-0 flex items-center gap-1 remove-app-drag">
          {showTopbarUpdatePill && (
            <button
              type="button"
              onClick={handleTopbarUpdateClick}
              disabled={isInstallingUpdate || isDownloadingUpdate}
              title={
                isUpdateDownloaded
                  ? `Restart & Install Lumi v${updateStatus?.availableUpdate?.version ?? ""}`
                  : `Download Lumi v${updateStatus?.availableUpdate?.version ?? ""}`
              }
              className={cn(
                "h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer",
                isUpdateDownloaded
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                  : "bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25",
                "disabled:opacity-60 disabled:pointer-events-none"
              )}
            >
              {isInstallingUpdate || isDownloadingUpdate ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : isUpdateDownloaded ? (
                <ArrowUpCircle className="size-3.5" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span>
                {isInstallingUpdate
                  ? "Installing..."
                  : isDownloadingUpdate
                    ? "Downloading..."
                    : isUpdateDownloaded
                      ? "Install Update"
                      : "Update"}
              </span>
            </button>
          )}
          <MediaMiniPlayer variant="topbar" />
          <DownloadsButton size="sm" />
          <RecentlyClosedPopover size="sm" />
          <button
            type="button"
            onClick={toggleSidePanel}
            title="Toggle Split Side Panel (Cmd+Shift+.)"
            className={getDockButtonClassName("sm", { active: sidePanelOpen })}
          >
            <PanelRight strokeWidth={DOCK_ICON_STROKE_WIDTH} className={DOCK_BUTTON_CLASSES.sm.icon} />
          </button>
          <SpaceScratchpad size="sm" />
          <BottomExtrasMenu size="sm" />
        </div>
      </div>
    </div>
  );
}
