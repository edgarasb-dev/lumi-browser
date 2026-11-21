import fs from "fs/promises";
import os from "os";
import path from "path";
import zlib from "zlib";

export interface DecodedLocalStorageOrigin {
  origin: string;
  entries: Array<[string, string]>;
}

const SSTABLE_MAGIC = 0xdb4775248b80fb57n;
const SSTABLE_FOOTER_SIZE = 48;
const LOG_BLOCK_SIZE = 32_768;
const LOG_HEADER_SIZE = 7;

function readVarint(buf: Buffer, offset: number): { value: number; next: number } {
  let result = 0;
  let multiplier = 1;
  let pos = offset;

  while (pos < buf.length) {
    const byte = buf[pos++]!;
    result += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) {
      return { value: result, next: pos };
    }
    multiplier *= 128;
  }
  throw new Error("Truncated varint in LevelDB file");
}

/**
 * Pure-JS Snappy block decompressor for Chromium LevelDB `.ldb` blocks.
 */
export function snappyDecompress(src: Buffer): Buffer {
  if (src.length === 0) return Buffer.alloc(0);
  const { value: uncompressedLen, next: startPos } = readVarint(src, 0);
  if (uncompressedLen < 0 || uncompressedLen > 64 * 1024 * 1024) {
    throw new Error(`Invalid Snappy block length: ${uncompressedLen}`);
  }

  const out = Buffer.allocUnsafe(uncompressedLen);
  let pos = startPos;
  let outPos = 0;

  while (pos < src.length && outPos < uncompressedLen) {
    const tag = src[pos++]!;
    const tagType = tag & 0x03;

    if (tagType === 0) {
      let litLen = (tag >>> 2) + 1;
      if (litLen > 60) {
        const extraBytes = litLen - 60;
        let computed = 0;
        for (let i = 0; i < extraBytes; i++) {
          computed |= src[pos++]! << (8 * i);
        }
        litLen = computed + 1;
      }
      src.copy(out, outPos, pos, pos + litLen);
      pos += litLen;
      outPos += litLen;
      continue;
    }

    let copyLen = 0;
    let offset = 0;

    if (tagType === 1) {
      copyLen = ((tag >>> 2) & 0x07) + 4;
      offset = ((tag & 0xe0) << 3) | src[pos++]!;
    } else if (tagType === 2) {
      copyLen = (tag >>> 2) + 1;
      offset = src.readUInt16LE(pos);
      pos += 2;
    } else {
      copyLen = (tag >>> 2) + 1;
      offset = src.readUInt32LE(pos);
      pos += 4;
    }

    if (offset <= 0 || offset > outPos) {
      throw new Error(`Invalid Snappy backreference offset=${offset} outPos=${outPos}`);
    }
    for (let i = 0; i < copyLen; i++) {
      out[outPos + i] = out[outPos - offset + i]!;
    }
    outPos += copyLen;
  }

  return out.subarray(0, outPos);
}

function decompressTableBlock(fileBuf: Buffer, offset: number, size: number): Buffer {
  if (offset + size + 1 > fileBuf.length) {
    throw new Error("LevelDB block handle exceeds file bounds");
  }
  const compressionType = fileBuf[offset + size]!;
  const raw = fileBuf.subarray(offset, offset + size);

  if (compressionType === 0) return raw;
  if (compressionType === 1) return snappyDecompress(raw);
  if (
    compressionType === 2 &&
    typeof (zlib as unknown as { zstdDecompressSync?: (b: Buffer) => Buffer }).zstdDecompressSync === "function"
  ) {
    return (zlib as unknown as { zstdDecompressSync: (b: Buffer) => Buffer }).zstdDecompressSync(raw);
  }
  throw new Error(`Unsupported LevelDB block compression type: ${compressionType}`);
}

