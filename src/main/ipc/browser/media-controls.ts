import { ipcMain } from "electron";
import { tabsController } from "@/controllers/tabs-controller";
import type { Tab, TabPublicProperty } from "@/controllers/tabs-controller/tab";
import { windowsController } from "@/controllers/windows-controller";
import { quitController } from "@/controllers/quit-controller";
import type { MediaControlAction, MediaTabInfo } from "~/types/media";

const MEDIA_PUSH_DEBOUNCE_MS = 80;
const MEDIA_RELEVANT_KEYS = new Set<TabPublicProperty>([
  "audible",
  "muted",
  "isPictureInPicture",
  "title",
  "url",
  "faviconURL",
  "asleep"
]);

const pendingMediaNotifyTimers = new Map<number, NodeJS.Timeout>();

function scheduleMediaChangedForWindowId(windowId: number) {
  const existing = pendingMediaNotifyTimers.get(windowId);
  if (existing) return;

  const timer = setTimeout(() => {
    pendingMediaNotifyTimers.delete(windowId);
    if (quitController.isQuitting) return;
    const win = windowsController.browser.getById(windowId);
    if (!win || win.destroyed || win.browserWindow.isDestroyed()) return;
    win.sendMessageToCoreWebContents("media:on-changed");
  }, MEDIA_PUSH_DEBOUNCE_MS);

  pendingMediaNotifyTimers.set(windowId, timer);
}

function attachMediaListenersToTab(tab: Tab) {
  tab.on("media-changed", () => {
    if (quitController.isQuitting) return;
    scheduleMediaChangedForWindowId(tab.getWindow().id);
  });

  tab.on("updated", (keys) => {
    if (quitController.isQuitting) return;
    if (keys.some((key) => MEDIA_RELEVANT_KEYS.has(key))) {
      scheduleMediaChangedForWindowId(tab.getWindow().id);
    }
  });

  tab.on("window-changed", (oldWindowId) => {
    if (quitController.isQuitting) return;
    scheduleMediaChangedForWindowId(tab.getWindow().id);
    if (oldWindowId !== tab.getWindow().id) {
      scheduleMediaChangedForWindowId(oldWindowId);
    }
  });

  tab.on("destroyed", () => {
    if (quitController.isQuitting) return;
    if (tab.audible || tab.muted || tab.isPictureInPicture || tab.hasMediaPlayback) {
      scheduleMediaChangedForWindowId(tab.getWindow().id);
    }
  });
}

for (const existingTab of tabsController.tabs.values()) {
  attachMediaListenersToTab(existingTab);
}
tabsController.on("tab-created", attachMediaListenersToTab);

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
  let art;
  if (meta?.artwork?.length) {
    for (let i = meta.artwork.length - 1; i >= 0; i--) {
      const raw = meta.artwork[i]?.src;
      if (!raw) continue;
      try {
        const resolved = new URL(raw, window.location.href);
        if (resolved.protocol === "https:" || resolved.protocol === "http:" || resolved.protocol === "data:") {
          art = resolved.toString();
          break;
        }
      } catch {
        // Ignore malformed artwork URLs
      }
    }
  }
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
    tab.updateTabState();
    scheduleMediaChangedForWindowId(tab.getWindow().id);
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
      scheduleMediaChangedForWindowId(tab.getWindow().id);
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
      scheduleMediaChangedForWindowId(tab.getWindow().id);
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
      scheduleMediaChangedForWindowId(tab.getWindow().id);
      return Boolean(toggled);
    }
  } catch {
    return false;
  }

  return false;
});
