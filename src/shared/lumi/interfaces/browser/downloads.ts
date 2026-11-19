import type { DownloadEvent, DownloadItemData } from "~/types/downloads";

export type LumiDownloadsAPI = {
  list: (profileId?: string) => Promise<DownloadItemData[]>;
  pause: (id: string) => Promise<boolean>;
  resume: (id: string) => Promise<boolean>;
  cancel: (id: string) => Promise<boolean>;
  retry: (id: string) => Promise<boolean>;
  openFile: (id: string) => Promise<boolean>;
  showInFinder: (id: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  clearCompleted: (profileId?: string) => Promise<number>;
  openDownloadsFolder: () => Promise<boolean>;
  onChanged: (callback: (downloads: DownloadItemData[]) => void) => () => void;
  onEvent: (callback: (event: DownloadEvent) => void) => () => void;
};
