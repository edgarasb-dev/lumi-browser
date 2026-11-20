import { debugPrint } from "@/modules/output";
import { setAlwaysOpenExternal, shouldAlwaysOpenExternal } from "@/saving/open-external";
import { extractOriginFromUrl, getSitePermissionDecision, setSitePermissionDecision } from "@/saving/site-settings";
import { app, dialog, OpenExternalPermissionRequest, type Session } from "electron";
import type { SitePermissionKey } from "~/types/site-controls";

const PERMISSION_MAP: Record<string, SitePermissionKey> = {
  media: "media",
  mediaKeySystem: "media",
  audioCapture: "media",
  videoCapture: "media",
  geolocation: "geolocation",
  notifications: "notifications",
  "clipboard-read": "clipboard-read",
  midi: "midi",
  midiSysex: "midi"
};

const PERMISSION_LABELS: Record<SitePermissionKey, string> = {
  media: "camera and microphone",
  geolocation: "your location",
  notifications: "desktop notifications",
  "clipboard-read": "clipboard contents",
  midi: "MIDI devices"
};

const AUTO_ALLOWED_PERMISSIONS = new Set([
  "fullscreen",
  "pointerLock",
  "clipboard-sanitized-write",
  "window-management"
]);
const inflightPermissionPrompts = new Map<string, Promise<boolean>>();

export function registerHandlersWithSession(session: Session, profileId: string) {
  session.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
    debugPrint("PERMISSIONS", "permission request", webContents?.getURL() || "unknown-url", permission);

    if (permission === "openExternal") {
      const openExternalDetails = details as OpenExternalPermissionRequest;
      const requestingURL = openExternalDetails.requestingUrl;
      const externalURL = openExternalDetails.externalURL;

      if (externalURL) {
        const shouldAlwaysOpen = await shouldAlwaysOpenExternal(requestingURL, externalURL);
        if (shouldAlwaysOpen) {
          callback(true);
          return;
        }
      }

      const externalAppName = app.getApplicationNameForProtocol(externalURL ?? "") || "an unknown application";
      const parsed = URL.parse(requestingURL);
      const minifiedUrl = parsed ? `${parsed.protocol}//${parsed.host}` : requestingURL;

      dialog
        .showMessageBox({
          message: `"${minifiedUrl}" wants to open "${externalAppName}".`,
          buttons: ["Cancel", "Open", "Always Open"]
        })
        .then((response) => {
          switch (response.response) {
            case 2:
              if (externalURL) {
                setAlwaysOpenExternal(requestingURL, externalURL);
              }
            /* falls through */
            case 1:
              callback(true);
              break;
            case 0:
              callback(false);
              break;
          }
        });

      return;
    }

    if (AUTO_ALLOWED_PERMISSIONS.has(permission)) {
      callback(true);
      return;
    }

    const mappedKey = PERMISSION_MAP[permission];
    const requestUrl = details?.requestingUrl || webContents?.getURL() || "";
    const originInfo = extractOriginFromUrl(requestUrl);

    if (!mappedKey || !originInfo) {
      callback(true);
      return;
    }

    const savedDecision = await getSitePermissionDecision(profileId, originInfo.origin, mappedKey);
    if (savedDecision === "allow") {
      callback(true);
      return;
    }
    if (savedDecision === "block") {
      callback(false);
      return;
    }

    const promptKey = `${profileId}:${originInfo.origin}:${mappedKey}`;
    const existingPrompt = inflightPermissionPrompts.get(promptKey);
    if (existingPrompt) {
      callback(await existingPrompt);
      return;
    }

    const promptPromise = dialog
      .showMessageBox({
        type: "question",
        message: `"${originInfo.hostname}" is requesting access to ${PERMISSION_LABELS[mappedKey]}.`,
        detail: "You can change or reset site permissions anytime from the Address Bar Site Control Center.",
        buttons: ["Block", "Allow Once", "Always Allow"],
        defaultId: 2,
        cancelId: 0
      })
      .then(async ({ response }) => {
        if (response === 2) {
          await setSitePermissionDecision(profileId, originInfo.origin, mappedKey, "allow");
          return true;
        }
        if (response === 1) {
          return true;
        }
        await setSitePermissionDecision(profileId, originInfo.origin, mappedKey, "block");
        return false;
      })
      .finally(() => {
        inflightPermissionPrompts.delete(promptKey);
      });

    inflightPermissionPrompts.set(promptKey, promptPromise);
    callback(await promptPromise);
  });
}
