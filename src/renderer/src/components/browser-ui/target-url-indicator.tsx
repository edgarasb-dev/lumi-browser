import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PortalComponent } from "@/components/portal/portal";
import { useBoundingRect } from "@/hooks/use-bounding-rect";
import { useFocusedTabId, useTabIds } from "@/components/providers/tabs-provider";
import { cn } from "@/lib/utils";
import type { TabTargetUrlUpdate } from "~/types/tabs";
import { AnimatePresence, motion } from "motion/react";
import { useUnmount } from "react-use";
import { MailIcon } from "lucide-react";

const PADDING = 8;
const BAR_HEIGHT = 28;

/**
 * Must match inherited UI text: `:root` in `src/renderer/src/index.css` sets
 * `system-ui, Inter, sans-serif` — font defined in `src/renderer/src/index.css`.
 * `text-xs` → 12px; `font-semibold` → 600.
 */
const TARGET_URL_INDICATOR_FONT = "600 12px system-ui,Inter,sans-serif";

/** Horizontal padding (`px-2` × 2) + border (1px × 2). */
const TARGET_URL_HORIZONTAL_CHROME_PX = 16 + 2;

const MAIL_EXTRA_WIDTH = 16 + 6; // MailIcon size (16px) + gap (6px)

interface TargetUrlIndicatorProps {
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

type CommonProtocolType = "http" | "mailto";
function improveUrlReadability(url: string): { protocolType: CommonProtocolType | null; strippedUrl: string } {
  let protocolType: CommonProtocolType | null = null;
  let newUrl = url;

  // Strip common protocols + record them
  const strippedHttp = url.replace(/^https?:\/\//i, "");
  const strippedMailto = url.replace(/^mailto:/i, "");
  if (strippedHttp !== url) {
    protocolType = "http";
    newUrl = strippedHttp;
  } else if (strippedMailto !== url) {
    protocolType = "mailto";
    newUrl = strippedMailto;
  }

  // Strip trailing slashes
  newUrl = newUrl.replace(/\/+$/, "");

  return { protocolType, strippedUrl: newUrl };
}

// If there is no current url, show URL after 500ms
// If there is a current url, switch to new url instantly
// If there is a current url and new url is empty, wait 500ms and then switch to empty url
// If the focused tab id changes, update the url immediately
function useDelayedUrl(url: string = "", focusedTabId: number | null = null) {
  const [showing, setShowing] = useState(false);

  const lastUrl = useRef("");
  const lastProtocolType = useRef<CommonProtocolType | null>(null);
  const newUrl = url.trim();
  if (newUrl !== "") {
    const { protocolType, strippedUrl } = improveUrlReadability(newUrl);
    lastUrl.current = strippedUrl;
    lastProtocolType.current = protocolType;
  }

  const timerRef = useRef<{ timeout: NodeJS.Timeout; type: "show" | "hide" } | null>(null);
  const lastFocusedTabId = useRef<number | null>(null);
  const removeTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current.timeout);
    }
    timerRef.current = null;
  }, []);
  useEffect(() => {
    const sameTab = lastFocusedTabId.current === focusedTabId;
    if (!sameTab) {
      lastFocusedTabId.current = focusedTabId;
    }

    const shouldUseTimeout = sameTab;
    if (!showing && newUrl) {
      if (!timerRef.current || timerRef.current.type !== "show" || !shouldUseTimeout) {
        removeTimer();
        const callback = () => {
          setShowing(true);
        };
        if (shouldUseTimeout) {
          const timeout = setTimeout(callback, 500);
          timerRef.current = { timeout, type: "show" };
        } else {
          callback();
        }
      }
    } else if (showing && !newUrl) {
      if (!timerRef.current || timerRef.current.type !== "hide" || !shouldUseTimeout) {
        removeTimer();
        const callback = () => {
          setShowing(false);
        };
        if (shouldUseTimeout) {
          const timeout = setTimeout(callback, 500);
          timerRef.current = { timeout, type: "hide" };
        } else {
          callback();
        }
      }
    } else {
      removeTimer();
    }
  }, [newUrl, showing, removeTimer, focusedTabId]);

  useUnmount(() => {
    removeTimer();
  });

  return {
    url: showing ? lastUrl.current : "",
    protocolType: lastProtocolType.current
  };
}

