import { contextBridge, ipcRenderer } from "electron";

/**
 * Bridges W3C App Badging (`navigator.setAppBadge` / `navigator.clearAppBadge`)
 * calls from web pages into per-tab badge state in the main process.
 */
export function tryPatchAppBadge(): boolean {
  if (!("navigator" in globalThis)) {
    return false;
  }

  const bridge = {
    setBadgeCount: (count: number | null) => {
      ipcRenderer.send("tabs:set-badge-count", count);
    }
  };

  contextBridge.exposeInMainWorld("electronAppBadge", bridge);

  const patchScript = () => {
    const win = globalThis as typeof globalThis & {
      electronAppBadge?: { setBadgeCount: (count: number | null) => void };
    };
    const appBadgeBridge = win.electronAppBadge;
    if (!appBadgeBridge) return;

    const proto = typeof Navigator !== "undefined" ? Navigator.prototype : null;
    if (proto) {
      if (typeof proto.setAppBadge === "function") {
        const origSetAppBadge = proto.setAppBadge;
        proto.setAppBadge = function setAppBadge(this: Navigator, contents?: number) {
          if (contents === undefined) {
            appBadgeBridge.setBadgeCount(1);
          } else {
            const numeric = Number(contents);
            if (Number.isFinite(numeric) && numeric >= 0) {
              const normalized = Math.floor(numeric);
              appBadgeBridge.setBadgeCount(normalized > 0 ? normalized : null);
            }
          }
          return origSetAppBadge.apply(this, contents === undefined ? [] : [contents]);
        };
      }

      if (typeof proto.clearAppBadge === "function") {
        const origClearAppBadge = proto.clearAppBadge;
        proto.clearAppBadge = function clearAppBadge(this: Navigator) {
          appBadgeBridge.setBadgeCount(null);
          return origClearAppBadge.apply(this);
        };
      }
    }

    delete win.electronAppBadge;
  };

  contextBridge.executeInMainWorld({ func: patchScript });
  return true;
}
