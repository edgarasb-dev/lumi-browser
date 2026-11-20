import type { TabBlockerStats } from "~/lumi/interfaces/browser/content-blocker";

export type SitePermissionKey = "media" | "geolocation" | "notifications" | "clipboard-read" | "midi";
export type SitePermissionDecision = "ask" | "allow" | "block";

export interface SiteOriginSettings {
  zoomFactor: number;
  smartDarkMode: boolean;
  permissions: Partial<Record<SitePermissionKey, SitePermissionDecision>>;
}

export interface TabSiteControlsState {
  origin: string | null;
  hostname: string;
  protocol: string;
  settings: SiteOriginSettings;
  blockerStats: TabBlockerStats | null;
}

export interface ProfileSitePermissionEntry {
  origin: string;
  settings: SiteOriginSettings;
}
