import { profilesController } from "@/controllers/profiles-controller";
import { spacesController } from "@/controllers/spaces-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { getAllFavourites } from "@/saving/favourites";
import { listBrowsingHistoryForProfile } from "@/saving/history/browsing-history";
import { loadSafariSyncData } from "@/saving/safari-sync";
import { isHttpOrHttpsUrl } from "@/modules/safari-sync/safari-bridge";
import type {
  SyncSnapshotPayload,
  SyncedFavouriteItem,
  SyncedHistoryItem,
  SyncedOpenTabItem
} from "~/types/safari-sync";

export async function buildSyncSnapshot(): Promise<SyncSnapshotPayload> {
  const syncData = await loadSafariSyncData();
  const [profiles, allSpaces, allFavourites] = await Promise.all([
    profilesController.getAll(),
    spacesController.getAll(),
    getAllFavourites()
  ]);

  const validProfileIds = new Set(profiles.filter((p) => !p.internal && !p.ephemeral).map((p) => p.id));
  const validSpaces = allSpaces.filter((space) => validProfileIds.has(space.profileId));
  const spaceNameMap = new Map(validSpaces.map((s) => [s.id, s.name]));

  const openTabs: SyncedOpenTabItem[] = [];
  for (const tab of tabsController.tabs.values()) {
    if (tab.isDestroyed || tab.ephemeral) continue;
    if (!validProfileIds.has(tab.profileId)) continue;
    if (tab.getWindow().browserWindowType === "popup") continue;

    const managers = tabsController.getTabManagers(tab.id);
    const effectiveUrl = managers?.lifecycle.preSleepState?.url || tab.url;
    if (!isHttpOrHttpsUrl(effectiveUrl)) continue;

    openTabs.push({
      uniqueId: tab.uniqueId,
      spaceId: tab.spaceId,
      spaceName: spaceNameMap.get(tab.spaceId) || "Space",
      title: tab.title || effectiveUrl,
      url: effectiveUrl,
      lastActiveAt: tab.lastActiveAt
    });
  }

  const favourites: SyncedFavouriteItem[] = allFavourites
    .filter((f) => isHttpOrHttpsUrl(f.url))
    .map((f) => ({
      id: f.id,
      title: f.title,
      url: f.url,
      createdAt: f.createdAt
    }));

  const historyMap = new Map<string, SyncedHistoryItem>();
  for (const profileId of validProfileIds) {
    const entries = listBrowsingHistoryForProfile(profileId);
    for (const entry of entries) {
      if (!isHttpOrHttpsUrl(entry.url)) continue;
      const existing = historyMap.get(entry.url);
      if (!existing || entry.lastVisitTime > existing.lastVisitTime) {
        historyMap.set(entry.url, {
          url: entry.url,
          title: entry.title,
          visitCount: entry.visitCount,
          lastVisitTime: entry.lastVisitTime
        });
      }
    }
  }

  const recentHistory = [...historyMap.values()].sort((a, b) => b.lastVisitTime - a.lastVisitTime).slice(0, 200);

  return {
    version: 1,
    deviceId: syncData.deviceId,
    deviceName: syncData.deviceName,
    platform: process.platform,
    exportedAt: Date.now(),
    spaces: validSpaces.map((s) => ({
      id: s.id,
      profileId: s.profileId,
      name: s.name
    })),
    openTabs,
    favourites,
    recentHistory
  };
}
