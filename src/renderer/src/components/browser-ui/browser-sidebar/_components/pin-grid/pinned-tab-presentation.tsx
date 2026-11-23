import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useFaviconColors } from "@/hooks/use-favicon-color";
import { generateBorderGradient } from "@/components/browser-ui/browser-sidebar/_components/pin-grid/pin-visual";
import { formatUnreadCount, getTabUnreadCount } from "@/lib/unread-badge";
import { cn } from "@/lib/utils";
import type { PinnedTabData } from "~/types/pinned-tabs";
import type { TabData } from "~/types/tabs";

/**
 * Shared visual & metadata state for a pinned tab button across both
 * vertical sidebar tiles and horizontal topbar pins.
 */
export function usePinnedTabPresentation({
  pinnedTab,
  associatedTab,
  isActive
}: {
  pinnedTab: PinnedTabData;
  associatedTab?: TabData;
  isActive: boolean;
}) {
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const preferredFaviconUrl = associatedTab?.faviconURL || pinnedTab.faviconUrl;

  useEffect(() => {
    setPrimaryFailed(false);
    setFallbackFailed(false);
  }, [preferredFaviconUrl, pinnedTab.defaultUrl]);

  const fallbackLumiFaviconUrl = useMemo(() => {
    if (!pinnedTab.defaultUrl) return null;
    try {
      const srcUrl = new URL("lumi://favicon");
      srcUrl.searchParams.set("url", pinnedTab.defaultUrl);
      return srcUrl.toString();
    } catch {
      return null;
    }
  }, [pinnedTab.defaultUrl]);

  const faviconUrl = useMemo(() => {
    if (preferredFaviconUrl && !primaryFailed) {
      return preferredFaviconUrl;
    }
    if (!fallbackFailed) {
      return fallbackLumiFaviconUrl;
    }
    return null;
  }, [preferredFaviconUrl, primaryFailed, fallbackFailed, fallbackLumiFaviconUrl]);

  const handleImageError = useCallback(() => {
    if (preferredFaviconUrl && !primaryFailed) {
      setPrimaryFailed(true);
    } else {
      setFallbackFailed(true);
    }
  }, [preferredFaviconUrl, primaryFailed]);

  const faviconColors = useFaviconColors(faviconUrl);
  const hasColors = faviconColors !== null;

  const activeBorderStyle = useMemo(() => {
    if (!isActive || !hasColors) return undefined;
    return {
      "--gradient-border": generateBorderGradient(faviconColors, 0.6)
    } as React.CSSProperties;
  }, [faviconColors, hasColors, isActive]);

  const activeOverlayStyle = useMemo(() => {
    if (!isActive || !hasColors) return undefined;
    return {
      backgroundImage: generateBorderGradient(faviconColors, 0.15)
    } as React.CSSProperties;
  }, [faviconColors, hasColors, isActive]);

  const unreadCount = useMemo(
    () => getTabUnreadCount(associatedTab, pinnedTab.defaultUrl),
    [associatedTab, pinnedTab.defaultUrl]
  );

  const tooltipTitle = useMemo(() => {
    const title = associatedTab?.title?.trim();
    return title ? title : pinnedTab.defaultUrl;
  }, [associatedTab?.title, pinnedTab.defaultUrl]);

  return {
    faviconUrl,
    handleImageError,
    hasColors,
    activeBorderStyle,
    activeOverlayStyle,
    unreadCount,
    tooltipTitle
  };
}

/**
 * Luminous Liquid Glass unread count pill rendered on pinned tabs (e.g. Gmail unread emails).
 */
export function PinnedTabBadge({
  count,
  variant = "tile"
}: {
  count: number | null;
  variant?: "tile" | "tile-compact" | "compact";
}) {
  const formatted = count !== null && count > 0 ? formatUnreadCount(count) : null;

  return (
    <AnimatePresence>
      {formatted && (
        <motion.span
          key={formatted}
          initial={{ opacity: 0, scale: 0.55 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.55 }}
          transition={{ type: "spring", stiffness: 520, damping: 28 }}
          aria-label={`${count} unread`}
          className={cn(
            "pointer-events-none select-none z-10 flex items-center justify-center rounded-full tabular-nums leading-none text-white",
            "bg-linear-to-b from-rose-400 to-rose-600",
            "shadow-[0_2px_6px_rgba(244,63,94,0.45),inset_0_1px_0_rgba(255,255,255,0.4)]",
            variant === "tile"
              ? "absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1.5 text-[10px] font-semibold ring-1 ring-white/45 dark:ring-black/30"
              : variant === "tile-compact"
                ? "absolute top-1 right-1 min-w-[15px] h-[15px] px-1 text-[9px] font-semibold ring-1 ring-white/45 dark:ring-black/30"
                : "absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 text-[9.5px] font-bold ring-1 ring-white/80 dark:ring-neutral-900/80"
          )}
        >
          {formatted}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
