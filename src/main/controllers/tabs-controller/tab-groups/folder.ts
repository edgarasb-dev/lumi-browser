import type { FolderColorId } from "~/types/tabs";
import { BaseTabGroup } from "./index";

export class FolderTabGroup extends BaseTabGroup {
  public readonly mode = "folder" as const;
  public name: string = "Folder";
  public color: FolderColorId = "neutral";
  public collapsed: boolean = false;
  public lastFocusedTabId: number = -1;

  constructor(...args: ConstructorParameters<typeof BaseTabGroup>) {
    super(...args);
    this.lastFocusedTabId = this.tabIds[0] ?? -1;

    this.on("tab-removed", (removedId) => {
      if (this.tabIds.length === 0) {
        this.destroy();
        return;
      }
      if (this.lastFocusedTabId === removedId) {
        this.lastFocusedTabId = this.tabIds[0] ?? -1;
      }
    });
  }

  public rename(name: string): boolean {
    const cleaned = name.trim().slice(0, 80) || "Folder";
    if (this.name === cleaned) return false;
    this.name = cleaned;
    this.emit("changed");
    return true;
  }

  public setColor(color: FolderColorId): boolean {
    if (this.color === color) return false;
    this.color = color;
    this.emit("changed");
    return true;
  }

  public setCollapsed(collapsed: boolean): boolean {
    if (this.collapsed === collapsed) return false;
    this.collapsed = collapsed;
    this.emit("changed");
    return true;
  }

  public setLastFocusedTab(tabId: number): void {
    if (!this.hasTab(tabId) || this.lastFocusedTabId === tabId) return;
    this.lastFocusedTabId = tabId;
  }

  /**
   * Reorders member tabs inside the folder according to their current tab positions
   * so sidebar child rendering matches visual drag/drop ordering.
   */
  public syncTabOrderFromPositions(): void {
    this.errorIfDestroyed();
    const sorted = [...this.tabs].sort((a, b) => a.position - b.position).map((t) => t.id);
    if (sorted.length !== this.tabIds.length || sorted.some((id, idx) => this.tabIds[idx] !== id)) {
      this.tabIds = sorted;
      this.emit("changed");
    }
  }
}
