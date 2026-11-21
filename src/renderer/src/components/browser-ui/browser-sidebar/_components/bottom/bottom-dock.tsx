import { useLayoutEffect, useRef, useState } from "react";
import { PanelRight } from "lucide-react";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useSidePanel } from "@/components/providers/side-panel-provider";
import { cn } from "@/lib/utils";
import { BottomExtrasMenu } from "./bottom-extras-menu";
import { DownloadsButton } from "../downloads-button";
import { RecentlyClosedPopover } from "../recently-closed-popover";
import { SpaceScratchpad } from "../space-scratchpad";
import { SpaceSwitcher } from "./space-switcher";
import { DOCK_BUTTON_CLASSES, type DockButtonSize } from "./dock-button-sizes";

// Layout budget inside the dock pill (px), matching size-7 (28px) buttons and gap-0.5 (2px).
const FLANKING_BUTTONS_WIDTH = 146; // Left 3 (88px) + Right 2 (58px)
const SINGLE_SPACE_INLINE_MIN = FLANKING_BUTTONS_WIDTH + 32; // 1 icon (28px) + gap-0.5 each side (4px)
const MULTI_SPACE_INLINE_MIN = FLANKING_BUTTONS_WIDTH + 54; // 1 icon + 1 dot (50px) + gap-0.5 each side (4px)
const COMPACT_BUTTONS_THRESHOLD = 152; // Below this inner width, step buttons down from 28px to 24px (126px total)
const DOCK_HORIZONTAL_CHROME = 10; // px-1 (8px) + border (2px)

/**
 * Responsive sidebar bottom dock. Keeps all action buttons and the space switcher
 * unclipped across the full sidebar resize range (150px..500px) by promoting the
 * space switcher onto its own top row when inline width runs short and scaling
 * action buttons uniformly at narrow widths without remounting popovers.
 */
export function BottomDock() {
  const { spaces, isCurrentSpaceInternal } = useSpaces();
  const { isOpen: sidePanelOpen, toggleOpen: toggleSidePanel } = useSidePanel();
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockOuterWidth, setDockOuterWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = dockRef.current;
    if (!el) return;

    setDockOuterWidth(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDockOuterWidth(entry.contentBoxSize?.[0]?.inlineSize ?? el.getBoundingClientRect().width);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dockInnerWidth = dockOuterWidth !== null ? Math.max(0, dockOuterWidth - DOCK_HORIZONTAL_CHROME) : null;
  const hasVisibleSpaces = !isCurrentSpaceInternal && spaces.length > 0;
  const inlineMinWidth = spaces.length > 1 ? MULTI_SPACE_INLINE_MIN : SINGLE_SPACE_INLINE_MIN;

  const isStacked = hasVisibleSpaces && dockInnerWidth !== null && dockInnerWidth < inlineMinWidth;
  const buttonSize: DockButtonSize =
    dockInnerWidth !== null && dockInnerWidth < COMPACT_BUTTONS_THRESHOLD ? "xs" : "sm";

  return (
    <div ref={dockRef} data-no-drag className="shrink-0 mt-1 mb-2 w-full min-w-0">
      <div
        className={cn(
          "flex items-center justify-between rounded-xl px-1 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08]",
          isStacked ? "flex-wrap py-1 gap-y-1" : "flex-nowrap gap-0.5 h-9"
        )}
      >
        <div className={cn("flex items-center gap-0.5 shrink-0", isStacked ? "order-2" : "order-1")}>
          <BottomExtrasMenu size={buttonSize} />
          <DownloadsButton size={buttonSize} />
          <RecentlyClosedPopover size={buttonSize} />
        </div>

        <SpaceSwitcher
          className={cn(
            isStacked
              ? "order-1 basis-full w-full flex-none pb-1 border-b border-black/[0.05] dark:border-white/[0.08]"
              : "order-2"
          )}
        />

        <div className="flex items-center gap-0.5 shrink-0 order-3">
          <SpaceScratchpad size={buttonSize} />
          <button
            type="button"
            onClick={toggleSidePanel}
            title="Toggle Split Side Panel (Cmd+Shift+.)"
            className={cn(
              DOCK_BUTTON_CLASSES[buttonSize].button,
              "flex items-center justify-center transition-colors",
              sidePanelOpen
                ? "bg-primary/20 text-primary dark:bg-primary/30"
                : "text-black/65 hover:bg-black/8 hover:text-black/90 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
            )}
          >
            <PanelRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
