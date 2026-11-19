import { execFile, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
import { promisify } from "node:util";
import { app, net } from "electron";
import type { ProgressInfo, UpdateInfo } from "electron-updater";

const execFileAsync = promisify(execFile);

const GITHUB_OWNER = "edgarasb-dev";
const GITHUB_REPO = "lumi-browser";
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com"
]);
const BUNDLE_IDENTIFIER = "dev.lumi.browser";
const PROGRESS_EMIT_INTERVAL_MS = 100;

export interface MacZipAsset {
  url: string;
  fileName: string;
  sha512: string;
  size?: number;
}

export interface MacAdhocEligibility {
  eligible: boolean;
  bundlePath: string | null;
  reason?: string;
}

const APPLY_UPDATE_SCRIPT = `#!/bin/sh
set -eu

PARENT_PID="$1"
STAGED_APP="$2"
TARGET_APP="$3"
ZIP_PATH="$4"
STAGING_DIR="$5"
LOG_FILE="$6"

exec >>"$LOG_FILE" 2>&1
echo "[LumiUpdater] Applying update at $(date) (waiting for pid=$PARENT_PID)"

COUNT=0
while kill -0 "$PARENT_PID" 2>/dev/null; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -gt 300 ]; then
    echo "[LumiUpdater] Timed out waiting for running app (pid=$PARENT_PID) to exit"
    exit 1
  fi
  sleep 0.1
done

BACKUP_APP="\${TARGET_APP}.backup-$$"
rm -rf "$BACKUP_APP"

if ! mv "$TARGET_APP" "$BACKUP_APP"; then
  echo "[LumiUpdater] Failed to move existing bundle aside: $TARGET_APP"
  exit 1
fi

if ! mv "$STAGED_APP" "$TARGET_APP"; then
  echo "[LumiUpdater] Failed to move staged bundle into place; rolling back"
  mv "$BACKUP_APP" "$TARGET_APP" || true
  exit 1
fi

rm -rf "$BACKUP_APP" "$STAGING_DIR" "$ZIP_PATH" || true
/usr/bin/xattr -dr com.apple.quarantine "$TARGET_APP" >/dev/null 2>&1 || true

echo "[LumiUpdater] Update applied successfully; relaunching $TARGET_APP"
/usr/bin/open "$TARGET_APP"
`;

/**
 * Resolves the enclosing .app bundle path when running packaged on macOS.
 */
export function resolveMacAppBundlePath(): string | null {
  if (process.platform !== "darwin" || !app.isPackaged) {
    return null;
  }

  // Packaged macOS binary lives at <Name>.app/Contents/MacOS/<Executable>
  const bundlePath = path.resolve(process.execPath, "..", "..", "..");
  if (!bundlePath.endsWith(".app")) {
    return null;
  }
  if (!fs.existsSync(path.join(bundlePath, "Contents", "Info.plist"))) {
    return null;
  }
  return bundlePath;
}

/**
 * Checks whether an ad-hoc macOS build can safely self-replace in place
 * (not app-translocated, not on a read-only DMG volume, and writable by user).
 */
export function checkMacAdhocEligibility(): MacAdhocEligibility {
  if (process.platform !== "darwin" || !app.isPackaged) {
    return { eligible: false, bundlePath: null, reason: "Not running as a packaged macOS app" };
  }

  const bundlePath = resolveMacAppBundlePath();
  if (!bundlePath) {
    return { eligible: false, bundlePath: null, reason: "Could not locate enclosing Lumi.app bundle" };
  }

  if (bundlePath.includes("/AppTranslocation/")) {
    return {
      eligible: false,
      bundlePath,
      reason: "Move Lumi.app into Applications before using in-app updates"
    };
  }

  if (bundlePath.startsWith("/Volumes/")) {
    return {
      eligible: false,
      bundlePath,
      reason: "Move Lumi.app out of the disk image into Applications first"
    };
  }

  try {
    fs.accessSync(path.dirname(bundlePath), fs.constants.W_OK);
    fs.accessSync(bundlePath, fs.constants.W_OK);
  } catch {
    return {
      eligible: false,
      bundlePath,
      reason: "Lumi does not have write permission to update itself in this location"
    };
  }

  return { eligible: true, bundlePath };
}

