import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { useSpaces } from "@/components/providers/spaces-provider";
import { SpaceIcon } from "@/lib/phosphor-icons";
import { cn } from "@/lib/utils";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { Check, ChevronUp, OrbitIcon, Palette } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Space } from "~/lumi/interfaces/sessions/spaces";
import { isFolderTabSource, isTabGroupSource } from "../drag-utils";
import { SpaceThemePopover } from "../space-theme-popover";

function SpaceDropdownRow({
  space,
  isActive,
  onSelect,
  onCustomize
}: {
  space: Space;
  isActive: boolean;
  onSelect: () => void;
  onCustomize: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        if (isTabGroupSource(source.data)) {
          return source.data.profileId === space.profileId && source.data.spaceId !== space.id;
        }
        if (isFolderTabSource(source.data)) {
          return source.data.profileId === space.profileId && source.data.spaceId !== space.id;
        }
        return false;
      },
      onDragEnter: () => setIsDragOver(true),
      onDragLeave: () => setIsDragOver(false),
      onDrop: ({ source }) => {
        setIsDragOver(false);
        if (isTabGroupSource(source.data)) {
          if (source.data.mode === "folder") {
            void lumi.tabs.moveTabGroupToSpace(source.data.tabGroupId, space.id);
          } else {
            void lumi.tabs.moveTabToWindowSpace(source.data.primaryTabId, space.id);
          }
          onSelect();
        } else if (isFolderTabSource(source.data)) {
          void lumi.tabs.moveTabToWindowSpace(source.data.tabId, space.id);
          onSelect();
        }
      }
    });
  }, [onSelect, space.id, space.profileId]);

  const badgeGradient =
    space.bgStartColor && space.bgEndColor
      ? `linear-gradient(135deg, ${space.bgStartColor}, ${space.bgEndColor})`
      : undefined;

  return (
    <div
      ref={rowRef}
      className={cn(
        "group flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors",
        isDragOver && "bg-black/12 dark:bg-white/16 ring-1 ring-black/15 dark:ring-white/25",
        !isDragOver &&
          (isActive ? "bg-black/[0.08] dark:bg-white/[0.12]" : "hover:bg-black/[0.05] dark:hover:bg-white/[0.08]")
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer py-0.5 px-0.5"
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border border-black/10 dark:border-white/15",
            !badgeGradient && "bg-black/15 dark:bg-white/15"
          )}
          style={badgeGradient ? { backgroundImage: badgeGradient } : undefined}
        >
          <SpaceIcon id={space.icon} strokeWidth={2} className="size-3 text-white drop-shadow-xs" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-black dark:text-white">{space.name}</span>
        {isActive && <Check className="size-3.5 shrink-0 text-black/70 dark:text-white/80" />}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCustomize();
        }}
        title={`Customize ${space.name}`}
        className={cn(
          "size-6 shrink-0 inline-flex items-center justify-center rounded-md cursor-pointer transition-all",
          "text-black/45 hover:text-black hover:bg-black/[0.08] dark:text-white/45 dark:hover:text-white dark:hover:bg-white/[0.12]",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        )}
      >
        <Palette className="size-3" />
      </button>
    </div>
  );
}

