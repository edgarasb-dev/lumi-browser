import { cn } from "@/lib/utils";

/**
 * Shared sizing and visual tokens for buttons in the sidebar bottom dock and topbar tools.
 * Every dock action button and space button consumes these tokens so corner radius,
 * icon dimensions, resting tint, hover highlight, and active state stay identical across
 * both single-row and compact dock layouts.
 */
export type DockButtonSize = "default" | "sm" | "xs";

export const DOCK_ICON_STROKE_WIDTH = 2;

export const DOCK_BUTTON_CLASSES: Record<
  DockButtonSize,
  { button: string; icon: string; buttonPx: number; spaceDot: string; spaceDotPx: number }
> = {
  default: { button: "size-7 rounded-lg shrink-0", icon: "size-4", buttonPx: 28, spaceDot: "size-5", spaceDotPx: 20 },
  sm: { button: "size-7 rounded-lg shrink-0", icon: "size-4", buttonPx: 28, spaceDot: "size-5", spaceDotPx: 20 },
  xs: { button: "size-6 rounded-md shrink-0", icon: "size-3.5", buttonPx: 24, spaceDot: "size-3.5", spaceDotPx: 14 }
};

export function getDockButtonClassName(size: DockButtonSize = "sm", options?: { active?: boolean }): string {
  const active = options?.active ?? false;
  return cn(
    DOCK_BUTTON_CLASSES[size].button,
    "inline-flex items-center justify-center cursor-pointer select-none",
    "transition-all duration-150 active:scale-[0.95]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/25",
    active
      ? "bg-black/[0.1] text-black dark:bg-white/[0.16] dark:text-white"
      : "text-black/75 hover:bg-black/[0.08] hover:text-black dark:text-white/75 dark:hover:bg-white/[0.12] dark:hover:text-white"
  );
}
