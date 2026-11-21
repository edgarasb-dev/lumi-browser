import type { Dirent } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import type { DetectedBrowser, ImportCategoryCounts } from "~/types/importer";
import type { BrowserDefinition, ExtractedBrowserData } from "./types";

export interface FsReadOptions {
  throwOnPermissionError?: boolean;
}

const CHROME_EPOCH_OFFSET_MS = 11_644_473_600_000;
const COCOA_EPOCH_OFFSET_SEC = 978_307_200;

/** Max history rows imported per source profile to keep SQLite transactions fast and memory bounded. */
export const HISTORY_IMPORT_LIMIT = 50_000;

export function emptyImportCounts(): ImportCategoryCounts {
  return {
    bookmarks: 0,
    history: 0,
    pinnedTabs: 0,
    searchEngines: 0,
    passwords: 0,
    sessions: 0
  };
}

export function createEmptyExtractedData(): ExtractedBrowserData {
  return {
    bookmarks: [],
    history: [],
    pinnedTabs: [],
    searchEngines: [],
    passwords: [],
    cookies: [],
    localStorage: [],
    indexedDbDirs: []
  };
}

export function isPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as NodeJS.ErrnoException & { stderr?: string };
  if (err.code === "EPERM" || err.code === "EACCES") return true;
  if (typeof err.message === "string" && /operation not permitted|permission denied/i.test(err.message)) {
    return true;
  }
  if (typeof err.stderr === "string" && /operation not permitted|permission denied/i.test(err.stderr)) {
    return true;
  }
  return false;
}

function rethrowPermissionErrorIfRequested(error: unknown, options?: FsReadOptions): void {
  if (options?.throwOnPermissionError && isPermissionError(error)) {
    throw error;
  }
}

export function createPermissionRequiredBrowser(def: BrowserDefinition): DetectedBrowser {
  return {
    id: def.id,
    name: def.name,
    family: def.family,
    profiles: [],
    permissionRequired: true
  };
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(targetPath: string, options?: FsReadOptions): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch (error) {
    rethrowPermissionErrorIfRequested(error, options);
    return false;
  }
}

/**
 * Verifies both existence as a regular file and actual read permission via `fs.open("r")`.
 * On macOS, `fs.stat()` alone succeeds inside TCC-protected folders (e.g. Safari/Chrome/Firefox)
 * even when reading the file contents is denied with `EPERM`.
 */
export async function isFileReadable(targetPath: string, options?: FsReadOptions): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isFile()) return false;
    const handle = await fs.open(targetPath, "r");
    await handle.close().catch(() => {});
    return true;
  } catch (error) {
    rethrowPermissionErrorIfRequested(error, options);
    return false;
  }
}

export async function readDirEntries(dirPath: string, options?: FsReadOptions): Promise<Dirent[]> {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    rethrowPermissionErrorIfRequested(error, options);
    return [];
  }
}

export async function readTextSafe(filePath: string, options?: FsReadOptions): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    rethrowPermissionErrorIfRequested(error, options);
    return null;
  }
}

export async function readJsonSafe<T = Record<string, unknown>>(
  filePath: string,
  options?: FsReadOptions
): Promise<T | null> {
  const raw = await readTextSafe(filePath, options);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function isImportableHttpUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeImportUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.replace(/\/$/, "").toLowerCase();
  }
}

export function chromeTimeToUnixMs(webkitMicroseconds: number | string | null | undefined): number {
  const num = typeof webkitMicroseconds === "string" ? Number(webkitMicroseconds) : webkitMicroseconds;
  if (!num || !Number.isFinite(num) || num <= 0) return Date.now();
  const ms = Math.floor(num / 1000 - CHROME_EPOCH_OFFSET_MS);
  return ms > 0 ? ms : Date.now();
}

export function prTimeToUnixMs(prMicroseconds: number | null | undefined): number {
  if (!prMicroseconds || !Number.isFinite(prMicroseconds) || prMicroseconds <= 0) return Date.now();
  const ms = Math.floor(prMicroseconds / 1000);
  return ms > 0 ? ms : Date.now();
}

export function cocoaTimeToUnixMs(cfSeconds: number | null | undefined): number {
  if (!cfSeconds || !Number.isFinite(cfSeconds)) return Date.now();
  const ms = Math.round((cfSeconds + COCOA_EPOCH_OFFSET_SEC) * 1000);
  return ms > 0 ? ms : Date.now();
}