function parseTableBlockEntries(block: Buffer, onEntry: (key: Buffer, value: Buffer) => void): void {
  if (block.length < 4) return;
  const numRestarts = block.readUInt32LE(block.length - 4);
  const entriesEnd = block.length - 4 - numRestarts * 4;
  if (entriesEnd < 0) return;

  let prevKey = Buffer.alloc(0);
  let pos = 0;
  while (pos < entriesEnd) {
    const s = readVarint(block, pos);
    const ns = readVarint(block, s.next);
    const vl = readVarint(block, ns.next);
    pos = vl.next;

    const shared = s.value;
    const nonShared = ns.value;
    const valLen = vl.value;

    if (pos + nonShared + valLen > entriesEnd) break;
    const suffix = block.subarray(pos, pos + nonShared);
    pos += nonShared;
    const value = block.subarray(pos, pos + valLen);
    pos += valLen;

    const fullKey = shared > 0 ? Buffer.concat([prevKey.subarray(0, shared), suffix]) : Buffer.from(suffix);
    prevKey = fullKey;
    onEntry(fullKey, value);
  }
}

interface SequenceRecord {
  seq: bigint;
  isDelete: boolean;
  userKey: Buffer;
  value: Buffer;
}

function parseLdbFile(fileBuf: Buffer): SequenceRecord[] {
  if (fileBuf.length < SSTABLE_FOOTER_SIZE) return [];
  const magic = fileBuf.readBigUInt64LE(fileBuf.length - 8);
  if (magic !== SSTABLE_MAGIC) return [];

  const footerStart = fileBuf.length - SSTABLE_FOOTER_SIZE;
  const metaOff = readVarint(fileBuf, footerStart);
  const metaSize = readVarint(fileBuf, metaOff.next);
  const idxOff = readVarint(fileBuf, metaSize.next);
  const idxSize = readVarint(fileBuf, idxOff.next);

  const indexBlock = decompressTableBlock(fileBuf, idxOff.value, idxSize.value);
  const records: SequenceRecord[] = [];

  parseTableBlockEntries(indexBlock, (_indexKey, handleBuf) => {
    const dOff = readVarint(handleBuf, 0);
    const dSize = readVarint(handleBuf, dOff.next);
    const dataBlock = decompressTableBlock(fileBuf, dOff.value, dSize.value);

    parseTableBlockEntries(dataBlock, (internalKey, val) => {
      if (internalKey.length < 8) return;
      const trailer = internalKey.readBigUInt64LE(internalKey.length - 8);
      const valType = Number(trailer & 0xffn);
      const seq = trailer >> 8n;
      const userKey = internalKey.subarray(0, internalKey.length - 8);

      records.push({
        seq,
        isDelete: valType === 0,
        userKey,
        value: val
      });
    });
  });

  return records;
}

function readLogRecordPayloads(logBuf: Buffer): Buffer[] {
  const payloads: Buffer[] = [];
  let fragmentParts: Buffer[] = [];
  let blockStart = 0;

  while (blockStart < logBuf.length) {
    let pos = blockStart;
    const blockEnd = Math.min(blockStart + LOG_BLOCK_SIZE, logBuf.length);

    while (pos + LOG_HEADER_SIZE <= blockEnd) {
      const length = logBuf.readUInt16LE(pos + 4);
      const recType = logBuf[pos + 6]!;
      pos += LOG_HEADER_SIZE;

      if (recType === 0 && length === 0) {
        // Remainder of 32KB block is padding
        break;
      }
      if (pos + length > blockEnd) break;

      const chunk = logBuf.subarray(pos, pos + length);
      pos += length;

      if (recType === 1) {
        // kFullType
        fragmentParts = [];
        payloads.push(chunk);
      } else if (recType === 2) {
        // kFirstType
        fragmentParts = [chunk];
      } else if (recType === 3) {
        // kMiddleType
        if (fragmentParts.length > 0) fragmentParts.push(chunk);
      } else if (recType === 4) {
        // kLastType
        if (fragmentParts.length > 0) {
          fragmentParts.push(chunk);
          payloads.push(Buffer.concat(fragmentParts));
          fragmentParts = [];
        }
      }
    }

    blockStart += LOG_BLOCK_SIZE;
  }

  return payloads;
}

