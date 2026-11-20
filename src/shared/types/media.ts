export type MediaControlAction = "toggle-play" | "mute" | "unmute" | "seek-back" | "seek-forward" | "toggle-pip";

export interface MediaTabInfo {
  tabId: number;
  spaceId: string;
  profileId: string;
  title: string;
  url: string;
  faviconURL: string | null;
  audible: boolean;
  muted: boolean;
  isPictureInPicture: boolean;
  mediaTitle?: string;
  mediaArtist?: string;
  artworkUrl?: string;
  paused: boolean;
  hasVideo: boolean;
  currentTime: number;
  duration: number;
}
