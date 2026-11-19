export type DownloadState = "progressing" | "paused" | "completed" | "interrupted" | "cancelled";

export type DownloadItemData = {
  id: string;
  profileId: string;
  url: string;
  finalUrl: string;
  filename: string;
  savePath: string;
  mimeType: string | null;
  totalBytes: number;
  receivedBytes: number;
  speedBytesPerSec: number;
  state: DownloadState;
  canResume: boolean;
  isPaused: boolean;
  startTime: number;
  endTime: number | null;
  ephemeral?: boolean;
};

export type DownloadEvent = {
  type: "started" | "completed" | "failed";
  item: DownloadItemData;
};
