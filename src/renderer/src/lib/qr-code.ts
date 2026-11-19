// Pure TypeScript ISO/IEC 18004 QR Code Generator (Byte mode, ECC Level M, Versions 1-12).

interface VersionSpec {
  version: number;
  ecPerBlock: number;
  g1Blocks: number;
  g1Data: number;
  g2Blocks: number;
  g2Data: number;
  alignCenters: number[];
}

const VERSION_SPECS: VersionSpec[] = [
  { version: 1, ecPerBlock: 10, g1Blocks: 1, g1Data: 16, g2Blocks: 0, g2Data: 0, alignCenters: [] },
  { version: 2, ecPerBlock: 16, g1Blocks: 1, g1Data: 28, g2Blocks: 0, g2Data: 0, alignCenters: [6, 18] },
  { version: 3, ecPerBlock: 26, g1Blocks: 1, g1Data: 44, g2Blocks: 0, g2Data: 0, alignCenters: [6, 22] },
  { version: 4, ecPerBlock: 18, g1Blocks: 2, g1Data: 32, g2Blocks: 0, g2Data: 0, alignCenters: [6, 26] },
  { version: 5, ecPerBlock: 24, g1Blocks: 2, g1Data: 43, g2Blocks: 0, g2Data: 0, alignCenters: [6, 30] },
  { version: 6, ecPerBlock: 16, g1Blocks: 4, g1Data: 27, g2Blocks: 0, g2Data: 0, alignCenters: [6, 34] },
  { version: 7, ecPerBlock: 18, g1Blocks: 4, g1Data: 31, g2Blocks: 0, g2Data: 0, alignCenters: [6, 22, 38] },
  { version: 8, ecPerBlock: 22, g1Blocks: 2, g1Data: 38, g2Blocks: 2, g2Data: 39, alignCenters: [6, 24, 42] },
  { version: 9, ecPerBlock: 22, g1Blocks: 3, g1Data: 36, g2Blocks: 2, g2Data: 37, alignCenters: [6, 26, 46] },
  { version: 10, ecPerBlock: 26, g1Blocks: 4, g1Data: 43, g2Blocks: 1, g2Data: 44, alignCenters: [6, 28, 50] },
  { version: 11, ecPerBlock: 30, g1Blocks: 1, g1Data: 50, g2Blocks: 4, g2Data: 51, alignCenters: [6, 30, 54] },
  { version: 12, ecPerBlock: 22, g1Blocks: 6, g1Data: 36, g2Blocks: 2, g2Data: 37, alignCenters: [6, 32, 58] }
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]!;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

function buildGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const factor = new Uint8Array([1, GF_EXP[i]!]);
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j]!, factor[0]!);
      next[j + 1] ^= gfMul(poly[j]!, factor[1]!);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomon(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = buildGeneratorPoly(ecCount);
  const work = new Uint8Array(data.length + ecCount);
  work.set(data, 0);

  for (let i = 0; i < data.length; i++) {
    const coef = work[i]!;
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        work[i + j] ^= gfMul(gen[j]!, coef);
      }
    }
  }

  return work.slice(data.length);
}

function selectSpecForPayload(byteLen: number): VersionSpec {
  for (const spec of VERSION_SPECS) {
    const countBits = spec.version >= 10 ? 16 : 8;
    const totalDataCodewords = spec.g1Blocks * spec.g1Data + spec.g2Blocks * spec.g2Data;
    const totalDataBits = totalDataCodewords * 8;
    const requiredBits = 4 + countBits + byteLen * 8;
    if (requiredBits <= totalDataBits) {
      return spec;
    }
  }
  throw new Error("QR payload exceeds supported Version 12 capacity.");
}

