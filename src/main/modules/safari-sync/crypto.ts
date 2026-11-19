import { createCipheriv, createDecipheriv, pbkdf2, randomBytes } from "crypto";
import { promisify } from "util";
import type { SyncSnapshotPayload } from "~/types/safari-sync";

const pbkdf2Async = promisify(pbkdf2);

const PBKDF2_ITERATIONS = 120_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface EncryptedSyncEnvelope {
  format: "lumi-sync";
  version: 1;
  encrypted: true;
  cipher: "aes-256-gcm";
  kdf: "pbkdf2-sha256";
  iterations: number;
  deviceId: string;
  deviceName: string;
  exportedAt: number;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export async function encryptSyncSnapshot(
  payload: SyncSnapshotPayload,
  passphrase: string
): Promise<EncryptedSyncEnvelope> {
  if (!passphrase || passphrase.trim().length < 4) {
    throw new Error("A passphrase of at least 4 characters is required for encrypted sync.");
  }

  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await pbkdf2Async(passphrase, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const aad = Buffer.from(`lumi-sync:v1:${payload.deviceId}`, "utf8");
  cipher.setAAD(aad);

  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    format: "lumi-sync",
    version: 1,
    encrypted: true,
    cipher: "aes-256-gcm",
    kdf: "pbkdf2-sha256",
    iterations: PBKDF2_ITERATIONS,
    deviceId: payload.deviceId,
    deviceName: payload.deviceName,
    exportedAt: payload.exportedAt,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64")
  };
}

export async function decryptSyncSnapshot(envelope: unknown, passphrase: string): Promise<SyncSnapshotPayload> {
  if (!envelope || typeof envelope !== "object") {
    throw new Error("Invalid sync file format.");
  }

  const env = envelope as Partial<EncryptedSyncEnvelope>;
  if (
    env.format !== "lumi-sync" ||
    env.version !== 1 ||
    env.encrypted !== true ||
    env.cipher !== "aes-256-gcm" ||
    !env.salt ||
    !env.iv ||
    !env.tag ||
    !env.ciphertext ||
    !env.deviceId
  ) {
    throw new Error("Unsupported or corrupted Lumi sync envelope.");
  }

  if (!passphrase) {
    throw new Error("Sync passphrase is not configured.");
  }

  const iterations =
    typeof env.iterations === "number" && env.iterations >= 10_000 ? env.iterations : PBKDF2_ITERATIONS;
  const salt = Buffer.from(env.salt, "base64");
  const iv = Buffer.from(env.iv, "base64");
  const tag = Buffer.from(env.tag, "base64");
  const ciphertext = Buffer.from(env.ciphertext, "base64");

  const key = await pbkdf2Async(passphrase, salt, iterations, KEY_BYTES, "sha256");

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(`lumi-sync:v1:${env.deviceId}`, "utf8"));
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(decrypted) as SyncSnapshotPayload;
    if (!parsed || parsed.version !== 1 || !parsed.deviceId) {
      throw new Error("Decrypted payload has invalid schema.");
    }
    return parsed;
  } catch {
    throw new Error("Could not decrypt sync snapshot — verify your sync passphrase.");
  }
}

export function generateStrongPassphrase(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let chunk = "";
    for (let i = 0; i < 4; i++) {
      chunk += alphabet[bytes[g * 4 + i]! % alphabet.length];
    }
    groups.push(chunk);
  }
  return `lumi-${groups.join("-")}`;
}

export function generatePairingToken(): string {
  return randomBytes(18).toString("base64url");
}

export function generatePairingCode(): string {
  const bytes = randomBytes(6);
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += digits[bytes[i]! % digits.length];
  }
  return code;
}
