import type { MouseEvent } from "react";

/**
 * Shared hit-testing guards for top-level browser chrome bars (Sidebar and Horizontal Topbar).
 */

export function shouldIgnoreWindowDragTarget(target: HTMLElement): boolean {
  return Boolean(
    target.closest("button") ||
    target.closest("input") ||
    target.closest("textarea") ||
    target.closest("select") ||
    target.closest("label") ||
    target.closest("a") ||
    target.closest("[data-tab-id]") ||
    target.closest("[data-pinned-tab-id]") ||
    target.closest(".tab-group") ||
    target.closest("[role='button']") ||
    target.closest("[role='menuitem']") ||
    target.closest("[data-no-drag]") ||
    target.closest("[data-slot='sidebar-scroll-area-scrollbar']")
  );
}

/**
 * Returns true when a contextmenu event belongs to empty chrome space in the
 * sidebar/topbar rather than an inner interactive control or cross-document portal.
 */
export function shouldHandleBarContextMenu(target: EventTarget | null, currentTarget: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;
  if (target.ownerDocument !== currentTarget.ownerDocument || !currentTarget.contains(target)) {
    return false;
  }

  return !target.closest(
    [
      "input",
      "textarea",
      "select",
      "[contenteditable='true']",
      "[data-slot='popover-content']",
      "[data-slot='tooltip-content']",
      "[role='dialog']",
      "[role='menu']",
      "[role='listbox']",
      "[data-tab-id]",
      "[data-pinned-tab-id]",
      "[data-no-bar-context-menu]"
    ].join(", ")
  );
}

/**
 * Shared `onContextMenu` handler for Sidebar and Horizontal Topbar empty chrome space.
 */
export function handleChromeBarContextMenu(e: MouseEvent<HTMLElement>): void {
  if (!shouldHandleBarContextMenu(e.target, e.currentTarget)) return;
  e.preventDefault();
  lumi.interface.showNavigationLayoutContextMenu();
}
