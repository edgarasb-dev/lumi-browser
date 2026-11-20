import { getDatastore } from "@/saving/datastore";
import type {
  ProfileSitePermissionEntry,
  SiteOriginSettings,
  SitePermissionDecision,
  SitePermissionKey
} from "~/types/site-controls";

type ProfileSiteMap = Record<string, Partial<SiteOriginSettings>>;

const siteSettingsStore = getDatastore("site-settings");
const profileCache = new Map<string, ProfileSiteMap>();

export const DEFAULT_SITE_SETTINGS: SiteOriginSettings = {
  zoomFactor: 1,
  smartDarkMode: false,
  permissions: {}
};

export function extractOriginFromUrl(rawUrl: string): { origin: string; hostname: string; protocol: string } | null {
  if (!rawUrl) return null;
  const parsed = URL.parse(rawUrl);
  if (!parsed) return null;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return {
    origin: parsed.origin,
    hostname: parsed.hostname,
    protocol: parsed.protocol
  };
}

function normalizeZoom(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.round(Math.min(2.5, Math.max(0.5, value)) * 100) / 100;
}

function hydrateSettings(raw?: Partial<SiteOriginSettings>): SiteOriginSettings {
  return {
    zoomFactor: normalizeZoom(raw?.zoomFactor),
    smartDarkMode: Boolean(raw?.smartDarkMode),
    permissions: { ...(raw?.permissions ?? {}) }
  };
}

function hasNonDefaultValues(settings: SiteOriginSettings): boolean {
  const hasPerms = Object.values(settings.permissions).some((v) => v && v !== "ask");
  return Math.abs(settings.zoomFactor - 1) > 0.001 || settings.smartDarkMode || hasPerms;
}

async function loadProfileMap(profileId: string): Promise<ProfileSiteMap> {
  const cached = profileCache.get(profileId);
  if (cached) return cached;

  const stored = await siteSettingsStore.get<ProfileSiteMap>(`profile:${profileId}`).catch(() => undefined);
  const map: ProfileSiteMap = stored && typeof stored === "object" ? { ...stored } : {};
  profileCache.set(profileId, map);
  return map;
}

async function saveProfileMap(profileId: string, map: ProfileSiteMap): Promise<void> {
  profileCache.set(profileId, map);
  await siteSettingsStore.set(`profile:${profileId}`, map).catch(() => {});
}

export async function getSiteSettings(profileId: string, origin: string): Promise<SiteOriginSettings> {
  const map = await loadProfileMap(profileId);
  return hydrateSettings(map[origin]);
}

export async function updateSiteSettings(
  profileId: string,
  origin: string,
  updater: (current: SiteOriginSettings) => SiteOriginSettings
): Promise<SiteOriginSettings> {
  const map = await loadProfileMap(profileId);
  const next = hydrateSettings(updater(hydrateSettings(map[origin])));
  if (hasNonDefaultValues(next)) {
    map[origin] = next;
  } else {
    delete map[origin];
  }
  await saveProfileMap(profileId, map);
  return next;
}

export async function setSiteZoom(profileId: string, origin: string, zoomFactor: number): Promise<SiteOriginSettings> {
  return updateSiteSettings(profileId, origin, (curr) => ({
    ...curr,
    zoomFactor: normalizeZoom(zoomFactor)
  }));
}

export async function setSiteSmartDarkMode(
  profileId: string,
  origin: string,
  enabled: boolean
): Promise<SiteOriginSettings> {
  return updateSiteSettings(profileId, origin, (curr) => ({
    ...curr,
    smartDarkMode: enabled
  }));
}

export async function getSitePermissionDecision(
  profileId: string,
  origin: string,
  permission: SitePermissionKey
): Promise<SitePermissionDecision> {
  const settings = await getSiteSettings(profileId, origin);
  return settings.permissions[permission] ?? "ask";
}

export async function setSitePermissionDecision(
  profileId: string,
  origin: string,
  permission: SitePermissionKey,
  decision: SitePermissionDecision
): Promise<SiteOriginSettings> {
  return updateSiteSettings(profileId, origin, (curr) => {
    const permissions = { ...curr.permissions };
    if (decision === "ask") {
      delete permissions[permission];
    } else {
      permissions[permission] = decision;
    }
    return { ...curr, permissions };
  });
}

export async function listProfileSiteSettings(profileId: string): Promise<ProfileSitePermissionEntry[]> {
  const map = await loadProfileMap(profileId);
  return Object.entries(map).map(([origin, raw]) => ({
    origin,
    settings: hydrateSettings(raw)
  }));
}

export async function resetProfileOriginSettings(profileId: string, origin: string): Promise<boolean> {
  const map = await loadProfileMap(profileId);
  if (!(origin in map)) return false;
  delete map[origin];
  await saveProfileMap(profileId, map);
  return true;
}