function parseWriteBatchPayload(batch: Buffer): SequenceRecord[] {
  if (batch.length < 12) return [];
  let seq = batch.readBigUInt64LE(0);
  const count = batch.readUInt32LE(8);
  let pos = 12;
  const records: SequenceRecord[] = [];

  for (let i = 0; i < count && pos < batch.length; i++) {
    const kType = batch[pos++]!;
    const kl = readVarint(batch, pos);
    pos = kl.next;
    if (pos + kl.value > batch.length) break;
    const userKey = batch.subarray(pos, pos + kl.value);
    pos += kl.value;

    if (kType === 1) {
      const vl = readVarint(batch, pos);
      pos = vl.next;
      if (pos + vl.value > batch.length) break;
      const value = batch.subarray(pos, pos + vl.value);
      pos += vl.value;
      records.push({ seq, isDelete: false, userKey, value });
    } else if (kType === 0) {
      records.push({ seq, isDelete: true, userKey, value: Buffer.alloc(0) });
    }
    seq += 1n;
  }

  return records;
}

/**
 * Parses `MANIFEST-*` WAL records to resolve the active SSTable filenames + minimum WAL log number.
 */
function resolveLiveFilesFromManifest(manifestBuf: Buffer): { liveTables: Set<string>; minLogNum: number } | null {
  try {
    const activeFiles = new Set<number>();
    let minLogNum = 0;

    for (const edit of readLogRecordPayloads(manifestBuf)) {
      let pos = 0;
      while (pos < edit.length) {
        const tag = readVarint(edit, pos);
        pos = tag.next;
        switch (tag.value) {
          case 1: {
            // kComparator: Slice
            const len = readVarint(edit, pos);
            pos = len.next + len.value;
            break;
          }
          case 2: {
            // kLogNumber
            const n = readVarint(edit, pos);
            pos = n.next;
            minLogNum = n.value;
            break;
          }
          case 3:
          case 4:
          case 9: {
            // kNextFileNumber, kLastSequence, kPrevLogNumber
            const v = readVarint(edit, pos);
            pos = v.next;
            break;
          }
          case 5: {
            // kCompactPointer: level + internal key slice
            const lvl = readVarint(edit, pos);
            const kl = readVarint(edit, lvl.next);
            pos = kl.next + kl.value;
            break;
          }
          case 6: {
            // kDeletedFile: level + fileNumber
            const lvl = readVarint(edit, pos);
            const fn = readVarint(edit, lvl.next);
            pos = fn.next;
            activeFiles.delete(fn.value);
            break;
          }
          case 7: {
            // kNewFile: level + fileNumber + fileSize + smallest slice + largest slice
            const lvl = readVarint(edit, pos);
            const fn = readVarint(edit, lvl.next);
            const fz = readVarint(edit, fn.next);
            const sm = readVarint(edit, fz.next);
            const lg = readVarint(edit, sm.next + sm.value);
            pos = lg.next + lg.value;
            activeFiles.add(fn.value);
            break;
          }
          default:
            return null;
        }
      }
    }

    const liveTables = new Set<string>();
    for (const num of activeFiles) {
      liveTables.add(`${String(num).padStart(6, "0")}.ldb`);
      liveTables.add(`${String(num).padStart(6, "0")}.sst`);
    }
    return { liveTables, minLogNum };
  } catch {
    return null;
  }
}

function decodeChromiumStorageText(buf: Buffer): string {
  if (buf.length === 0) return "";
  const format = buf[0]!;
  const body = buf.subarray(1);
  if (format === 0x00) {
    return body.toString("utf16le");
  }
  if (format === 0x01) {
    return body.toString("latin1");
  }
  return buf.toString("utf8");
}

function decodeChromiumLocalStorageKey(userKey: Buffer): { origin: string; storageKey: string } | null {
  // Chromium stores Local Storage entries as `_<origin>\x00<formatByte><key>`.
  if (userKey.length < 3 || userKey[0] !== 0x5f) return null; // must start with '_'
  const sepIdx = userKey.indexOf(0x00, 1);
  if (sepIdx <= 1 || sepIdx + 1 >= userKey.length) return null;

  const origin = userKey.subarray(1, sepIdx).toString("utf8");
  if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
    return null;
  }

  const storageKey = decodeChromiumStorageText(userKey.subarray(sepIdx + 1));
  return { origin, storageKey };
}