function detectIsArm64Mac(): boolean {
  if (process.arch === "arm64") {
    return true;
  }
  try {
    const result = spawnSync("sysctl", ["-n", "sysctl.proc_translated"], { encoding: "utf8" });
    return (result.stdout || "").trim() === "1";
  } catch {
    return false;
  }
}

function isValidSha512Base64(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  try {
    return Buffer.from(value, "base64").length === 64;
  } catch {
    return false;
  }
}

function buildReleaseAssetUrl(rawUrl: string, updateInfo: UpdateInfo): string | null {
  if (rawUrl.startsWith("https://")) {
    try {
      const parsed = new URL(rawUrl);
      if (ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname)) {
        return parsed.href;
      }
      return null;
    } catch {
      return null;
    }
  }

  const tagFromInfo = (updateInfo as UpdateInfo & { tag?: string }).tag;
  const tag = tagFromInfo || `v${updateInfo.version}`;
  const cleanFileName = rawUrl.replace(/ /g, "-").replace(/^\/+/, "");
  if (!cleanFileName || cleanFileName.includes("..") || cleanFileName.includes("/")) {
    return null;
  }

  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(cleanFileName)}`;
}

/**
 * Selects the architecture-compatible .zip artifact and its SHA-512 hash from UpdateInfo.
 */
export function selectMacZipAsset(updateInfo: UpdateInfo): MacZipAsset | null {
  const candidates =
    Array.isArray(updateInfo.files) && updateInfo.files.length > 0
      ? updateInfo.files
      : updateInfo.path
        ? [{ url: updateInfo.path, sha512: updateInfo.sha512 }]
        : [];

  const zipCandidates = candidates.filter((file) => {
    const url = typeof file.url === "string" ? file.url : "";
    const sha = file.sha512 ?? (url === updateInfo.path ? updateInfo.sha512 : undefined);
    return url.toLowerCase().endsWith(".zip") && isValidSha512Base64(sha);
  });

  if (zipCandidates.length === 0) {
    return null;
  }

  const isArm64Mac = detectIsArm64Mac();
  const isArm64Name = (name: string) => /(?:^|[-_.])(arm64|aarch64)(?:[-_.]|$)/i.test(name);
  const isX64Name = (name: string) => /(?:^|[-_.])(x64|x86_64|intel)(?:[-_.]|$)/i.test(name);
  const isUniversalName = (name: string) => /(?:^|[-_.])universal(?:[-_.]|$)/i.test(name);

  let chosen = zipCandidates.find((f) =>
    isArm64Mac ? isArm64Name(f.url) : isX64Name(f.url) || (!isArm64Name(f.url) && !isUniversalName(f.url))
  );

  if (!chosen) {
    chosen = zipCandidates.find((f) => isUniversalName(f.url));
  }

  if (!chosen && !isArm64Mac) {
    chosen = zipCandidates.find((f) => !isArm64Name(f.url));
  }

  if (!chosen) {
    return null;
  }

  const resolvedUrl = buildReleaseAssetUrl(chosen.url, updateInfo);
  const sha512 = chosen.sha512 ?? updateInfo.sha512;
  if (!resolvedUrl || !isValidSha512Base64(sha512)) {
    return null;
  }

  return {
    url: resolvedUrl,
    fileName: path.basename(chosen.url),
    sha512,
    size: typeof chosen.size === "number" && chosen.size > 0 ? chosen.size : undefined
  };
}

function getUpdatesDirectory(): string {
  const dir = path.join(app.getPath("userData"), "pending-updates");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupOldArtifacts(updatesDir: string, keepFilePath?: string): void {
  try {
    for (const entry of fs.readdirSync(updatesDir)) {
      if (entry === "update.log" || entry === "apply-adhoc-update.sh") continue;
      const fullPath = path.join(updatesDir, entry);
      if (keepFilePath && path.resolve(fullPath) === path.resolve(keepFilePath)) continue;
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  } catch {
    // Non-critical cleanup failure
  }
}

async function computeFileSha512(filePath: string): Promise<Buffer> {
  const hash = crypto.createHash("sha512");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest();
}

function verifyDigestMatch(actualDigest: Buffer, expectedBase64: string): boolean {
  const expectedDigest = Buffer.from(expectedBase64, "base64");
  return actualDigest.length === expectedDigest.length && crypto.timingSafeEqual(actualDigest, expectedDigest);
}

/**
 * Downloads the .zip update via Chromium/Electron's network stack and verifies byte size & SHA-512.
 */
export async function downloadAndVerifyMacZip(
  asset: MacZipAsset,
  version: string,
  onProgress: (progress: ProgressInfo) => void
): Promise<string> {
  const updatesDir = getUpdatesDirectory();
  const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeName = path.basename(asset.fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const finalZipPath = path.join(updatesDir, `${safeVersion}-${safeName}`);
  const tmpPath = `${finalZipPath}.download`;

  // Reuse an already-downloaded file only if both size and SHA-512 still verify cleanly
  if (fs.existsSync(finalZipPath)) {
    try {
      const stat = fs.statSync(finalZipPath);
      const sizeOk = !asset.size || stat.size === asset.size;
      if (sizeOk && verifyDigestMatch(await computeFileSha512(finalZipPath), asset.sha512)) {
        cleanupOldArtifacts(updatesDir, finalZipPath);
        onProgress({
          bytesPerSecond: 0,
          percent: 100,
          total: stat.size,
          transferred: stat.size,
          delta: 0
        });
        return finalZipPath;
      }
    } catch {
      // Re-download below
    }
    fs.rmSync(finalZipPath, { force: true });
  }

  cleanupOldArtifacts(updatesDir);

  const response = await net.fetch(asset.url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Update download failed (HTTP ${response.status} ${response.statusText})`);
  }

  const finalResponseUrl = response.url ? new URL(response.url) : null;
  if (finalResponseUrl && finalResponseUrl.protocol !== "https:") {
    throw new Error("Refusing insecure non-HTTPS update download");
  }

  const contentLengthHeader = Number(response.headers.get("content-length") || 0);
  const totalBytes =
    asset.size || (Number.isFinite(contentLengthHeader) && contentLengthHeader > 0 ? contentLengthHeader : 0);

  const hash = crypto.createHash("sha512");
  const writeStream = fs.createWriteStream(tmpPath, { mode: 0o600 });
  const reader = response.body.getReader();

  let transferred = 0;
  let lastEmitTime = Date.now();
  let lastEmitBytes = 0;
  let deltaSinceLastEmit = 0;

  onProgress({
    bytesPerSecond: 0,
    percent: 0,
    total: totalBytes,
    transferred: 0,
    delta: 0
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      hash.update(value);
      if (!writeStream.write(value)) {
        await once(writeStream, "drain");
      }

      transferred += value.byteLength;
      deltaSinceLastEmit += value.byteLength;

      const now = Date.now();
      const elapsedMs = now - lastEmitTime;
      if (elapsedMs >= PROGRESS_EMIT_INTERVAL_MS) {
        const bytesSinceLast = transferred - lastEmitBytes;
        const bytesPerSecond = Math.round((bytesSinceLast * 1000) / elapsedMs);
        const percent = totalBytes > 0 ? Math.min(99.9, (transferred / totalBytes) * 100) : 0;

        onProgress({
          bytesPerSecond,
          percent,
          total: totalBytes,
          transferred,
          delta: deltaSinceLastEmit
        });

        lastEmitTime = now;
        lastEmitBytes = transferred;
        deltaSinceLastEmit = 0;
      }
    }

    writeStream.end();
    await finished(writeStream);

    if (asset.size && transferred !== asset.size) {
      throw new Error(`Downloaded size mismatch (expected ${asset.size} bytes, got ${transferred})`);
    }

    const actualDigest = hash.digest();
    if (!verifyDigestMatch(actualDigest, asset.sha512)) {
      throw new Error("Update archive failed SHA-512 verification");
    }

    fs.renameSync(tmpPath, finalZipPath);

    onProgress({
      bytesPerSecond: 0,
      percent: 100,
      total: totalBytes || transferred,
      transferred,
      delta: deltaSinceLastEmit
    });

    return finalZipPath;
  } catch (err) {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancel error
    }
    try {
      writeStream.destroy();
    } catch {
      // Ignore destroy error
    }
    fs.rmSync(tmpPath, { force: true });
    throw err;
  }
}

