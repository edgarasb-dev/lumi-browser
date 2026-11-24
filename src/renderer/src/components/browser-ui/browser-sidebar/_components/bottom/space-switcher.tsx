import { Space } from "~/lumi/interfaces/sessions/spaces";
import { cn } from "@/lib/utils";
import { useSpaces } from "@/components/providers/spaces-provider";
import { SpaceIcon } from "@/lib/phosphor-icons";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TabGroupSourceData } from "@/components/browser-ui/browser-sidebar/_components/tab-group";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { AnimatePresence, motion } from "motion/react";
import { SpaceThemePopover } from "@/components/browser-ui/browser-sidebar/_components/space-theme-popover";
import {
  DOCK_BUTTON_CLASSES,
  DOCK_ICON_STROKE_WIDTH,
  getDockButtonClassName,
  type DockButtonSize
} from "./dock-button-sizes";

// Layout constants (px)
const COMPACT_GAP = 2; // gap-0.5
const FULL_GAP = 4; // gap-1

type SpaceButtonProps = {
  space: Space;
  isActive: boolean;
  compact: boolean;
  size: DockButtonSize;
  totalSpaces: number;
  activeLayoutId: string;
};

function SpaceButton({ space, isActive, compact, size, totalSpaces, activeLayoutId }: SpaceButtonProps) {
  const { setCurrentSpace } = useSpaces();

  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const draggingRef = useRef(false);
  draggingRef.current = dragging;

  const draggingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onClick = useCallback(() => {
    setCurrentSpace(space.id);
  }, [setCurrentSpace, space.id]);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const removeDraggingTimeout = useCallback(() => {
    if (draggingTimeoutRef.current) {
      clearTimeout(draggingTimeoutRef.current);
      draggingTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    function startDragging() {
      if (draggingRef.current) return;
      setDragging(true);

      if (!draggingTimeoutRef.current) {
        draggingTimeoutRef.current = setTimeout(() => {
          onClickRef.current();
          removeDraggingTimeout();
        }, 100);
      }
    }

    function stopDragging() {
      setDragging(false);
      removeDraggingTimeout();
    }

    return dropTargetForElements({
      element,
      canDrop: (args) => {
        const sourceData = args.source.data as TabGroupSourceData;
        if (sourceData.type !== "tab-group") return false;

        const sourceProfileId = sourceData.profileId;
        const targetProfileId = space.profileId;

        // Does not support moving tabs between profiles
        if (sourceProfileId !== targetProfileId) return false;

        // Don't allow dropping on the space the tab is already in
        if (sourceData.spaceId === space.id) return false;

        return true;
      },
      onDragEnter: startDragging,
      onDrag: startDragging,
      onDragLeave: stopDragging,
      onDrop: (args) => {
        stopDragging();

        // Move the tab to this space (no specific position — append to end)
        const sourceData = args.source.data as TabGroupSourceData;
        const sourceTabId = sourceData.primaryTabId;
        lumi.tabs.moveTabToWindowSpace(sourceTabId, space.id);
      }
    });
  }, [onClick, removeDraggingTimeout, space.profileId, space.id]);

  const showIcon = !compact || isHovered || isActive;
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const sizeClasses = DOCK_BUTTON_CLASSES[size];
  const isButtonActive = isThemeOpen || dragging || (isActive && totalSpaces > 1);

  return (
    <SpaceThemePopover space={space} open={isThemeOpen} onOpenChange={setIsThemeOpen}>
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsThemeOpen(true);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={`${space.name} (Right-click to customize)`}
        className={cn(
          "relative",
          showIcon
            ? cn(
                getDockButtonClassName(size, { active: isThemeOpen || dragging }),
                isActive && totalSpaces > 1 && "text-black dark:text-white",
                !isActive && "opacity-65 hover:opacity-100"
              )
            : cn(
                "group relative shrink-0 inline-flex items-center justify-center cursor-pointer select-none transition-all duration-150",
                size === "xs" ? "rounded-md" : "rounded-lg",
                sizeClasses.spaceDot,
                "hover:bg-black/[0.08] dark:hover:bg-white/[0.12]",
                dragging && "bg-black/[0.1] dark:bg-white/[0.16]"
              )
        )}
      >
        {isButtonActive && isActive && !isThemeOpen && !dragging && (
          <motion.span
            layoutId={activeLayoutId}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className={cn(
              "pointer-events-none absolute inset-0",
              size === "xs" ? "rounded-md" : "rounded-lg",
              "bg-black/[0.1] dark:bg-white/[0.16]"
            )}
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          {showIcon ? (
            <motion.div
              key="icon"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
              className="relative z-10 flex items-center justify-center"
            >
              <SpaceIcon
                id={space.icon}
                strokeWidth={DOCK_ICON_STROKE_WIDTH}
                className={cn(sizeClasses.icon, "transition-colors duration-150")}
              />
            </motion.div>
          ) : (
            <motion.div
              key="dot"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "size-1.5 rounded-full transition-colors duration-150",
                "bg-black/35 group-hover:bg-black/75 dark:bg-white/35 dark:group-hover:bg-white/80"
              )}
            />
          )}
        </AnimatePresence>
      </button>
    </SpaceThemePopover>
  );
}

/**
 * Compute which spaces are visible given the available width.
 * When all spaces fit as icons, returns compact=false.
 * Otherwise returns a windowed subset around the active space with compact=true.
 */
function useVisibleSpaces(spaces: Space[], activeIndex: number, containerWidth: number | null, size: DockButtonSize) {
  return useMemo<{ visibleSpaces: Space[]; compact: boolean }>(() => {
    if (spaces.length === 0) {
      return { visibleSpaces: [], compact: false };
    }

    const { buttonPx: iconSize, spaceDotPx: dotSize } = DOCK_BUTTON_CLASSES[size];

    // Before first layout measurement, render uncompacted so shrink-wrapped parents can expand.
    if (containerWidth === null) {
      return { visibleSpaces: spaces, compact: false };
    }

    // Never overflow into adjacent dock controls when available width is smaller than a single icon.
    if (containerWidth < iconSize) {
      return { visibleSpaces: [], compact: true };
    }

    // Check if everything fits as full icons
    const allIconsNeeded = spaces.length * iconSize + Math.max(0, spaces.length - 1) * FULL_GAP;
    if (allIconsNeeded <= containerWidth) {
      return { visibleSpaces: spaces, compact: false };
    }

    // Compact mode: 1 active icon + surrounding dots
    const totalNeeded = iconSize + Math.max(0, spaces.length - 1) * (dotSize + COMPACT_GAP);
    if (totalNeeded <= containerWidth) {
      return { visibleSpaces: spaces, compact: true };
    }

    // Budget for dots after reserving space for the active icon
    const remaining = containerWidth - iconSize;
    const maxDots = Math.max(0, Math.floor(remaining / (dotSize + COMPACT_GAP)));

    // Distribute dots equally left and right of active
    let leftCount = Math.floor(maxDots / 2);
    let rightCount = maxDots - leftCount;

    // Clamp to actual available spaces on each side
    const availableLeft = activeIndex;
    const availableRight = spaces.length - 1 - activeIndex;

    if (leftCount > availableLeft) {
      // Redistribute excess to the right
      rightCount = Math.min(availableRight, rightCount + (leftCount - availableLeft));
      leftCount = availableLeft;
    } else if (rightCount > availableRight) {
      // Redistribute excess to the left
      leftCount = Math.min(availableLeft, leftCount + (rightCount - availableRight));
      rightCount = availableRight;
    }

    const start = activeIndex - leftCount;
    const end = activeIndex + rightCount + 1;
    return { visibleSpaces: spaces.slice(start, end), compact: true };
  }, [spaces, activeIndex, containerWidth, size]);
}

export function SpaceSwitcher({
  className,
  size = "sm",
  availableWidth
}: {
  className?: string;
  size?: DockButtonSize;
  availableWidth?: number;
} = {}) {
  const { spaces, currentSpace, isCurrentSpaceInternal } = useSpaces();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLayoutId = useId();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const hasSpaces = spaces.length > 0;

  useLayoutEffect(() => {
    if (availableWidth !== undefined || !hasSpaces || isCurrentSpaceInternal) {
      setMeasuredWidth(null);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const measure = (width: number) => {
      setMeasuredWidth(width);
    };

    measure(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        measure(entry.contentBoxSize?.[0]?.inlineSize ?? el.getBoundingClientRect().width);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [availableWidth, hasSpaces, isCurrentSpaceInternal]);

  const effectiveWidth = availableWidth !== undefined ? availableWidth : measuredWidth;

  const activeIndex = useMemo(() => {
    if (!currentSpace) return 0;
    const idx = spaces.findIndex((s) => s.id === currentSpace.id);
    return idx >= 0 ? idx : 0;
  }, [spaces, currentSpace]);

  const { visibleSpaces, compact } = useVisibleSpaces(spaces, activeIndex, effectiveWidth, size);

  // Don't show the space switcher when the current space is internal (e.g. incognito)
  if (isCurrentSpaceInternal) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={availableWidth !== undefined ? { maxWidth: availableWidth } : undefined}
      className={cn("w-fit min-w-0 overflow-hidden flex items-center shrink-0", className)}
    >
      <div className={cn("flex flex-row items-center", compact ? "gap-0.5" : "gap-1")}>
        {visibleSpaces.map((space) => (
          <SpaceButton
            key={space.id}
            space={space}
            isActive={currentSpace?.id === space.id}
            compact={compact}
            size={size}
            totalSpaces={spaces.length}
            activeLayoutId={activeLayoutId}
          />
        ))}
      </div>
    </div>
  );
}