export function SpaceDropdownSwitcher({ className }: { className?: string } = {}) {
  const { spaces, currentSpace, isCurrentSpaceInternal, isCurrentSpaceLight, setCurrentSpace } = useSpaces();
  const [open, setOpen] = useState(false);
  const [themeSpaceId, setThemeSpaceId] = useState<string | null>(null);
  const [draggingOverTrigger, setDraggingOverTrigger] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onCloseOtherPopovers = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "spaces") {
        setOpen(false);
        setThemeSpaceId(null);
      }
    };
    window.addEventListener("lumi:close-footer-popovers", onCloseOtherPopovers);
    return () => window.removeEventListener("lumi:close-footer-popovers", onCloseOtherPopovers);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      window.dispatchEvent(new CustomEvent("lumi:close-footer-popovers", { detail: "spaces" }));
    }
    setOpen(nextOpen);
  };

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  useEffect(() => {
    const element = triggerRef.current;
    if (!element || !currentSpace || spaces.length <= 1) return;

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        if (isTabGroupSource(source.data)) {
          return source.data.profileId === currentSpace.profileId;
        }
        if (isFolderTabSource(source.data)) {
          return source.data.profileId === currentSpace.profileId;
        }
        return false;
      },
      onDragEnter: () => {
        setDraggingOverTrigger(true);
        clearHoverTimer();
        hoverTimerRef.current = setTimeout(() => {
          setOpen(true);
          hoverTimerRef.current = null;
        }, 200);
      },
      onDragLeave: () => {
        setDraggingOverTrigger(false);
        clearHoverTimer();
      },
      onDrop: () => {
        setDraggingOverTrigger(false);
        clearHoverTimer();
      }
    });
  }, [currentSpace, spaces.length]);

  useEffect(() => clearHoverTimer, []);

  const themeSpace = useMemo(
    () => (themeSpaceId ? (spaces.find((s) => s.id === themeSpaceId) ?? null) : null),
    [spaces, themeSpaceId]
  );

  if (isCurrentSpaceInternal || !currentSpace || spaces.length === 0) {
    return null;
  }

  const spaceInjectedClasses = cn(isCurrentSpaceLight ? "" : "dark");

  return (
    <div className={cn("relative flex min-w-0 flex-1 justify-center", className)}>
      {themeSpace && (
        <SpaceThemePopover
          space={themeSpace}
          open={Boolean(themeSpace)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setThemeSpaceId(null);
            }
          }}
        >
          <span className="pointer-events-none absolute inset-0" aria-hidden="true" />
        </SpaceThemePopover>
      )}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          ref={triggerRef}
          type="button"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            setThemeSpaceId(currentSpace.id);
          }}
          title={`${currentSpace.name} (Right-click to customize)`}
          className={cn(
            "inline-flex h-7 max-w-full min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 cursor-pointer select-none",
            "text-black/85 dark:text-white/90 transition-[background-color,transform] duration-150 active:scale-[0.97]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/25",
            open || draggingOverTrigger
              ? "bg-black/[0.08] dark:bg-white/[0.12]"
              : "hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={currentSpace.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="inline-flex min-w-0 items-center gap-1.5"
            >
              <SpaceIcon id={currentSpace.icon} strokeWidth={2} className="size-3.5 shrink-0 opacity-80" />
              <span className="truncate text-[12.5px] font-medium tracking-[-0.01em]">{currentSpace.name}</span>
            </motion.span>
          </AnimatePresence>
          <ChevronUp
            className={cn("size-3 shrink-0 opacity-60 transition-transform duration-150", open && "rotate-180")}
          />
        </PopoverTrigger>

        <PopoverContent
          variant="translucent"
          side="top"
          align="center"
          sideOffset={8}
          className="w-56 p-1.5 select-none"
          positionerClassName={spaceInjectedClasses}
        >
          <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
            {spaces.map((space) => (
              <SpaceDropdownRow
                key={space.id}
                space={space}
                isActive={space.id === currentSpace.id}
                onSelect={() => {
                  setCurrentSpace(space.id);
                  setOpen(false);
                }}
                onCustomize={() => {
                  setOpen(false);
                  setThemeSpaceId(space.id);
                }}
              />
            ))}
          </div>

          <div className="my-1 h-px bg-black/[0.08] dark:bg-white/[0.1]" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              lumi.windows.openSettings("spaces");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-black/75 hover:bg-black/[0.05] hover:text-black dark:text-white/75 dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors cursor-pointer"
          >
            <OrbitIcon className="size-3.5 shrink-0 opacity-75" />
            <span>Manage Spaces</span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
