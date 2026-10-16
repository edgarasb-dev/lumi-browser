import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAdaptiveTopbar } from "@/components/browser-ui/adaptive-topbar";
import { usePlatform } from "@/components/main/platform";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useFocusedTab, useTabsGroups } from "@/components/providers/tabs-provider";
import { SidebarWindowControlsMacOS } from "@/components/browser-ui/window-controls/macos";
import { NavigationControls } from "@/components/browser-ui/browser-sidebar/_components/navigation-controls";
import { AddressBar } from "@/components/browser-ui/browser-sidebar/_components/address-bar";
import { SpaceSwitcher } from "@/components/browser-ui/browser-sidebar/_components/bottom/space-switcher";
import { SpaceScratchpad } from "@/components/browser-ui/browser-sidebar/_components/space-scratchpad";
import { BottomExtrasMenu } from "@/components/browser-ui/browser-sidebar/_components/bottom/bottom-extras-menu";
import { TabPreviewCard } from "@/components/browser-ui/browser-sidebar/_components/tab-preview-card";
import { useSetting } from "@/components/providers/settings-provider";
import { cn, craftActiveFaviconURL } from "@/lib/utils";
import { Plus, X, PanelLeft, Volume2, VolumeX } from "lucide-react";
import type { TabData } from "~/types/tabs";

interface TopbarTabProps {
  tab: TabData;
  isActive: boolean;
}

function TopbarTab({ tab, isActive }: TopbarTabProps) {
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

  const handleContextMenu = useCallback(() => {
    lumi.tabs.showContextMenu(tab.id);
  }, [tab.id]);

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
      <div
        ref={tabRef}
        role="button"
        tabIndex={0}
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
          "group relative flex items-center gap-1.5 h-8 px-2.5 rounded-lg max-w-[210px] min-w-[110px] flex-1 remove-app-drag",
          "text-xs select-none transition-all duration-150 cursor-pointer",
          isActive
            ? "bg-white/95 dark:bg-white/20 text-black/90 dark:text-white/90 shadow-xs border border-white/40 dark:border-white/10 font-medium backdrop-blur-md"
            : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/12 text-black/70 dark:text-white/70 border border-transparent"
        )}
        title={tab.title}
      >
        {/* Favicon */}
        <div className="size-3.5 shrink-0">
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
        <span className={cn("truncate min-w-0 flex-1 font-medium", tab.asleep && "opacity-60")}>
          {tab.title || "New Tab"}
        </span>

        {/* Audio indicator */}
        {(tab.audible || tab.muted) && (
          <button
            onClick={handleToggleMute}
            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-black/60 dark:text-white/60 shrink-0"
            title={tab.muted ? "Unmute tab" : "Mute tab"}
          >
            {tab.muted ? <VolumeX className="size-3 text-red-500" /> : <Volume2 className="size-3 text-primary" />}
          </button>
        )}

        {/* Sleeping indicator */}
        {tab.asleep && (
          <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 rounded shrink-0">
            Zzz
          </span>
        )}

        {/* Close button */}
        <button
          onClick={handleClose}
          className={cn(
            "size-4 rounded flex items-center justify-center shrink-0",
            "opacity-0 group-hover:opacity-100 hover:bg-black/15 dark:hover:bg-white/20 text-black/60 dark:text-white/60 hover:text-black/90 dark:hover:text-white/90 transition-opacity"
          )}
          title="Close tab"
        >
          <X className="size-3" />
        </button>
      </div>

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

export function TopbarLayout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setContentTopOffset } = useAdaptiveTopbar();
  const { platform } = usePlatform();
  const { currentSpace, isCurrentSpaceLight } = useSpaces();
  const { getTabGroups } = useTabsGroups();
  const focusedTab = useFocusedTab();
  const [, setNavigationLayout] = useSetting<"sidebar" | "topbar">("navigationLayout");

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

  const spaceInjectedClasses = useMemo(() => (isCurrentSpaceLight ? "" : "dark"), [isCurrentSpaceLight]);

  return (
    <div
      ref={containerRef}
      className={cn(
        spaceInjectedClasses,
        "w-full flex flex-col gap-1.5 px-2.5 pt-2.5 pb-0.5 select-none",
        "transition-colors duration-150 app-drag"
      )}
    >
      {/* Row 1: Traffic lights + Horizontal Tab Strip + Space Switcher + Layout Switch */}
      <div className="w-full flex items-center gap-2 min-w-0">
        {platform === "darwin" && (
          <div className="shrink-0 flex items-center pr-1.5 remove-app-drag">
            <SidebarWindowControlsMacOS />
          </div>
        )}

        {/* Tab strip container */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar py-0.5">
          {tabs.map((tab) => (
            <TopbarTab key={tab.id} tab={tab} isActive={focusedTab?.id === tab.id} />
          ))}

          <button
            onClick={handleNewTab}
            className={cn(
              "size-7 rounded-lg flex items-center justify-center shrink-0 remove-app-drag",
              "text-black/60 dark:text-white/60 hover:text-black/90 dark:hover:text-white/90 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            )}
            title="New Tab"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {/* Spaces and Layout Toggle on right */}
        <div className="shrink-0 flex items-center gap-1.5 remove-app-drag">
          <div className="max-w-[150px]">
            <SpaceSwitcher />
          </div>

          <button
            onClick={handleSwitchToSidebar}
            className={cn(
              "size-7 rounded-lg flex items-center justify-center",
              "text-black/60 dark:text-white/60 hover:text-black/90 dark:hover:text-white/90 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            )}
            title="Switch back to vertical sidebar layout"
          >
            <PanelLeft className="size-4" />
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
          <SpaceScratchpad />
          <BottomExtrasMenu />
        </div>
      </div>
    </div>
  );
}
