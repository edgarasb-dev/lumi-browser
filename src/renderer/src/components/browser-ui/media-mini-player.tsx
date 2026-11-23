import { memo, useCallback, useEffect, useMemo, useState } from "react";
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

interface MediaImageCandidate {
  key: string;
  src: string;
  kind: "artwork" | "favicon";
}

function getSafeWebArtworkUrl(raw?: string): string | null {
  if (!raw) return null;
  const parsed = URL.parse(raw);
  if (!parsed) return null;
  const proto = parsed.protocol.toLowerCase();
  if (proto === "https:" || proto === "http:" || proto === "data:") {
    return parsed.toString();
  }
  return null;
}

function getCachedFaviconUrl(tabUrl: string): string | null {
  const parsed = URL.parse(tabUrl);
  if (!parsed) return null;
  const proto = parsed.protocol.toLowerCase();
  if (proto !== "https:" && proto !== "http:") return null;
  const srcUrl = new URL("lumi://favicon");
  srcUrl.searchParams.set("url", tabUrl);
  return srcUrl.toString();
}

function MediaThumbnail({ item }: { item: MediaTabInfo }) {
  const candidates = useMemo<MediaImageCandidate[]>(() => {
    const list: MediaImageCandidate[] = [];

    const safeArtwork = getSafeWebArtworkUrl(item.artworkUrl);
    if (safeArtwork) {
      list.push({ key: `art:${safeArtwork}`, src: safeArtwork, kind: "artwork" });
    }

    if (item.faviconURL) {
      const activeFavicon = craftActiveFaviconURL(item.tabId, item.faviconURL);
      if (activeFavicon) {
        list.push({ key: `active-fav:${activeFavicon}`, src: activeFavicon, kind: "favicon" });
      }
    }

    const cachedFavicon = getCachedFaviconUrl(item.url);
    if (cachedFavicon) {
      list.push({ key: `cached-fav:${cachedFavicon}`, src: cachedFavicon, kind: "favicon" });
    }

    return list;
  }, [item.artworkUrl, item.faviconURL, item.tabId, item.url]);

  const [candidateIndex, setCandidateIndex] = useState(0);

  const candidatesSignature = useMemo(() => candidates.map((c) => c.key).join("|"), [candidates]);
  useEffect(() => {
    setCandidateIndex(0);
  }, [candidatesSignature]);

  const activeCandidate = candidates[candidateIndex];
  const advanceCandidate = useCallback(() => {
    setCandidateIndex((prev) => prev + 1);
  }, []);

  if (!activeCandidate) {
    return <Music2 className="size-4 text-primary" />;
  }

  return (
    <img
      key={activeCandidate.key}
      src={activeCandidate.src}
      alt=""
      referrerPolicy={activeCandidate.kind === "artwork" ? "no-referrer" : undefined}
      className={activeCandidate.kind === "artwork" ? "size-full object-cover" : "size-5 rounded-xs object-contain"}
      style={{ userSelect: "none", WebkitUserDrag: "none" } as React.CSSProperties}
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth === 0) {
          advanceCandidate();
        }
      }}
      onError={advanceCandidate}
    />
  );
}

function MediaPlayerCard({
  item,
  onControl
}: {
  item: MediaTabInfo;
  onControl: (tabId: number, action: MediaControlAction) => void;
}) {
  const subtitle = item.mediaArtist || URL.parse(item.url)?.hostname.replace(/^www\./, "") || "Media";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => lumi.tabs.switchToTab(item.tabId)}
          className="size-9 rounded-lg overflow-hidden bg-black/10 dark:bg-white/10 shrink-0 flex items-center justify-center ring-1 ring-black/10 dark:ring-white/15 cursor-pointer hover:opacity-90 transition-opacity"
          title="Jump to media tab"
        >
          <MediaThumbnail item={item} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-black/90 dark:text-white/95 truncate">
            {item.mediaTitle || item.title}
          </div>
          <div className="text-[10px] text-black/55 dark:text-white/55 truncate">{subtitle}</div>
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
