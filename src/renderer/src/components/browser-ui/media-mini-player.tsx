import { memo, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  PictureInPicture2,
  Music2,
  ExternalLink
} from "lucide-react";
import { useTabsGroups } from "@/components/providers/tabs-provider";
import { useSpaces } from "@/components/providers/spaces-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { cn, craftActiveFaviconURL } from "@/lib/utils";
import type { MediaControlAction, MediaTabInfo } from "~/types/media";

function MediaPlayerCard({
  item,
  onControl
}: {
  item: MediaTabInfo;
  onControl: (tabId: number, action: MediaControlAction) => void;
}) {
  const artwork = item.artworkUrl || (item.faviconURL ? craftActiveFaviconURL(item.tabId, item.faviconURL) : null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => lumi.tabs.switchToTab(item.tabId)}
          className="size-9 rounded-lg overflow-hidden bg-black/10 dark:bg-white/10 shrink-0 flex items-center justify-center ring-1 ring-black/10 dark:ring-white/15 cursor-pointer hover:opacity-90 transition-opacity"
          title="Jump to media tab"
        >
          {artwork ? (
            <img src={artwork} alt="" className="size-full object-cover" />
          ) : (
            <Music2 className="size-4 text-primary" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-black/90 dark:text-white/95 truncate">
            {item.mediaTitle || item.title}
          </div>
          <div className="text-[10px] text-black/55 dark:text-white/55 truncate">
            {item.mediaArtist || new URL(item.url || "about:blank").hostname.replace(/^www\./, "")}
          </div>
        </div>

        <button
          type="button"
          onClick={() => lumi.tabs.switchToTab(item.tabId)}
          className="size-6 rounded-md flex items-center justify-center text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 shrink-0 cursor-pointer"
          title="Switch to tab"
        >
          <ExternalLink className="size-3" />
        </button>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center justify-between gap-1 pt-0.5">
        <button
          type="button"
          onClick={() => onControl(item.tabId, "seek-back")}
          className="size-7 rounded-lg flex items-center justify-center text-black/70 dark:text-white/75 hover:bg-black/10 dark:hover:bg-white/12 cursor-pointer"
          title="Rewind 10s"
        >
          <RotateCcw className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onControl(item.tabId, "toggle-play")}
          className="h-7 px-3 rounded-lg bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
          title={item.paused ? "Play" : "Pause"}
        >
          {item.paused ? <Play className="size-3.5 fill-current" /> : <Pause className="size-3.5 fill-current" />}
        </button>

        <button
          type="button"
          onClick={() => onControl(item.tabId, "seek-forward")}
          className="size-7 rounded-lg flex items-center justify-center text-black/70 dark:text-white/75 hover:bg-black/10 dark:hover:bg-white/12 cursor-pointer"
          title="Forward 10s"
        >
          <RotateCw className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onControl(item.tabId, item.muted ? "unmute" : "mute")}
          className={cn(
            "size-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors",
            item.muted
              ? "text-destructive bg-destructive/10 hover:bg-destructive/20"
              : "text-black/70 dark:text-white/75 hover:bg-black/10 dark:hover:bg-white/12"
          )}
          title={item.muted ? "Unmute" : "Mute"}
        >
          {item.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => onControl(item.tabId, "toggle-pip")}
          className={cn(
            "size-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors",
            item.isPictureInPicture
              ? "text-primary bg-primary/15"
              : "text-black/70 dark:text-white/75 hover:bg-black/10 dark:hover:bg-white/12",
            !item.hasVideo && !item.isPictureInPicture && "opacity-45"
          )}
          title={item.isPictureInPicture ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture"}
        >
          <PictureInPicture2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export const MediaMiniPlayer = memo(function MediaMiniPlayer({
  variant = "sidebar"
}: {
  variant?: "sidebar" | "topbar";
}) {
  const { tabGroups } = useTabsGroups();
  const { isCurrentSpaceLight } = useSpaces();
  const [mediaTabs, setMediaTabs] = useState<MediaTabInfo[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const hasPotentialMedia = tabGroups.some((group) =>
    group.tabs.some((tab) => tab.audible || tab.muted || tab.isPictureInPicture)
  );

  const fetchMedia = useCallback(async () => {
    const items = await lumi.media.getActiveTabs().catch(() => []);
    setMediaTabs(items);
  }, []);

  useEffect(() => {
    void fetchMedia();
    return lumi.media.onChanged(() => {
      void fetchMedia();
    });
  }, [fetchMedia]);

  useEffect(() => {
    if (hasPotentialMedia) {
      void fetchMedia();
    }
  }, [hasPotentialMedia, fetchMedia]);

  const handleControl = useCallback(async (tabId: number, action: MediaControlAction) => {
    await lumi.media.control(tabId, action);
  }, []);

  const active = mediaTabs[0];
  if (!active) return null;

  const spaceClasses = cn(isCurrentSpaceLight ? "" : "dark");

  if (variant === "topbar") {
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          className={cn(
            "h-7 px-2 rounded-lg flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors",
            "bg-primary/15 text-primary border border-primary/25 hover:bg-primary/22"
          )}
          title={active.mediaTitle || active.title}
        >
          <Music2 className="size-3.5 animate-pulse" />
          <span className="max-w-24 truncate hidden md:inline">{active.mediaTitle || active.title}</span>
        </PopoverTrigger>
        <PopoverContent variant="translucent" className="w-72 p-3" positionerClassName={spaceClasses}>
          <MediaPlayerCard item={active} onControl={handleControl} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0, marginTop: 0 }}
        animate={{ opacity: 1, height: "auto", marginTop: 6 }}
        exit={{ opacity: 0, height: 0, marginTop: 0 }}
        transition={{ duration: 0.2 }}
        className="shrink-0 overflow-hidden mb-1.5 remove-app-drag"
      >
        <div className="rounded-xl p-2.5 bg-white/55 dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.12] backdrop-blur-xl shadow-xs">
          <MediaPlayerCard item={active} onControl={handleControl} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
});
