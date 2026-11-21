/**
 * Shared sizing tokens for buttons in the sidebar bottom dock and topbar tools.
 * Keeping sizes centralized ensures all five dock buttons scale uniformly as the
 * sidebar is resized down to MIN_SIDEBAR_WIDTH (150px).
 */
export type DockButtonSize = "default" | "sm" | "xs";

export const DOCK_BUTTON_CLASSES: Record<DockButtonSize, { button: string; icon: string }> = {
  default: { button: "size-8 rounded-lg shrink-0", icon: "size-4" },
  sm: { button: "size-7 rounded-lg shrink-0", icon: "size-4" },
  xs: { button: "size-6 rounded-md shrink-0", icon: "size-3.5" }
};
