import { LumiAppAPI } from "~/lumi/interfaces/app/app";
import { LumiWindowsAPI } from "~/lumi/interfaces/app/windows";
import { LumiExtensionsAPI } from "~/lumi/interfaces/app/extensions";

import { LumiBrowserAPI } from "~/lumi/interfaces/browser/browser";
import { LumiTabsAPI } from "~/lumi/interfaces/browser/tabs";
import { LumiPinnedTabsAPI } from "~/lumi/interfaces/browser/pinned-tabs";
import { LumiPageAPI } from "~/lumi/interfaces/browser/page";
import { LumiNavigationAPI } from "~/lumi/interfaces/browser/navigation";
import { LumiInterfaceAPI } from "~/lumi/interfaces/browser/interface";
import { LumiOmniboxAPI } from "~/lumi/interfaces/browser/omnibox";
import { LumiNewTabAPI } from "~/lumi/interfaces/browser/newTab";
import { LumiFindInPageAPI } from "~/lumi/interfaces/browser/find-in-page";
import { LumiHistoryAPI } from "~/lumi/interfaces/browser/history";
import { LumiPasskeyAPI } from "~/lumi/interfaces/browser/passkey";
import { LumiPromptsAPI } from "~/lumi/interfaces/browser/prompts";
import { LumiContentBlockerAPI } from "~/lumi/interfaces/browser/content-blocker";
import { LumiFavouritesAPI } from "~/lumi/interfaces/browser/favourites";
import { LumiReaderAPI } from "~/lumi/interfaces/browser/reader";
import { LumiDownloadsAPI } from "~/lumi/interfaces/browser/downloads";
import { LumiSiteControlsAPI } from "~/lumi/interfaces/browser/site-controls";
import { LumiMediaAPI } from "~/lumi/interfaces/browser/media";
import { LumiSnapshotsAPI } from "~/lumi/interfaces/browser/snapshots";
import { LumiSidePanelAPI } from "~/lumi/interfaces/browser/side-panel";
import { LumiCaptureAPI } from "~/lumi/interfaces/browser/capture";

import { LumiProfilesAPI } from "~/lumi/interfaces/sessions/profiles";
import { LumiSpacesAPI } from "~/lumi/interfaces/sessions/spaces";

import { LumiSettingsAPI } from "~/lumi/interfaces/settings/settings";
import { LumiOpenExternalAPI } from "~/lumi/interfaces/settings/openExternal";
import { LumiOnboardingAPI } from "~/lumi/interfaces/settings/onboarding";
import { LumiSearchEnginesAPI } from "~/lumi/interfaces/settings/search-engines";
import { LumiImporterAPI } from "~/lumi/interfaces/settings/importer";
import { LumiMcpAPI } from "~/lumi/interfaces/settings/mcp";
import { LumiUpdatesAPI } from "~/lumi/interfaces/app/updates";
import { LumiActionsAPI } from "~/lumi/interfaces/app/actions";
import { LumiShortcutsAPI } from "~/lumi/interfaces/app/shortcuts";

export type LumiAPI = {
  // App APIs
  app: LumiAppAPI;
  windows: LumiWindowsAPI;
  extensions: LumiExtensionsAPI;
  updates: LumiUpdatesAPI;
  actions: LumiActionsAPI;
  shortcuts: LumiShortcutsAPI;

  // Browser APIs
  browser: LumiBrowserAPI;
  tabs: LumiTabsAPI;
  pinnedTabs: LumiPinnedTabsAPI;
  page: LumiPageAPI;
  navigation: LumiNavigationAPI;
  history: LumiHistoryAPI;
  interface: LumiInterfaceAPI;
  passkey: LumiPasskeyAPI;
  omnibox: LumiOmniboxAPI;
  newTab: LumiNewTabAPI;
  findInPage: LumiFindInPageAPI;
  prompts: LumiPromptsAPI;
  contentBlocker: LumiContentBlockerAPI;
  favourites: LumiFavouritesAPI;
  reader: LumiReaderAPI;
  downloads: LumiDownloadsAPI;
  siteControls: LumiSiteControlsAPI;
  media: LumiMediaAPI;
  snapshots: LumiSnapshotsAPI;
  sidePanel: LumiSidePanelAPI;
  capture: LumiCaptureAPI;

  // Session APIs
  profiles: LumiProfilesAPI;
  spaces: LumiSpacesAPI;

  // Settings APIs
  settings: LumiSettingsAPI;
  searchEngines: LumiSearchEnginesAPI;
  openExternal: LumiOpenExternalAPI;
  onboarding: LumiOnboardingAPI;
  importer: LumiImporterAPI;
  mcp: LumiMcpAPI;
};

declare global {
  /**
   * The Lumi API instance exposed by the Electron preload script.
   */
  const lumi: LumiAPI;
}
