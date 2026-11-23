import type { FolderColorId, SplitDirection } from "./tabs";

export interface SnapshotTabEntry {
  uniqueId: string;
  title: string;
  url: string;
  faviconUrl: string | null;
  position: number;
}

export interface SnapshotGroupEntry {
  mode: "glance" | "split" | "folder";
  tabUniqueIds: string[];
  glanceFrontTabUniqueId?: string;
  splitDirection?: SplitDirection;
  splitRatio?: number;
  name?: string;
  color?: FolderColorId;
  collapsed?: boolean;
  position: number;
}

export interface WorkspaceSnapshot {
  id: string;
  profileId: string;
  spaceId: string;
  name: string;
  createdAt: number;
  tabs: SnapshotTabEntry[];
  tabGroups: SnapshotGroupEntry[];
}