/**
 * Reads Chromium's `Local Storage/leveldb` safely via a temporary snapshot copy (ignoring `LOCK`),
 * replaying live SSTables and active `.log` WAL batches in sequence-number order.
 */
export async function readChromiumLocalStorage(leveldbDir: string): Promise<DecodedLocalStorageOrigin[]> {
  const snapshotDir = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-ls-snap-"));
  try {
    const entries = await fs.readdir(leveldbDir, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((e) => e.isFile() && e.name !== "LOCK")
        .map((e) => fs.copyFile(path.join(leveldbDir, e.name), path.join(snapshotDir, e.name)))
    );

    const files = await fs.readdir(snapshotDir);
    let manifestInfo: { liveTables: Set<string>; minLogNum: number } | null = null;

    if (files.includes("CURRENT")) {
      const currentName = (await fs.readFile(path.join(snapshotDir, "CURRENT"), "utf8")).trim();
      if (files.includes(currentName)) {
        const mBuf = await fs.readFile(path.join(snapshotDir, currentName));
        manifestInfo = resolveLiveFilesFromManifest(mBuf);
      }
    }

    const ldbFiles = files
      .filter((f) => f.endsWith(".ldb") || f.endsWith(".sst"))
      .filter((f) => !manifestInfo || manifestInfo.liveTables.has(f))
      .sort();

    const logFiles = files
      .filter((f) => f.endsWith(".log"))
      .filter((f) => {
        if (!manifestInfo) return true;
        const n = Number.parseInt(f.replace(".log", ""), 10);
        return Number.isFinite(n) && n >= manifestInfo.minLogNum;
      })
      .sort();

    const latestByKey = new Map<string, SequenceRecord>();
    const applyRecord = (rec: SequenceRecord) => {
      const kHex = rec.userKey.toString("hex");
      const prev = latestByKey.get(kHex);
      if (!prev || rec.seq >= prev.seq) {
        latestByKey.set(kHex, rec);
      }
    };

    for (const f of ldbFiles) {
      try {
        const buf = await fs.readFile(path.join(snapshotDir, f));
        for (const rec of parseLdbFile(buf)) applyRecord(rec);
      } catch {
        // Continue across readable tables
      }
    }

    for (const f of logFiles) {
      try {
        const buf = await fs.readFile(path.join(snapshotDir, f));
        for (const payload of readLogRecordPayloads(buf)) {
          for (const rec of parseWriteBatchPayload(payload)) applyRecord(rec);
        }
      } catch {
        // Continue across readable logs
      }
    }

    const byOrigin = new Map<string, Array<[string, string]>>();
    for (const rec of latestByKey.values()) {
      if (rec.isDelete) continue;
      const decodedKey = decodeChromiumLocalStorageKey(rec.userKey);
      if (!decodedKey) continue;
      const val = decodeChromiumStorageText(rec.value);
      let list = byOrigin.get(decodedKey.origin);
      if (!list) {
        list = [];
        byOrigin.set(decodedKey.origin, list);
      }
      list.push([decodedKey.storageKey, val]);
    }

    return Array.from(byOrigin.entries()).map(([origin, list]) => ({ origin, entries: list }));
  } finally {
    await fs.rm(snapshotDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function countChromiumStorageOrigins(profileDir: string): Promise<number> {
  const origins = new Set<string>();
  const lsDir = path.join(profileDir, "Local Storage", "leveldb");
  try {
    const lsOrigins = await readChromiumLocalStorage(lsDir);
    for (const item of lsOrigins) origins.add(item.origin);
  } catch {
    // Ignore unreadable/missing Local Storage
  }

  const idbDir = path.join(profileDir, "IndexedDB");
  try {
    const entries = await fs.readdir(idbDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith(".indexeddb.leveldb")) continue;
      const m = entry.name.match(/^(https?)_(.+)_(\d+)\.indexeddb\.leveldb$/);
      if (!m) continue;
      const scheme = m[1]!;
      const host = m[2]!;
      const port = m[3]!;
      const portSuffix = port !== "0" ? `:${port}` : "";
      origins.add(`${scheme}://${host}${portSuffix}`);
    }
  } catch {
    // Ignore missing IndexedDB
  }

  return origins.size;
}