async function findValidStagedAppBundle(stagingDir: string, expectedVersion: string): Promise<string> {
  const entries = fs.readdirSync(stagingDir);
  const appDirName = entries.find((entry) => entry.endsWith(".app"));
  if (!appDirName) {
    throw new Error("Update archive did not contain an application bundle");
  }

  const stagedAppPath = path.join(stagingDir, appDirName);
  const plistPath = path.join(stagedAppPath, "Contents", "Info.plist");
  if (!fs.existsSync(plistPath)) {
    throw new Error("Extracted application bundle is missing Info.plist");
  }

  const { stdout } = await execFileAsync("/usr/bin/plutil", ["-convert", "json", "-o", "-", plistPath]);
  const info = JSON.parse(stdout) as { CFBundleIdentifier?: string; CFBundleShortVersionString?: string };
  if (info.CFBundleIdentifier !== BUNDLE_IDENTIFIER) {
    throw new Error(`Unexpected bundle identifier in update: ${info.CFBundleIdentifier ?? "unknown"}`);
  }
  if (info.CFBundleShortVersionString && info.CFBundleShortVersionString !== expectedVersion) {
    throw new Error(`Bundle version mismatch (expected ${expectedVersion}, got ${info.CFBundleShortVersionString})`);
  }

  await execFileAsync("/usr/bin/codesign", ["--verify", "--deep", "--strict", stagedAppPath]);

  // Clear quarantine flag if set externally before moving into Applications
  await execFileAsync("/usr/bin/xattr", ["-dr", "com.apple.quarantine", stagedAppPath]).catch(() => undefined);

  return stagedAppPath;
}

