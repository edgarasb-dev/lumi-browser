import type {
  ProfileSitePermissionEntry,
  SiteOriginSettings,
  SitePermissionDecision,
  SitePermissionKey,
  TabSiteControlsState
} from "~/types/site-controls";

export interface LumiSiteControlsAPI {
  getForTab: (tabId: number) => Promise<TabSiteControlsState | null>;
  setZoom: (tabId: number, zoomFactor: number) => Promise<number>;
  setSmartDarkMode: (tabId: number, enabled: boolean) => Promise<boolean>;
  setPermission: (
    tabId: number,
    permission: SitePermissionKey,
    decision: SitePermissionDecision
  ) => Promise<SiteOriginSettings | null>;
  clearSiteData: (tabId: number) => Promise<boolean>;
  listProfileSiteSettings: (profileId?: string) => Promise<ProfileSitePermissionEntry[]>;
  resetOriginSettings: (profileId: string, origin: string) => Promise<boolean>;
}
