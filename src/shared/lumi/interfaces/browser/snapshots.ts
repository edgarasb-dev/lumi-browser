import type { WorkspaceSnapshot } from "~/types/snapshots";

export interface LumiSnapshotsAPI {
  list: (spaceId?: string) => Promise<WorkspaceSnapshot[]>;
  save: (spaceId: string, name?: string) => Promise<WorkspaceSnapshot | null>;
  restore: (snapshotId: string, replaceExisting?: boolean) => Promise<boolean>;
  remove: (snapshotId: string) => Promise<boolean>;
}