/**
 * Unpacks, verifies, stages, and schedules an atomic bundle replacement upon app exit.
 */
export async function prepareAndLaunchMacAdhocInstall(options: {
  zipPath: string;
  sha512: string;
  expectedVersion: string;
  onBeforeQuit: () => Promise<void>;
}): Promise<void> {
  const { zipPath, sha512, expectedVersion, onBeforeQuit } = options;

  const eligibility = checkMacAdhocEligibility();
  if (!eligibility.eligible || !eligibility.bundlePath) {
    throw new Error(eligibility.reason || "In-place update is not permitted in this location");
  }

  if (!fs.existsSync(zipPath)) {
    throw new Error("Downloaded update archive is missing");
  }

  // Re-verify SHA-512 immediately before extracting
  if (!verifyDigestMatch(await computeFileSha512(zipPath), sha512)) {
    fs.rmSync(zipPath, { force: true });
    throw new Error("Update archive failed pre-install SHA-512 verification");
  }

  const updatesDir = getUpdatesDirectory();
  const safeVersion = expectedVersion.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stagingDir = path.join(updatesDir, `staged-${safeVersion}-${Date.now()}`);
  fs.mkdirSync(stagingDir, { recursive: true });

  let stagedAppPath: string;
  try {
    // ditto preserves macOS frameworks, symlinks, and resource forks accurately
    await execFileAsync("/usr/bin/ditto", ["-xk", zipPath, stagingDir]);
    stagedAppPath = await findValidStagedAppBundle(stagingDir, expectedVersion);
  } catch (err) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw err;
  }

  const scriptPath = path.join(updatesDir, "apply-adhoc-update.sh");
  fs.writeFileSync(scriptPath, APPLY_UPDATE_SCRIPT, { mode: 0o700 });
  const logFile = path.join(updatesDir, "update.log");

  await onBeforeQuit();

  const child = spawn(
    "/bin/sh",
    [scriptPath, String(process.pid), stagedAppPath, eligibility.bundlePath, zipPath, stagingDir, logFile],
    {
      detached: true,
      stdio: "ignore"
    }
  );
  child.unref();

  app.quit();
}