/**
 * Copies a potentially locked SQLite database (plus sibling `-wal` / `-shm` files) to a
 * temporary directory so reads succeed cleanly even while the source browser is open.
 */
export async function withTempSqliteCopy<T>(dbPath: string, reader: (db: Database.Database) => T): Promise<T> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-import-"));
  const tmpDbPath = path.join(tmpDir, path.basename(dbPath));
  let db: Database.Database | null = null;

  try {
    await fs.copyFile(dbPath, tmpDbPath);
    for (const suffix of ["-wal", "-shm"]) {
      const sibling = `${dbPath}${suffix}`;
      if (await pathExists(sibling)) {
        await fs.copyFile(sibling, `${tmpDbPath}${suffix}`).catch(() => {});
      }
    }

    db = new Database(tmpDbPath, { readonly: true, fileMustExist: true });
    return reader(db);
  } finally {
    try {
      db?.close();
    } catch {
      // ignore close errors
    }
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Converts Chromium/Firefox search URL templates into Lumi's `%s` format.
 * Returns null if the template uses internal schemes or lacks a query placeholder.
 */
export function convertSearchUrlTemplate(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  let converted = rawUrl.trim();
  if (converted.startsWith("{google:baseURL}")) {
    converted = `https://www.google.com/${converted.slice("{google:baseURL}".length)}`;
  }

  if (!converted.startsWith("http://") && !converted.startsWith("https://")) {
    return null;
  }

  converted = converted.replace(/\{searchTerms\}/g, "%s").replace(/\{inputEncoding\}/g, "UTF-8");
  // Drop optional Chrome-internal template tokens like &{google:RLZ}{google:...}
  converted = converted.replace(/\{google:[^}]+\}/g, "");
  converted = converted.replace(/[?&]+(?=&|$)/g, "").replace(/\?&/, "?");

  if (!converted.includes("%s")) return null;
  return converted;
}

export function sanitizeShortcut(rawShortcut: string, fallbackName: string): string {
  const cleaned = rawShortcut.replace(/^@+/, "").trim().toLowerCase();
  if (cleaned.length > 0 && cleaned.length <= 16 && !/\s/.test(cleaned)) {
    return cleaned;
  }
  const hostPrefix = fallbackName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);
  return hostPrefix || "search";
}

/**
 * Decompresses Mozilla `mozLz40\0` files (`sessionstore.jsonlz4`, `zen-sessions.jsonlz4`)
 * cleanly in pure JS without requiring a native LZ4 dependency.
 */
export function decompressMozLz4(buf: Buffer): string | null {
  if (buf.length < 12 || buf.subarray(0, 8).toString("ascii") !== "mozLz40\0") {
    return null;
  }
  const outLen = buf.readUInt32LE(8);
  if (outLen <= 0 || outLen > 64 * 1024 * 1024) return null;

  const out = Buffer.allocUnsafe(outLen);
  let i = 12;
  let o = 0;

  while (i < buf.length && o < outLen) {
    const token = buf[i++];
    let litLen = token >>> 4;
    if (litLen === 15) {
      let add: number;
      do {
        add = buf[i++];
        litLen += add;
      } while (add === 255 && i < buf.length);
    }

    const copyLit = Math.min(litLen, buf.length - i, outLen - o);
    buf.copy(out, o, i, i + copyLit);
    i += litLen;
    o += copyLit;
    if (i >= buf.length || o >= outLen) break;

    const offset = buf.readUInt16LE(i);
    i += 2;
    if (offset === 0 || offset > o) break;

    let matchLen = (token & 0x0f) + 4;
    if (matchLen === 19) {
      let add: number;
      do {
        add = buf[i++];
        matchLen += add;
      } while (add === 255 && i < buf.length);
    }

    let pos = o - offset;
    for (let k = 0; k < matchLen && o < outLen; k++) {
      out[o++] = out[pos++];
    }
  }

  return out.subarray(0, o).toString("utf8");
}

export async function readMozLz4Json<T = Record<string, unknown>>(
  filePath: string,
  options?: FsReadOptions
): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath);
    const decoded = decompressMozLz4(raw);
    if (!decoded) return null;
    return JSON.parse(decoded) as T;
  } catch (error) {
    rethrowPermissionErrorIfRequested(error, options);
    return null;
  }
}
