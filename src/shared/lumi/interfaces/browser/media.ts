import type { MediaControlAction, MediaTabInfo } from "~/types/media";

export interface LumiMediaAPI {
  getActiveTabs: () => Promise<MediaTabInfo[]>;
  control: (tabId: number, action: MediaControlAction) => Promise<boolean>;
}
