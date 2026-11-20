import { ipcMain } from "electron";
import { tabsController } from "@/controllers/tabs-controller";
import { windowsController } from "@/controllers/windows-controller";
import type { MediaControlAction, MediaTabInfo } from "~/types/media";

interface DomMediaProbe {
  mediaTitle?: string;
  mediaArtist?: string;
  artworkUrl?: string;
  paused: boolean;
  hasVideo: boolean;
  currentTime: number;
  duration: number;
}

const PROBE_MEDIA_SCRIPT = `(() => {
  const meta = navigator.mediaSession?.metadata;
  const video = document.querySelector("video");
  const audio = document.querySelector("audio");
  const el = video || audio;
  const art = meta?.artwork?.length ? meta.artwork[meta.artwork.length - 1]?.src : undefined;
  return {
    mediaTitle: meta?.title || undefined,
    mediaArtist: meta?.artist || undefined,
    artworkUrl: art,
    paused: el ? el.paused : true,
    hasVideo: Boolean(video && (video.readyState > 0 || video.videoWidth > 0 || video.currentSrc)),
    currentTime: el && Number.isFinite(el.currentTime) ? el.currentTime : 0,
    duration: el && Number.isFinite(el.duration) ? el.duration : 0
  };
})()`;

ipcMain.handle("media:get-active-tabs", async (event): Promise<MediaTabInfo[]> => {
  const win = windowsController.browser.getFromWebContents(event.sender) ?? windowsController.browser.getFocused();
  if (!win) return [];

  const windowTabs = tabsController
    .getTabsInWindow(win.id)
    .filter(
      (tab) =>
        !tab.isDestroyed &&
        !tab.asleep &&
        Boolean(tab.webContents && !tab.webContents.isDestroyed()) &&
        (tab.audible || tab.muted || tab.isPictureInPicture || tab.hasMediaPlayback)
    );

  const results = await Promise.all(
    windowTabs.map(async (tab): Promise<MediaTabInfo | null> => {
      const wc = tab.webContents;
      if (!wc || wc.isDestroyed()) return null;

      let probe: DomMediaProbe = {
        paused: !tab.audible,
        hasVideo: false,
        currentTime: 0,
        duration: 0
      };

      try {
        const res = (await wc.executeJavaScript(PROBE_MEDIA_SCRIPT, true)) as DomMediaProbe | null;
        if (res && typeof res === "object") {
          probe = res;
        }
      } catch {
        // Ignore cross-origin / torn-down frame errors safely
      }

      if (!tab.audible && !tab.isPictureInPicture && probe.paused && !tab.muted) {
        return null;
      }

      return {
        tabId: tab.id,
        spaceId: tab.spaceId,
        profileId: tab.profileId,
        title: tab.title,
        url: tab.url,
        faviconURL: tab.faviconURL,
        audible: tab.audible,
        muted: tab.muted,
        isPictureInPicture: tab.isPictureInPicture,
        mediaTitle: probe.mediaTitle,
        mediaArtist: probe.mediaArtist,
        artworkUrl: probe.artworkUrl,
        paused: probe.paused,
        hasVideo: probe.hasVideo,
        currentTime: probe.currentTime,
        duration: probe.duration
      };
    })
  );

  return results.filter((item): item is MediaTabInfo => item !== null);
});

ipcMain.handle("media:control", async (_event, tabId: number, action: MediaControlAction): Promise<boolean> => {
  const tab = tabsController.getTabById(tabId);
  if (!tab || tab.isDestroyed || !tab.webContents || tab.webContents.isDestroyed()) return false;

  const wc = tab.webContents;

  if (action === "mute" || action === "unmute") {
    wc.setAudioMuted(action === "mute");
    return true;
  }

  try {
    if (action === "toggle-play") {
      await wc.executeJavaScript(
        `(() => {
          const el = document.querySelector("video") || document.querySelector("audio");
          if (!el) return false;
          if (el.paused) { void el.play(); } else { el.pause(); }
          return true;
        })()`,
        true
      );
      return true;
    }

    if (action === "seek-back" || action === "seek-forward") {
      const delta = action === "seek-back" ? -10 : 10;
      await wc.executeJavaScript(
        `(() => {
          const el = document.querySelector("video") || document.querySelector("audio");
          if (!el) return false;
          el.currentTime = Math.max(0, el.currentTime + (${delta}));
          return true;
        })()`,
        true
      );
      return true;
    }

    if (action === "toggle-pip") {
      const toggled = await wc.executeJavaScript(
        `(() => {
          if (document.pictureInPictureElement) {
            void document.exitPictureInPicture();
            return true;
          }
          const video = document.querySelector("video");
          if (video && typeof video.requestPictureInPicture === "function") {
            void video.requestPictureInPicture();
            return true;
          }
          return false;
        })()`,
        true
      );
      return Boolean(toggled);
    }
  } catch {
    return false;
  }

  return false;
});
