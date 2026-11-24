import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, History, RotateCcw, StickyNote } from "lucide-react";
import type { RecentlyClosedTabData } from "~/types/tabs";
import { WebsiteFavicon } from "@/components/main/website-favicon";
import { Button } from "@/components/ui/button";
import type { NewTabWidgetPrefs } from "./studio-wallpapers";

function formatRelativeTime(timestamp: number): string {
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const diffSec = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface NewTabWidgetsGridProps {
  prefs: NewTabWidgetPrefs;
  spaceId?: string;
  spaceName?: string;
}

export function NewTabWidgetsGrid({ prefs, spaceId, spaceName }: NewTabWidgetsGridProps) {
  const [recentTabs, setRecentTabs] = useState<RecentlyClosedTabData[]>([]);
  const [notes, setNotes] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showRecent = prefs.recentlyClosed;
  const showScratchpad = prefs.scratchpad && Boolean(spaceId);

  useEffect(() => {
    if (!showRecent || typeof lumi === "undefined") return;
    let active = true;
    void lumi.tabs
      .getRecentlyClosed()
      .then((items) => {
        if (active) setRecentTabs(items.slice(0, 4));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [showRecent]);

  useEffect(() => {
    if (!showScratchpad || !spaceId || typeof lumi === "undefined") return;
    let active = true;
    void lumi.spaces
      .getSpaceNotes(spaceId)
      .then((content) => {
        if (active) setNotes(content || "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [showScratchpad, spaceId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleNoteChange = (nextValue: string) => {
    setNotes(nextValue);
    if (!spaceId || typeof lumi === "undefined") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void lumi.spaces.saveSpaceNotes(spaceId, nextValue).then(() => {
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 1200);
      });
    }, 350);
  };

  const handleRestoreTab = (item: RecentlyClosedTabData) => {
    if (typeof lumi === "undefined") return;
    void lumi.tabs.restoreRecentlyClosed(item.tabData.uniqueId).then((restored) => {
      if (restored) {
        setRecentTabs((prev) => prev.filter((t) => t.tabData.uniqueId !== item.tabData.uniqueId));
      }
    });
  };

  if (!showRecent && !showScratchpad) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 md:grid-cols-2"
    >
      {showRecent && (
        <div className="lumi-glass-panel flex flex-col justify-between p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <RotateCcw className="size-3.5 text-primary" />
              Recently Closed
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => lumi.navigation.goTo("lumi://history", undefined, true)}
            >
              <History className="mr-1 size-3" />
              History
            </Button>
          </div>

          {recentTabs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-black/10 py-6 text-xs text-muted-foreground dark:border-white/10">
              No recently closed tabs yet
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentTabs.map((item) => (
                <motion.button
                  key={item.tabData.uniqueId}
                  type="button"
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: "spring", stiffness: 460, damping: 32 }}
                  onClick={() => handleRestoreTab(item)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/8 cursor-pointer"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-xs dark:bg-white/10">
                    <WebsiteFavicon
                      url={item.tabData.url}
                      favicon={item.tabData.faviconURL ?? undefined}
                      className="size-4 rounded-xs"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground">
                      {item.tabData.title || getHostname(item.tabData.url)}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">{getHostname(item.tabData.url)}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelativeTime(item.closedAt)}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {showScratchpad && (
        <div className="lumi-glass-panel flex flex-col p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <StickyNote className="size-3.5 text-primary" />
              {spaceName ? `${spaceName} Scratchpad` : "Space Scratchpad"}
            </div>
            <AnimatePresence>
              {savedNotice && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9, y: 2 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -2 }}
                  transition={{ duration: 0.14 }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                >
                  <Check className="size-3" /> Saved
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <textarea
            value={notes}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Jot down quick notes, links, or tasks for this Space..."
            rows={5}
            className="min-h-[118px] w-full flex-1 resize-none rounded-xl border border-black/8 bg-black/3 px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none dark:border-white/10 dark:bg-white/4"
          />
        </div>
      )}
    </motion.div>
  );
}
