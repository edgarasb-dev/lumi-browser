import { execFile } from "child_process";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { withTempSqliteCopy } from "../utils";

const execFileAsync = promisify(execFile);

const CHROME_SAFE_STORAGE_SERVICES: Record<string, string[]> = {
  chrome: ["Chrome Safe Storage"],
  "chrome-beta": ["Chrome Safe Storage"],
  "chrome-dev": ["Chrome Safe Storage"],
  "chrome-canary": ["Chrome Safe Storage"],
  brave: ["Brave Safe Storage"],
  "brave-beta": ["Brave Safe Storage"],
  "brave-nightly": ["Brave Safe Storage"],
  edge: ["Microsoft Edge Safe Storage"],
  "edge-beta": ["Microsoft Edge Safe Storage"],
  "edge-dev": ["Microsoft Edge Safe Storage"],
  "edge-canary": ["Microsoft Edge Safe Storage"],
  vivaldi: ["Vivaldi Safe Storage"],
  opera: ["Opera Safe Storage", "Chromium Safe Storage"],
  "opera-gx": ["Opera Safe Storage", "Chromium Safe Storage"],
  "opera-air": ["Opera Safe Storage", "Chromium Safe Storage"],
  arc: ["Arc Safe Storage", "Chromium Safe Storage"],
  dia: ["Dia Safe Storage", "Chromium Safe Storage"],
  comet: ["Comet Safe Storage", "Chromium Safe Storage"],
  atlas: ["Atlas Safe Storage", "Chromium Safe Storage"],
  chromium: ["Chromium Safe Storage"],
  helium: ["Helium Safe Storage", "Chromium Safe Storage"],
  thorium: ["Thorium Safe Storage", "Chromium Safe Storage"]
};

const PBKDF2_SALT = Buffer.from("saltysalt", "utf8");
const CHROME_CBC_IV = Buffer.alloc(16, 0x20); // 16 ASCII spaces

// In-memory session cache so macOS Keychain is prompted at most once per Safe Storage service per session.
const cachedServiceAesKeys = new Map<string, Buffer>();
const inFlightServiceLookups = new Map<string, Promise<Buffer | null>>();

