import { SplitDirection } from "~/types/tabs";
import { BaseTabGroup } from "./index";

export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;
export const DEFAULT_SPLIT_RATIO = 0.5;

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return DEFAULT_SPLIT_RATIO;
  return Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, ratio));
}

export class SplitTabGroup extends BaseTabGroup {
  public mode: "split" = "split" as const;
  public splitDirection: SplitDirection = "horizontal";
  public splitRatio: number = DEFAULT_SPLIT_RATIO;
  public focusedTabId: number = -1;

  constructor(...args: ConstructorParameters<typeof BaseTabGroup>) {
    super(...args);
    this.focusedTabId = this.tabIds[0] ?? -1;

    this.on("tab-removed", (removedId) => {
      if (this.tabIds.length < 2) {
        // A split view group requires at least 2 tabs
        this.destroy();
        return;
      }
      if (this.focusedTabId === removedId) {
        this.focusedTabId = this.tabIds[0] ?? -1;
      }
    });
  }

  public setSplitRatio(ratio: number): void {
    const clamped = clampSplitRatio(ratio);
    if (Math.abs(clamped - this.splitRatio) < 0.001) return;
    this.splitRatio = clamped;
    this.emit("changed");
  }

  public setSplitDirection(direction: SplitDirection): void {
    if (this.splitDirection === direction) return;
    this.splitDirection = direction;
    this.emit("changed");
  }

  public setFocusedTab(tabId: number): void {
    if (!this.hasTab(tabId) || this.focusedTabId === tabId) return;
    this.focusedTabId = tabId;
    this.emit("changed");
  }

  public swapPanes(): boolean {
    if (this.tabIds.length < 2) return false;
    const [first, second, ...rest] = this.tabIds;
    const firstTab = this.tabsController.getTabById(first);
    const secondTab = this.tabsController.getTabById(second);
    this.tabIds = [second, first, ...rest];
    if (firstTab && secondTab) {
      const firstPos = firstTab.position;
      firstTab.updateStateProperty("position", secondTab.position);
      secondTab.updateStateProperty("position", firstPos);
    }
    this.emit("changed");
    return true;
  }
}
