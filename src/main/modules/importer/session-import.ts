import { BrowserWindow } from "electron";
import fs from "fs/promises";
import path from "path";
import { profilesController } from "@/controllers/profiles-controller";
import { sessionsController } from "@/controllers/sessions-controller";
import type { ImportedCookieItem, ImportedIndexedDbDir, ImportedLocalStorageOrigin } from "./types";
import type { SessionImportBreakdown } from "~/types/importer";

function mapSameSite(raw: number): "unspecified" | "no_restriction" | "lax" | "strict" {
  switch (raw) {
    case 0:
      return "no_restriction";
    case 1:
      return "lax";
    case 2:
      return "strict";
    default:
      return "unspecified";
  }
}

function buildCookieDetails(item: ImportedCookieItem): Electron.CookiesSetDetails | null {
  const host = item.hostKey.trim();
  if (!host || !item.name) return null;

  const isHostOnly = !host.startsWith(".");
  const cleanHost = host.replace(/^\.+/, "");
  if (!cleanHost) return null;

  const scheme = item.secure ? "https" : "http";
  const cookiePath = item.path && item.path.startsWith("/") ? item.path : "/";
  const url = `${scheme}://${cleanHost}${cookiePath}`;

  // __Host- cookies require Secure, Path=/, and no Domain attribute
  const effectiveSecure = item.name.startsWith("__Host-") || item.name.startsWith("__Secure-") ? true : item.secure;
  const effectivePath = item.name.startsWith("__Host-") ? "/" : cookiePath;
  const omitDomain = isHostOnly || item.name.startsWith("__Host-");

  const details: Electron.CookiesSetDetails = {
    url: `${effectiveSecure ? "https" : scheme}://${cleanHost}${effectivePath}`,
    name: item.name,
    value: item.value,
    path: effectivePath,
    secure: effectiveSecure,
    httpOnly: item.httpOnly,
    sameSite: mapSameSite(item.sameSite)
  };

  if (!omitDomain) {
    details.domain = host;
  }
  if (item.expirationDate !== undefined && Number.isFinite(item.expirationDate) && item.expirationDate > 0) {
    details.expirationDate = item.expirationDate;
  }

  // Electron URL sanity check
  try {
    new URL(url);
  } catch {
    return null;
  }

  return details;
}

async function injectLocalStorageViaHiddenWorkers(
  targetSession: Electron.Session,
  origins: ImportedLocalStorageOrigin[]
): Promise<number> {
  const valid = origins.filter((o) => o.entries.length > 0 && /^https?:\/\//i.test(o.origin));
  if (valid.length === 0) return 0;

  let nextIdx = 0;
  let injectedCount = 0;
  const workerCount = Math.min(4, valid.length);

  const runWorker = async () => {
    const win = new BrowserWindow({
      show: false,
      focusable: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        session: targetSession
      }
    });
    const wc = win.webContents;
    const dbg = wc.debugger;
    const originMap = new Map<string, Array<[string, string]>>();

    try {
      dbg.attach("1.3");
      await dbg.sendCommand("Fetch.enable", { patterns: [{ resourceType: "Document" }] });

      dbg.on("message", (_event, method, params) => {
        if (method !== "Fetch.requestPaused") return;
        let payloadHtml = "<!doctype html><html><body></body></html>";
        try {
          const reqUrl = new URL(params.request.url);
          const entries = originMap.get(reqUrl.origin);
          if (entries) {
            const safeJson = JSON.stringify(entries).replace(/<\/script/gi, "<\\/script");
            payloadHtml = `<!doctype html><html><script>
              try {
                const entries = ${safeJson};
                for (const [k, v] of entries) {
                  if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
                }
              } catch {}
            </script></html>`;
          }
        } catch {
          // ignore
        }

        void dbg
          .sendCommand("Fetch.fulfillRequest", {
            requestId: params.requestId,
            responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "text/html; charset=utf-8" }],
            body: Buffer.from(payloadHtml, "utf8").toString("base64")
          })
          .catch(() => {});
      });

      while (nextIdx < valid.length) {
        const item = valid[nextIdx++]!;
        originMap.set(item.origin, item.entries);
        try {
          await wc.loadURL(`${item.origin}/__lumi_storage_import`);
          injectedCount++;
        } catch {
          // Skip individual origin failures silently so other sites continue
        } finally {
          originMap.delete(item.origin);
        }
      }
    } finally {
      try {
        if (dbg.isAttached()) dbg.detach();
      } catch {
        // ignore
      }
      if (!win.isDestroyed()) win.destroy();
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return injectedCount;
}

async function copyMissingIndexedDbDirs(targetProfileId: string, dirs: ImportedIndexedDbDir[]): Promise<number> {
  if (dirs.length === 0) return 0;
  const targetIdbRoot = path.join(profilesController.getProfilePath(targetProfileId), "IndexedDB");
  await fs.mkdir(targetIdbRoot, { recursive: true });

  let copied = 0;
  for (const item of dirs) {
    const destPath = path.join(targetIdbRoot, item.dirName);
    try {
      await fs.access(destPath);
      // Do not overwrite an origin's IndexedDB that the user already created in Lumi
      continue;
    } catch {
      // Destination does not exist yet — safe to copy
    }

    try {
      await fs.cp(item.sourcePath, destPath, {
        recursive: true,
        filter: (src) => path.basename(src) !== "LOCK"
      });
      await fs.rm(path.join(destPath, "LOCK"), { force: true }).catch(() => {});

      if (item.blobDirName && item.blobSourcePath) {
        const blobDest = path.join(targetIdbRoot, item.blobDirName);
        await fs.cp(item.blobSourcePath, blobDest, { recursive: true }).catch(() => {});
      }
      copied++;
    } catch {
      await fs.rm(destPath, { recursive: true, force: true }).catch(() => {});
    }
  }

  return copied;
}

export async function importSessionDataIntoProfile(
  profileId: string,
  cookies: ImportedCookieItem[],
  localStorageOrigins: ImportedLocalStorageOrigin[],
  indexedDbDirs: ImportedIndexedDbDir[]
): Promise<SessionImportBreakdown> {
  const targetSession = sessionsController.get(profileId);

  let cookiesImported = 0;
  const BATCH_SIZE = 50;
  for (let i = 0; i < cookies.length; i += BATCH_SIZE) {
    const chunk = cookies.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      chunk.map(async (item) => {
        const details = buildCookieDetails(item);
        if (!details) return false;
        await targetSession.cookies.set(details);
        return true;
      })
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) cookiesImported++;
    }
  }

  const localStorageImported = await injectLocalStorageViaHiddenWorkers(targetSession, localStorageOrigins);
  const indexedDbImported = await copyMissingIndexedDbDirs(profileId, indexedDbDirs);

  await Promise.all([targetSession.cookies.flushStore().catch(() => {}), targetSession.flushStorageData()]).catch(
    () => {}
  );

  return {
    cookies: cookiesImported,
    localStorageOrigins: localStorageImported,
    indexedDbOrigins: indexedDbImported
  };
}
