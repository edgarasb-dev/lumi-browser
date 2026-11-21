import type { IPCListener } from "~/lumi/types";
import type { MediaControlAction, MediaTabInfo } from "~/types/media";

export interface LumiMediaAPI {
  getActiveTabs: () => Promise<MediaTabInfo[]>;
  control: (tabId: number, action: MediaControlAction) => Promise<boolean>;
  onChanged: IPCListener<[void]>;
}
