import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn, craftActiveFaviconURL } from "@/lib/utils";
import type { TabData } from "~/types/tabs";
import { Globe, Volume2, VolumeX, Moon, Loader2, X, ExternalLink } from "lucide-react";

interface TabPreviewCardProps {
  tab: TabData;
  anchorRect: DOMRect | null;
  isOpen: boolean;
  onClose: () => void;
  onSwitchTab: () => void;
  onCloseTab: () => void;
  onToggleMute: () => void;
}

export const TabPreviewCard = memo(function TabPreviewCard({
  tab,
  anchorRect,
  isOpen,
  onClose,
  onSwitchTab,
  onCloseTab,
  onToggleMute
}: TabPreviewCardProps) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Parse hostname and path cleanly
  const domainInfo = useMemo(() => {
    try {
      if (!tab.url) return { domain: "New Tab", path: "" };
      const parsed = new URL(tab.url);
      if (parsed.protocol === "lumi:") {
        return {
          domain: "Lumi Internal",
          path: parsed.hostname || parsed.pathname
        };
      }
      return {
        domain: parsed.hostname.replace(/^www\./, ""),
        path: parsed.pathname === "/" ? "" : parsed.pathname
      };
    } catch {
      return { domain: tab.url || "Web Page", path: "" };
    }
  }, [tab.url]);

  // Fetch preview snapshot when opened
  useEffect(() => {
    if (!isOpen || !tab.id) {
      setSnapshotUrl(null);
      setImageError(false);
      return;
    }

    let isMounted = true;
    setIsFetching(true);
    setImageError(false);

    lumi.tabs
      .getTabPreview(tab.id)
      .then((res) => {
        if (isMounted) {
          if (res?.snapshotUrl) {
            setSnapshotUrl(res.snapshotUrl);
          }
          setIsFetching(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsFetching(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, tab.id]);

  if (!isOpen || !anchorRect) return null;

  // Compute smart vertical & horizontal positioning
  const cardWidth = Math.min(280, Math.max(220, anchorRect.width));
  const cardLeft = Math.max(8, Math.min(anchorRect.left, window.innerWidth - cardWidth - 8));

  // If tab is in lower 55% of the window, place card above tab; otherwise place below
  const isAbove = anchorRect.top > window.innerHeight * 0.55;
  const cardStyle: React.CSSProperties = {
    position: "fixed",
    left: `${cardLeft}px`,
    width: `${cardWidth}px`,
    zIndex: 9999,
    ...(isAbove
      ? { bottom: `${Math.max(12, window.innerHeight - anchorRect.top + 6)}px` }
      : { top: `${Math.max(12, anchorRect.bottom + 6)}px` })
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: isAbove ? 6 : -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: isAbove ? 4 : -4 }}
        transition={{ type: "spring", stiffness: 450, damping: 28 }}
        style={cardStyle}
        className={cn(
          "pointer-events-auto rounded-xl p-3 shadow-2xl",
          "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl",
          "border border-black/10 dark:border-white/15",
          "text-black dark:text-white select-none transition-shadow",
          "ring-1 ring-black/5 dark:ring-white/5"
        )}
        onMouseLeave={onClose}
      >
        {/* Top Header: Favicon + Domain pill + Badges */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {tab.faviconURL ? (
              <img
                src={craftActiveFaviconURL(tab.id, tab.faviconURL)}
                alt={domainInfo.domain}
                className="size-4 shrink-0 rounded-sm object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <Globe className="size-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="text-xs font-semibold text-muted-foreground truncate uppercase tracking-wider">
              {domainInfo.domain}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {tab.audible && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Volume2 className="size-2.5" /> Audio
              </span>
            )}
            {tab.muted && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <VolumeX className="size-2.5" /> Muted
              </span>
            )}
            {tab.asleep && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                <Moon className="size-2.5" /> Sleeping
              </span>
            )}
            {(tab.isLoading || isFetching) && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {/* Thumbnail Preview Area */}
        <div className="relative w-full h-28 rounded-lg overflow-hidden border border-black/5 dark:border-white/10 bg-muted/40 mb-2.5 flex items-center justify-center">
          {snapshotUrl && !imageError ? (
            <img
              src={snapshotUrl}
              alt={tab.title}
              className="w-full h-full object-cover object-top transition-opacity duration-200"
              onError={() => setImageError(true)}
            />
          ) : (
            /* Elegant Webpage Mock Placeholder */
            <div className="w-full h-full p-2.5 flex flex-col justify-between bg-gradient-to-br from-muted/30 to-muted/80">
              <div className="flex items-center gap-1 opacity-40">
                <div className="size-1.5 rounded-full bg-current" />
                <div className="size-1.5 rounded-full bg-current" />
                <div className="size-1.5 rounded-full bg-current" />
              </div>
              <div className="flex flex-col items-center justify-center text-center px-2 py-1">
                {tab.faviconURL ? (
                  <img
                    src={craftActiveFaviconURL(tab.id, tab.faviconURL)}
                    alt=""
                    className="size-6 mb-1.5 rounded-sm opacity-80"
                  />
                ) : (
                  <Globe className="size-6 mb-1.5 text-muted-foreground/60" />
                )}
                <span className="text-xs font-medium text-muted-foreground truncate max-w-full">
                  {domainInfo.domain}
                </span>
              </div>
              <div className="h-1 w-1/3 rounded-full bg-current opacity-15 self-center" />
            </div>
          )}

          {/* Quick Overlay Action on Image */}
          <button
            onClick={onSwitchTab}
            className="absolute inset-0 bg-black/0 hover:bg-black/20 dark:hover:bg-white/10 transition-colors flex items-center justify-center group"
            title="Switch to tab"
          >
            <span className="opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1 rounded-md text-[11px] font-medium bg-black/75 dark:bg-white/90 text-white dark:text-black backdrop-blur-sm shadow-md flex items-center gap-1">
              <ExternalLink className="size-3" /> Switch to tab
            </span>
          </button>
        </div>

        {/* Page Title & Path */}
        <div className="mb-2">
          <h4
            className="text-xs font-semibold leading-snug line-clamp-2 text-foreground mb-0.5 cursor-pointer hover:underline"
            onClick={onSwitchTab}
            title={tab.title}
          >
            {tab.title || domainInfo.domain}
          </h4>
          {domainInfo.path && (
            <p className="text-[11px] font-mono text-muted-foreground truncate max-w-full">{domainInfo.path}</p>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="pt-2 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[11px] text-muted-foreground">
          <button onClick={onSwitchTab} className="hover:text-foreground font-medium transition-colors">
            Click to switch
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (tab.asleep) {
                  lumi.tabs.wakeTab(tab.id);
                } else {
                  lumi.tabs.snoozeTab(tab.id);
                }
              }}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title={tab.asleep ? "Wake tab" : "Snooze tab to free memory"}
            >
              <Moon className={cn("size-3.5", tab.asleep && "text-indigo-500 fill-indigo-500/20")} />
            </button>
            <button
              onClick={onToggleMute}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title={tab.muted ? "Unmute tab" : "Mute tab"}
            >
              {tab.muted ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            </button>
            <button
              onClick={onCloseTab}
              className="p-1 rounded hover:bg-red-500/15 hover:text-red-500 transition-colors"
              title="Close tab"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
});
