import { ipcMain } from "electron";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb } from "@/saving/db";
import { workspaceSnapshots, type WorkspaceSnapshotRow } from "@/saving/db/schema";
import { spacesController } from "@/controllers/spaces-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { tabsController } from "@/controllers/tabs-controller";
import { GlanceTabGroup } from "@/controllers/tabs-controller/tab-groups/glance";
import { SplitTabGroup } from "@/controllers/tabs-controller/tab-groups/split";
import type { Tab } from "@/controllers/tabs-controller/tab";
import type { SnapshotGroupEntry, SnapshotTabEntry, WorkspaceSnapshot } from "~/types/snapshots";

function toWorkspaceSnapshot(row: WorkspaceSnapshotRow): WorkspaceSnapshot {
  return {
    id: row.id,
    profileId: row.profileId,
    spaceId: row.spaceId,
    name: row.name,
    createdAt: row.createdAt,
    tabs: Array.isArray(row.tabsJson) ? row.tabsJson : [],
    tabGroups: Array.isArray(row.tabGroupsJson) ? row.tabGroupsJson : []
  };
}

ipcMain.handle("snapshots:list", async (_event, spaceId?: string): Promise<WorkspaceSnapshot[]> => {
  const db = getDb();
  const rows = spaceId
    ? await db
        .select()
        .from(workspaceSnapshots)
        .where(eq(workspaceSnapshots.spaceId, spaceId))
        .orderBy(desc(workspaceSnapshots.createdAt))
    : await db.select().from(workspaceSnapshots).orderBy(desc(workspaceSnapshots.createdAt));
  return rows.map(toWorkspaceSnapshot);
});

ipcMain.handle(
  "snapshots:save",
  async (_event, spaceId: string, rawName?: string): Promise<WorkspaceSnapshot | null> => {
    const space = await spacesController.get(spaceId);
    if (!space) return null;

    const tabs = [...tabsController.tabs.values()]
      .filter((t) => !t.isDestroyed && !t.ephemeral && t.spaceId === spaceId)
      .sort((a, b) => a.position - b.position);

    const tabEntries: SnapshotTabEntry[] = tabs.map((tab, index) => ({
      uniqueId: tab.uniqueId,
      title: tab.title || tab.url,
      url: tab.url,
      faviconUrl: tab.faviconURL,
      position: index
    }));

    const tabUniqueIds = new Set(tabEntries.map((t) => t.uniqueId));
    const groupEntries: SnapshotGroupEntry[] = [];

    for (const group of tabsController.tabGroups.values()) {
      if (group.spaceId !== spaceId) continue;
      const memberIds = group.tabs.filter((t) => !t.isDestroyed && tabUniqueIds.has(t.uniqueId)).map((t) => t.uniqueId);
      if (memberIds.length < 2) continue;

      if (group instanceof GlanceTabGroup) {
        groupEntries.push({
          mode: "glance",
          tabUniqueIds: memberIds,
          glanceFrontTabUniqueId: group.tabs.find((t) => t.id === group.frontTabId)?.uniqueId,
          position: group.position
        });
      } else if (group instanceof SplitTabGroup) {
        groupEntries.push({
          mode: "split",
          tabUniqueIds: memberIds,
          splitDirection: group.splitDirection,
          splitRatio: group.splitRatio,
          position: group.position
        });
      }
    }

    const now = Date.now();
    const cleanName =
      typeof rawName === "string" && rawName.trim().length > 0
        ? rawName.trim()
        : `${space.name} • ${new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    const id = randomUUID();
    const db = getDb();
    await db.insert(workspaceSnapshots).values({
      id,
      profileId: space.profileId,
      spaceId,
      name: cleanName,
      createdAt: now,
      tabsJson: tabEntries,
      tabGroupsJson: groupEntries
    });

    return {
      id,
      profileId: space.profileId,
      spaceId,
      name: cleanName,
      createdAt: now,
      tabs: tabEntries,
      tabGroups: groupEntries
    };
  }
);

ipcMain.handle("snapshots:restore", async (event, snapshotId: string, replaceExisting = false): Promise<boolean> => {
  const db = getDb();
  const rows = await db.select().from(workspaceSnapshots).where(eq(workspaceSnapshots.id, snapshotId)).limit(1);
  const row = rows[0];
  if (!row) return false;

  const snapshot = toWorkspaceSnapshot(row);
  if (snapshot.tabs.length === 0) return false;

  const targetWindow =
    browserWindowsController.getWindowFromWebContents(event.sender) ??
    browserWindowsController.getFocusedWindow() ??
    browserWindowsController.getWindows()[0];
  if (!targetWindow) return false;

  const space = await spacesController.get(snapshot.spaceId);
  if (!space) return false;

  const previousTabs = replaceExisting
    ? [...tabsController.tabs.values()].filter((t) => !t.isDestroyed && !t.ephemeral && t.spaceId === snapshot.spaceId)
    : [];

  const createdBySnapshotUniqueId = new Map<string, Tab>();
  let firstCreatedTab: Tab | null = null;

  for (const entry of snapshot.tabs) {
    try {
      const created = await tabsController.createTab(targetWindow.id, space.profileId, snapshot.spaceId, undefined, {
        url: entry.url,
        title: entry.title,
        faviconURL: entry.faviconUrl ?? undefined,
        position: entry.position
      });
      createdBySnapshotUniqueId.set(entry.uniqueId, created);
      if (!firstCreatedTab) {
        firstCreatedTab = created;
      }
    } catch (error) {
      console.error("Failed to recreate snapshot tab:", error);
    }
  }

  for (const group of snapshot.tabGroups) {
    const memberTabIds = group.tabUniqueIds
      .map((uid) => createdBySnapshotUniqueId.get(uid)?.id)
      .filter((id): id is number => typeof id === "number");
    if (memberTabIds.length < 2) continue;

    try {
      const recreatedGroup = tabsController.createTabGroup(group.mode, memberTabIds as [number, ...number[]]);
      if (group.mode === "glance" && group.glanceFrontTabUniqueId && recreatedGroup instanceof GlanceTabGroup) {
        const front = createdBySnapshotUniqueId.get(group.glanceFrontTabUniqueId);
        if (front) recreatedGroup.setFrontTab(front.id);
      }
      if (group.mode === "split" && recreatedGroup instanceof SplitTabGroup) {
        if (group.splitDirection) recreatedGroup.setSplitDirection(group.splitDirection);
        if (typeof group.splitRatio === "number") recreatedGroup.setSplitRatio(group.splitRatio);
      }
    } catch (error) {
      console.error("Failed to recreate snapshot tab group:", error);
    }
  }

  if (firstCreatedTab) {
    tabsController.activateTab(firstCreatedTab);
  }

  if (replaceExisting && firstCreatedTab) {
    for (const oldTab of previousTabs) {
      if (!oldTab.isDestroyed) {
        oldTab.destroy();
      }
    }
  }

  return createdBySnapshotUniqueId.size > 0;
});

ipcMain.handle("snapshots:remove", async (_event, snapshotId: string): Promise<boolean> => {
  const db = getDb();
  await db.delete(workspaceSnapshots).where(eq(workspaceSnapshots.id, snapshotId));
  return true;
});