function encodeCodewords(bytes: Uint8Array, spec: VersionSpec): number[] {
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Mode: Byte (0100)
  pushBits(0b0100, 4);
  pushBits(bytes.length, spec.version >= 10 ? 16 : 8);
  for (const b of bytes) {
    pushBits(b, 8);
  }

  const totalDataCodewords = spec.g1Blocks * spec.g1Data + spec.g2Blocks * spec.g2Data;
  const maxBits = totalDataCodewords * 8;
  const terminatorLen = Math.min(4, maxBits - bits.length);
  pushBits(0, terminatorLen);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataCodewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let b = 0; b < 8; b++) {
      val = (val << 1) | bits[i + b]!;
    }
    dataCodewords.push(val);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataCodewords.length < totalDataCodewords) {
    dataCodewords.push(padBytes[padIdx % 2]!);
    padIdx++;
  }

  // Split into RS blocks & compute EC codewords
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let cursor = 0;

  for (let b = 0; b < spec.g1Blocks; b++) {
    const block = Uint8Array.from(dataCodewords.slice(cursor, cursor + spec.g1Data));
    cursor += spec.g1Data;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomon(block, spec.ecPerBlock));
  }
  for (let b = 0; b < spec.g2Blocks; b++) {
    const block = Uint8Array.from(dataCodewords.slice(cursor, cursor + spec.g2Data));
    cursor += spec.g2Data;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomon(block, spec.ecPerBlock));
  }

  // Interleave data codewords, then EC codewords
  const interleaved: number[] = [];
  const maxDataLen = Math.max(spec.g1Data, spec.g2Data);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) interleaved.push(block[i]!);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const ec of ecBlocks) {
      interleaved.push(ec[i]!);
    }
  }

  // Convert codewords to bit stream
  const resultBits: number[] = [];
  for (const cw of interleaved) {
    for (let bit = 7; bit >= 0; bit--) {
      resultBits.push((cw >>> bit) & 1);
    }
  }
  return resultBits;
}

function getFormatBits(maskPattern: number): number {
  // ECC Level M = 00
  const data = (0b00 << 3) | maskPattern;
  let rem = data << 10;
  const gen = 0x537;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) {
      rem ^= gen << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function getVersionBits(version: number): number {
  let rem = version << 12;
  const gen = 0x1f25;
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) {
      rem ^= gen << (i - 12);
    }
  }
  return (version << 12) | rem;
}

