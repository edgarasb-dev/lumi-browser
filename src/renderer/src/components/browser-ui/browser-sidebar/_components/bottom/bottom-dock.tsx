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
import {
  DOCK_BUTTON_CLASSES,
  DOCK_ICON_STROKE_WIDTH,
  getDockButtonClassName,
  type DockButtonSize
} from "./dock-button-sizes";

const TOOL_COUNT = 5;
const DOCK_GAP_PX = 2; // gap-0.5
const DIVIDER_FOOTPRINT_PX = 5; // gap-0.5 (2) + w-px (1) + gap-0.5 (2)
const CHROME_SM_PX = 10; // px-1 (8px) + border (2px)
const CHROME_XS_PX = 6; // px-0.5 (4px) + border (2px)

function toolsWidth(count: number, size: DockButtonSize): number {
  return count * DOCK_BUTTON_CLASSES[size].buttonPx + Math.max(0, count - 1) * DOCK_GAP_PX;
}

function minSingleRowWidth(size: DockButtonSize, spaceCount: number): number {
  const { buttonPx, spaceDotPx } = DOCK_BUTTON_CLASSES[size];
  const baseTools = toolsWidth(TOOL_COUNT, size);
  if (spaceCount === 0) return baseTools;
  if (spaceCount === 1) return buttonPx + DOCK_GAP_PX + baseTools;
  return buttonPx + DOCK_GAP_PX + spaceDotPx + DIVIDER_FOOTPRINT_PX + baseTools;
}

/**
 * Unified sidebar bottom dock. Keeps the space switcher and all five dock action
 * buttons visually cohesive on a single row down through default width (200px),
 * gracefully wrapping into two balanced rows only at ultra-narrow widths (down to 150px)
 * without ever remounting open popovers.
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

  const visibleSpaceCount = isCurrentSpaceInternal ? 0 : spaces.length;
  const hasVisibleSpaces = visibleSpaceCount > 0;
  const hasMultipleSpaces = visibleSpaceCount > 1;

  const innerSmWidth = dockOuterWidth !== null ? Math.max(0, dockOuterWidth - CHROME_SM_PX) : null;
  const innerXsWidth = dockOuterWidth !== null ? Math.max(0, dockOuterWidth - CHROME_XS_PX) : null;

  const fitsSmSingleRow = innerSmWidth === null || innerSmWidth >= minSingleRowWidth("sm", visibleSpaceCount);
  const buttonSize: DockButtonSize = fitsSmSingleRow ? "sm" : "xs";
  const isTwoRow =
    !fitsSmSingleRow && innerXsWidth !== null && innerXsWidth < minSingleRowWidth("xs", visibleSpaceCount);

  const activeInnerWidth = buttonSize === "sm" ? innerSmWidth : innerXsWidth;
  let spaceBudgetPx: number | undefined;
  if (hasVisibleSpaces && activeInnerWidth !== null) {
    const rowTools = isTwoRow ? toolsWidth(2, buttonSize) : toolsWidth(TOOL_COUNT, buttonSize);
    const separatorReserve = hasMultipleSpaces ? DIVIDER_FOOTPRINT_PX : DOCK_GAP_PX;
    spaceBudgetPx = Math.max(DOCK_BUTTON_CLASSES[buttonSize].buttonPx, activeInnerWidth - rowTools - separatorReserve);
  }

  return (
    <div ref={dockRef} data-no-drag className="shrink-0 mt-1 mb-2 w-full min-w-0">
      <div
        className={cn(
          "flex items-center justify-between rounded-xl border border-black/[0.06] bg-black/[0.04] dark:border-white/[0.08] dark:bg-white/[0.06]",
          buttonSize === "xs" ? "px-0.5" : "px-1",
          isTwoRow
            ? "flex-wrap py-1 gap-x-0.5 gap-y-1"
            : buttonSize === "xs"
              ? "flex-nowrap gap-0.5 h-8"
              : "flex-nowrap gap-0.5 h-9"
        )}
      >
        {hasVisibleSpaces && (
          <SpaceSwitcher
            key="spaces"
            size={buttonSize}
            availableWidth={spaceBudgetPx}
            className={isTwoRow ? "order-5" : "order-1"}
          />
        )}

        {hasMultipleSpaces && (
          <div
            key="divider"
            aria-hidden="true"
            className={cn("h-3.5 w-px bg-black/[0.1] dark:bg-white/[0.12] shrink-0", isTwoRow ? "order-6" : "order-2")}
          />
        )}

        <BottomExtrasMenu key="extras" size={buttonSize} className={isTwoRow ? "order-1" : "order-3"} />
        <DownloadsButton key="downloads" size={buttonSize} className={isTwoRow ? "order-2" : "order-4"} />
        <RecentlyClosedPopover key="history" size={buttonSize} className={isTwoRow ? "order-3" : "order-5"} />

        {isTwoRow && <div key="row-break" aria-hidden="true" className="basis-full h-0 order-4" />}

        <SpaceScratchpad key="scratchpad" size={buttonSize} className={isTwoRow ? "order-7" : "order-6"} />

        <button
          key="side-panel"
          type="button"
          onClick={toggleSidePanel}
          title="Toggle Split Side Panel (Cmd+Shift+.)"
          className={cn(
            getDockButtonClassName(buttonSize, { active: sidePanelOpen }),
            isTwoRow ? "order-8" : "order-7"
          )}
        >
          <PanelRight strokeWidth={DOCK_ICON_STROKE_WIDTH} className={DOCK_BUTTON_CLASSES[buttonSize].icon} />
        </button>
      </div>
    </div>
  );
}