function UnmountDetector({ onUnmount }: { onUnmount: () => void }) {
  useUnmount(() => {
    onUnmount();
  });
  return null;
}

function ActiveTargetUrlPortal({
  anchorRef,
  url,
  protocolType,
  focusedTabId,
  onHideCompleted
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  url: string;
  protocolType: CommonProtocolType | null;
  focusedTabId: number | null;
  onHideCompleted: () => void;
}) {
  const anchorRect = useBoundingRect(anchorRef);
  const lastPortalStyle = useRef<CSSProperties | null>(null);

  const portalStyle = useMemo((): CSSProperties | null => {
    if (!anchorRect || !url) return null;

    let extraWidth = 0;
    if (protocolType === "mailto") {
      extraWidth += MAIL_EXTRA_WIDTH;
    }

    const prepared = prepareWithSegments(url, TARGET_URL_INDICATOR_FONT);
    const textWidth = measureNaturalWidth(prepared);
    const naturalBarWidth = Math.ceil(textWidth + TARGET_URL_HORIZONTAL_CHROME_PX + extraWidth);
    const maxWidth = anchorRect.width * 0.6;
    const barWidth = Math.min(naturalBarWidth, maxWidth);
    if (barWidth <= 0) return null;

    return {
      left: anchorRect.left + PADDING,
      bottom: window.innerHeight - anchorRect.bottom + PADDING,
      width: barWidth,
      height: BAR_HEIGHT
    };
  }, [anchorRect, url, protocolType]);

  if (portalStyle) {
    lastPortalStyle.current = portalStyle;
  }

  if (!lastPortalStyle.current) return null;

  return (
    <PortalComponent visible={true} layerType="tabTargetUrlIndicator" className="fixed" style={lastPortalStyle.current}>
      {/* key={focusedTabId} so the component re-creates WITHOUT the exit animation on tab change */}
      <AnimatePresence key={focusedTabId} onExitComplete={onHideCompleted}>
        <UnmountDetector key="presence-unmount-detector" onUnmount={onHideCompleted} />
        {url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeInOut" }}
            className={cn(
              "flex h-full w-full items-end justify-start gap-1.5",
              "pointer-events-none select-none",
              "rounded-full px-2 py-1 text-xs",
              "border border-sidebar-border/25",
              "space-background-dark text-white/80"
            )}
          >
            {protocolType === "mailto" && <MailIcon className="size-4" />}
            <span className="min-w-0 max-w-full truncate font-semibold">{url}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </PortalComponent>
  );
}

/**
 * Chrome-like hover URL preview at the bottom-left of the browser content area.
 * Uses PortalComponent so it stacks above the tab WebContentsView (same pattern as FindInPage).
 */
export function TargetUrlIndicator({ anchorRef }: TargetUrlIndicatorProps) {
  const focusedTabId = useFocusedTabId();
  const tabIds = useTabIds();
  const [urlsByTabId, setUrlsByTabId] = useState(() => new Map<number, string>());

  useEffect(() => {
    return lumi.tabs.onTargetUrlChanged((update: TabTargetUrlUpdate) => {
      setUrlsByTabId((prev) => {
        const next = new Map(prev);
        if (update.url) {
          next.set(update.tabId, update.url);
        } else {
          next.delete(update.tabId);
        }
        return next;
      });
    });
  }, []);

  useEffect(() => {
    setUrlsByTabId((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!tabIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tabIds]);

  const currentUrl = focusedTabId != null ? urlsByTabId.get(focusedTabId) : undefined;
  const { url, protocolType } = useDelayedUrl(currentUrl, focusedTabId);

  const [urlPresent, setUrlPresent] = useState(false);
  useEffect(() => {
    if (url) {
      setUrlPresent(true);
    }
  }, [url]);

  const handleHideCompleted = useCallback(() => {
    setUrlPresent(false);
  }, []);

  if (!urlPresent) {
    return null;
  }

  return (
    <ActiveTargetUrlPortal
      anchorRef={anchorRef}
      url={url}
      protocolType={protocolType}
      focusedTabId={focusedTabId}
      onHideCompleted={handleHideCompleted}
    />
  );
}