function createFunctionGrid(spec: VersionSpec): {
  size: number;
  modules: Int8Array; // -1 unset, 0 light, 1 dark
  isFunction: Uint8Array;
} {
  const size = spec.version * 4 + 17;
  const modules = new Int8Array(size * size).fill(-1);
  const isFunction = new Uint8Array(size * size);

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    const idx = r * size + c;
    modules[idx] = dark ? 1 : 0;
    isFunction[idx] = 1;
  };

  // Finder patterns + 1-module white separator
  const drawFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunc(r, c, inOuter && (onBorder || inCenter));
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Alignment patterns
  const centers = spec.alignCenters;
  for (const rCenter of centers) {
    for (const cCenter of centers) {
      const overlapsTopLeft = rCenter <= 8 && cCenter <= 8;
      const overlapsTopRight = rCenter <= 8 && cCenter >= size - 8;
      const overlapsBottomLeft = rCenter >= size - 8 && cCenter <= 8;
      if (overlapsTopLeft || overlapsTopRight || overlapsBottomLeft) continue;

      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunc(rCenter + dr, cCenter + dc, dark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setFunc(6, i, dark);
    setFunc(i, 6, dark);
  }

  // Dark module
  setFunc(size - 8, 8, true);

  // Reserve format info cells
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunc(8, size - 1 - i, false);
    if (i < 7) {
      setFunc(size - 1 - i, 8, false);
    }
  }

  // Version info (V7+)
  if (spec.version >= 7) {
    const vBits = getVersionBits(spec.version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  return { size, modules, isFunction };
}

function applyFormatBits(size: number, modules: Int8Array, maskPattern: number): void {
  const fmt = getFormatBits(maskPattern);
  // First copy around top-left finder (MSB bit 14 -> LSB bit 0)
  for (let i = 0; i < 15; i++) {
    const bit = ((fmt >>> i) & 1) === 1 ? 1 : 0;
    if (i < 6) {
      modules[i * size + 8] = bit;
    } else if (i < 8) {
      modules[(i + 1) * size + 8] = bit;
    } else {
      modules[(size - 15 + i) * size + 8] = bit;
    }

    if (i < 8) {
      modules[8 * size + (size - 1 - i)] = bit;
    } else if (i < 9) {
      modules[8 * size + 7] = bit;
    } else {
      modules[8 * size + (14 - i)] = bit;
    }
  }
}

function maskCondition(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function computePenalty(size: number, modules: Int8Array): number {
  let penalty = 0;

  // Rule 1: 5+ consecutive same-color modules in row/col
  for (let r = 0; r < size; r++) {
    let runColor = modules[r * size]!;
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      const cur = modules[r * size + c]!;
      if (cur === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = cur;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = modules[c]!;
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      const cur = modules[r * size + c]!;
      if (cur === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = cur;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r * size + c]!;
      if (
        v === modules[r * size + c + 1] &&
        v === modules[(r + 1) * size + c] &&
        v === modules[(r + 1) * size + c + 1]
      ) {
        penalty += 3;
      }
    }
  }

  // Rule 3: 1:1:3:1:1 pattern with 4 light modules on either side
  const checkPattern = (line: number[]) => {
    for (let i = 0; i <= line.length - 11; i++) {
      const p1 =
        line[i] === 1 &&
        line[i + 1] === 0 &&
        line[i + 2] === 1 &&
        line[i + 3] === 1 &&
        line[i + 4] === 1 &&
        line[i + 5] === 0 &&
        line[i + 6] === 1 &&
        line[i + 7] === 0 &&
        line[i + 8] === 0 &&
        line[i + 9] === 0 &&
        line[i + 10] === 0;
      const p2 =
        line[i] === 0 &&
        line[i + 1] === 0 &&
        line[i + 2] === 0 &&
        line[i + 3] === 0 &&
        line[i + 4] === 1 &&
        line[i + 5] === 0 &&
        line[i + 6] === 1 &&
        line[i + 7] === 1 &&
        line[i + 8] === 1 &&
        line[i + 9] === 0 &&
        line[i + 10] === 1;
      if (p1 || p2) penalty += 40;
    }
  };
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) row.push(modules[r * size + c]!);
    checkPattern(row);
  }
  for (let c = 0; c < size; c++) {
    const col: number[] = [];
    for (let r = 0; r < size; r++) col.push(modules[r * size + c]!);
    checkPattern(col);
  }

  // Rule 4: dark ratio deviation from 50%
  let darkCount = 0;
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 1) darkCount++;
  }
  const percent = (darkCount * 100) / modules.length;
  const k = Math.floor(Math.abs(percent - 50) / 5);
  penalty += k * 10;

  return penalty;
}

export interface QrMatrix {
  size: number;
  modules: boolean[][];
}

export function generateQrMatrix(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const spec = selectSpecForPayload(bytes.length);
  const dataBits = encodeCodewords(bytes, spec);
  const { size, modules: baseModules, isFunction } = createFunctionGrid(spec);

  // Place data bits zig-zag upward/downward from bottom-right
  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // Skip timing column
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const c = right - colOffset;
        const idx = r * size + c;
        if (isFunction[idx]) continue;
        const bit = bitIdx < dataBits.length ? dataBits[bitIdx]! : 0;
        bitIdx++;
        baseModules[idx] = bit;
      }
    }
    upward = !upward;
  }

  // Evaluate all 8 masks and choose lowest penalty
  let bestPenalty = Infinity;
  let bestGrid = baseModules;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = new Int8Array(baseModules);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const idx = r * size + c;
        if (!isFunction[idx] && maskCondition(mask, r, c)) {
          candidate[idx] = candidate[idx] === 1 ? 0 : 1;
        }
      }
    }
    applyFormatBits(size, candidate, mask);
    const penalty = computePenalty(size, candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestGrid = candidate;
    }
  }

  const grid: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(bestGrid[r * size + c] === 1);
    }
    grid.push(row);
  }

  return { size, modules: grid };
}