async function doesKeychainServiceExist(service: string): Promise<boolean> {
  try {
    // Without `-w`, `find-generic-password` inspects public item metadata only and never triggers a Keychain prompt.
    await execFileAsync("/usr/bin/security", ["find-generic-password", "-s", service], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function resolveDarwinServiceAesKey(service: string): Promise<Buffer | null> {
  const cached = cachedServiceAesKeys.get(service);
  if (cached) return cached;

  const inFlight = inFlightServiceLookups.get(service);
  if (inFlight) return inFlight;

  const lookupPromise = (async (): Promise<Buffer | null> => {
    try {
      const { stdout } = await execFileAsync("/usr/bin/security", ["find-generic-password", "-w", "-s", service], {
        timeout: 25_000
      });
      const secret = stdout.replace(/[\r\n]+$/, "");
      if (!secret) return null;
      const derived = crypto.pbkdf2Sync(Buffer.from(secret, "utf8"), PBKDF2_SALT, 1003, 16, "sha1");
      cachedServiceAesKeys.set(service, derived);
      return derived;
    } catch {
      return null;
    } finally {
      inFlightServiceLookups.delete(service);
    }
  })();

  inFlightServiceLookups.set(service, lookupPromise);
  return lookupPromise;
}

/**
 * Resolves and derives the 16-byte AES-128-CBC key used by Chromium browsers on macOS/Linux
 * (`v10`/`v11` encrypted cookies and passwords).
 */
export async function getChromiumSafeStorageAesKey(browserId: string): Promise<Buffer | null> {
  if (process.platform === "darwin") {
    const services = CHROME_SAFE_STORAGE_SERVICES[browserId] ?? ["Chromium Safe Storage"];
    for (const service of services) {
      const cached = cachedServiceAesKeys.get(service);
      if (cached) return cached;
    }

    // First locate which candidate service actually exists in Keychain without `-w` (zero prompt),
    // and only prompt `-w` once for that exact service.
    for (const service of services) {
      if (await doesKeychainServiceExist(service)) {
        return resolveDarwinServiceAesKey(service);
      }
    }

    return null;
  }

  if (process.platform === "linux") {
    // Default v10 key when no keyring password is used
    return crypto.pbkdf2Sync(Buffer.from("peanuts", "utf8"), PBKDF2_SALT, 1, 16, "sha1");
  }

  return null;
}

/**
 * Decrypts a Chromium `v10`/`v11` encrypted blob. When `cookieHostKeyForDigest` is passed
 * (for Chromium Cookies DB schema >= 24), strips the prepended 32-byte SHA-256(host_key) digest.
 */
export function decryptChromiumEncryptedValue(
  encrypted: Buffer,
  aesKey: Buffer | null,
  cookieHostKeyForDigest?: string
): string | null {
  if (!encrypted || encrypted.length === 0) return "";

  const prefix = encrypted.subarray(0, 3).toString("ascii");
  if (prefix !== "v10" && prefix !== "v11") {
    // Plaintext fallback if unencrypted bytes were stored directly
    return encrypted.toString("utf8");
  }

  if (!aesKey) return null;
  const ciphertext = encrypted.subarray(3);
  if (ciphertext.length === 0 || ciphertext.length % 16 !== 0) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv("aes-128-cbc", aesKey, CHROME_CBC_IV);
    decipher.setAutoPadding(true);
    let plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Chromium v130+ (Cookies meta.version >= 24) prepends SHA-256(host_key) to cookie plaintext.
    if (cookieHostKeyForDigest !== undefined && plaintext.length >= 32) {
      const expectedDigest = crypto.createHash("sha256").update(cookieHostKeyForDigest, "utf8").digest();
      if (plaintext.subarray(0, 32).equals(expectedDigest)) {
        plaintext = plaintext.subarray(32);
      }
    }

    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}

// --- Minimal ASN.1 DER Reader & Firefox NSS (`key4.db` + `logins.json`) Decryption ---

interface DerNode {
  tag: number;
  data: Buffer;
  children: DerNode[];
}

function parseDer(buf: Buffer, offset = 0): { node: DerNode; next: number } {
  if (offset + 2 > buf.length) throw new Error("Truncated DER header");
  const tag = buf[offset]!;
  let len = buf[offset + 1]!;
  let cursor = offset + 2;

  if (len & 0x80) {
    const numBytes = len & 0x7f;
    if (numBytes === 0 || cursor + numBytes > buf.length) throw new Error("Invalid DER length");
    len = 0;
    for (let i = 0; i < numBytes; i++) {
      len = (len << 8) | buf[cursor++]!;
    }
  }

  if (cursor + len > buf.length) throw new Error("DER length out of bounds");
  const data = buf.subarray(cursor, cursor + len);
  const children: DerNode[] = [];

  // Bit 5 (0x20) marks constructed tags such as SEQUENCE (0x30)
  if ((tag & 0x20) !== 0) {
    let inner = 0;
    while (inner < data.length) {
      const parsed = parseDer(data, inner);
      children.push(parsed.node);
      inner = parsed.next;
    }
  }

  return { node: { tag, data, children }, next: cursor + len };
}

function derOid(node: DerNode): string {
  const b = node.data;
  if (b.length === 0) return "";
  const first = b[0]!;
  const parts = [Math.floor(first / 40), first % 40];
  let acc = 0;
  for (let i = 1; i < b.length; i++) {
    const byte = b[i]!;
    acc = (acc << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      parts.push(acc);
      acc = 0;
    }
  }
  return parts.join(".");
}

function derInt(node: DerNode): number {
  let n = 0;
  for (const byte of node.data) {
    n = (n << 8) | byte;
  }
  return n;
}

const OID_PBES2 = "1.2.840.113549.1.5.13";
const OID_PBKDF2 = "1.2.840.113549.1.5.12";
const OID_HMAC_SHA256 = "1.2.840.113549.2.9";
const OID_AES256_CBC = "2.16.840.1.101.3.4.1.42";
const OID_PBE_SHA1_3DES = "1.2.840.113549.1.12.5.1.3";

function decryptNssKey4Item(globalSalt: Buffer, itemDer: Buffer): Buffer {
  const root = parseDer(itemDer).node;
  const algoSeq = root.children[0]!;
  const ciphertext = root.children[1]!.data;
  const oid = derOid(algoSeq.children[0]!);

  if (oid === OID_PBES2) {
    const paramsSeq = algoSeq.children[1]!;
    const kdfSeq = paramsSeq.children[0]!;
    const cipherSeq = paramsSeq.children[1]!;
    if (derOid(kdfSeq.children[0]!) !== OID_PBKDF2) {
      throw new Error("Unsupported PBES2 KDF in Firefox key4.db");
    }
    const kdfParams = kdfSeq.children[1]!;
    const entrySalt = kdfParams.children[0]!.data;
    const iterations = derInt(kdfParams.children[1]!);
    const keyLength =
      kdfParams.children.length >= 3 && kdfParams.children[2]!.tag === 0x02 ? derInt(kdfParams.children[2]!) : 32;
    const prfIdx = kdfParams.children.findIndex((c) => c.tag === 0x30);
    const prfOid = prfIdx >= 0 ? derOid(kdfParams.children[prfIdx]!.children[0]!) : OID_HMAC_SHA256;
    const hashAlg = prfOid === OID_HMAC_SHA256 ? "sha256" : "sha1";

    const k = crypto.createHash("sha1").update(globalSalt).digest();
    const key = crypto.pbkdf2Sync(k, entrySalt, iterations, keyLength, hashAlg);

    if (derOid(cipherSeq.children[0]!) !== OID_AES256_CBC) {
      throw new Error("Unsupported PBES2 cipher in Firefox key4.db");
    }
    const rawIv = cipherSeq.children[1]!.data;
    const iv = rawIv.length === 14 ? Buffer.concat([Buffer.from([0x04, 0x0e]), rawIv]) : rawIv;
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    decipher.setAutoPadding(true);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  if (oid === OID_PBE_SHA1_3DES) {
    const entrySalt = algoSeq.children[1]!.children[0]!.data;
    const hp = crypto
      .createHash("sha1")
      .update(crypto.createHash("sha1").update(globalSalt).digest())
      .update(entrySalt)
      .digest();
    const pes = Buffer.concat([entrySalt, Buffer.alloc(Math.max(0, 20 - entrySalt.length), 0)]).subarray(0, 20);
    const chp = crypto.createHash("sha1").update(hp).update(entrySalt).digest();
    const k1 = crypto
      .createHmac("sha1", chp)
      .update(Buffer.concat([pes, entrySalt]))
      .digest();
    const tk = crypto.createHmac("sha1", chp).update(pes).digest();
    const k2 = crypto
      .createHmac("sha1", chp)
      .update(Buffer.concat([tk, entrySalt]))
      .digest();
    const kFull = Buffer.concat([k1, k2]);
    const key = kFull.subarray(0, 24);
    const iv = kFull.subarray(kFull.length - 8);
    const decipher = crypto.createDecipheriv("des-ede3-cbc", key, iv);
    decipher.setAutoPadding(true);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  throw new Error(`Unsupported Firefox key4.db algorithm OID: ${oid}`);
}

function decryptFirefox3DesField(base64Der: string, key24: Buffer): string {
  const der = Buffer.from(base64Der, "base64");
  const root = parseDer(der).node;
  const iv = root.children[1]!.children[1]!.data;
  const ciphertext = root.children[2]!.data;
  const decipher = crypto.createDecipheriv("des-ede3-cbc", key24, iv);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export interface FirefoxLoginRecord {
  originUrl: string;
  actionUrl?: string;
  username: string;
  password: string;
  createdAt?: number;
  lastUsedAt?: number;
}

interface FirefoxLoginsJsonShape {
  logins?: Array<{
    hostname?: string;
    formSubmitURL?: string;
    encryptedUsername?: string;
    encryptedPassword?: string;
    timeCreated?: number;
    timeLastUsed?: number;
  }>;
}

export async function decryptFirefoxLogins(
  key4DbPath: string,
  loginsJsonPath: string
): Promise<{ logins: FirefoxLoginRecord[]; primaryPasswordProtected: boolean }> {
  const rawJson = await fs.readFile(loginsJsonPath, "utf8");
  const parsed = JSON.parse(rawJson) as FirefoxLoginsJsonShape;
  const entries = parsed.logins ?? [];
  if (entries.length === 0) {
    return { logins: [], primaryPasswordProtected: false };
  }

  const masterKey = await withTempSqliteCopy(key4DbPath, (db) => {
    const meta = db.prepare("SELECT item1, item2 FROM metaData WHERE id = 'password'").get() as
      { item1?: Buffer; item2?: Buffer } | undefined;
    if (!meta?.item1 || !meta.item2) return null;

    let checkPlain: Buffer;
    try {
      checkPlain = decryptNssKey4Item(Buffer.from(meta.item1), Buffer.from(meta.item2));
    } catch {
      return "locked" as const;
    }
    if (checkPlain.toString("utf8") !== "password-check") {
      return "locked" as const;
    }

    const nss = db.prepare("SELECT a11, a102 FROM nssPrivate WHERE a11 IS NOT NULL").get() as
      { a11?: Buffer } | undefined;
    if (!nss?.a11) return null;

    const decryptedKey = decryptNssKey4Item(Buffer.from(meta.item1), Buffer.from(nss.a11));
    return decryptedKey.subarray(0, 24);
  });

  if (masterKey === "locked") {
    return { logins: [], primaryPasswordProtected: true };
  }
  if (!masterKey) {
    return { logins: [], primaryPasswordProtected: false };
  }

  const logins: FirefoxLoginRecord[] = [];
  for (const entry of entries) {
    if (!entry.hostname || !entry.encryptedPassword) continue;
    try {
      const username = entry.encryptedUsername ? decryptFirefox3DesField(entry.encryptedUsername, masterKey) : "";
      const password = decryptFirefox3DesField(entry.encryptedPassword, masterKey);
      if (!password) continue;
      logins.push({
        originUrl: entry.hostname,
        actionUrl: entry.formSubmitURL ?? undefined,
        username,
        password,
        createdAt: entry.timeCreated,
        lastUsedAt: entry.timeLastUsed
      });
    } catch {
      // Skip malformed/corrupted rows
    }
  }

  return { logins, primaryPasswordProtected: false };
}

export async function countFirefoxLogins(loginsJsonPath: string): Promise<number> {
  try {
    const raw = await fs.readFile(loginsJsonPath, "utf8");
    const parsed = JSON.parse(raw) as FirefoxLoginsJsonShape;
    return parsed.logins?.length ?? 0;
  } catch {
    return 0;
  }
}

export function buildFirefoxProfileFiles(profileDir: string) {
  return {
    key4DbPath: path.join(profileDir, "key4.db"),
    loginsJsonPath: path.join(profileDir, "logins.json")
  };
}
