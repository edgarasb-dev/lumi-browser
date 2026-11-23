import { useMemo, useRef } from "react";

export type PinGridDensity = "comfortable" | "balanced" | "compact";

/** Maximum number of columns the grid supports (must match GRID_COL_CLASSES length). */
const MAX_COLS = 6;
/** Default column count before the first measurement. */
const DEFAULT_COLS = 3;

const GRID_COL_CLASSES = [
  "grid-cols-1",
  "grid-cols-2",
  "grid-cols-3",
  "grid-cols-4",
  "grid-cols-5",
  "grid-cols-6"
] as const;

const DENSITY_CONFIG: Record<PinGridDensity, { minTileWidth: number; gapPx: number }> = {
  comfortable: { minTileWidth: 52, gapPx: 8 },
  balanced: { minTileWidth: 46, gapPx: 6 },
  compact: { minTileWidth: 38, gapPx: 6 }
};

export function getPinGridDensity(pinCount: number): PinGridDensity {
  if (pinCount <= 3) return "comfortable";
  if (pinCount <= 6) return "balanced";
  return "compact";
}

/**
 * Calculates responsive column count and tile density fluidly from pinCount and measured width.
 */
export function usePinGridColumns(containerWidth: number, pinCount: number) {
  const colsRef = useRef(DEFAULT_COLS);
  const density = getPinGridDensity(pinCount);
  const { minTileWidth, gapPx } = DENSITY_CONFIG[density];

  const measuredCols = useMemo(() => {
    if (containerWidth > 0) {
      return Math.max(1, Math.floor((containerWidth + gapPx) / (minTileWidth + gapPx)));
    }
    return density === "compact" ? 4 : DEFAULT_COLS;
  }, [containerWidth, gapPx, minTileWidth, density]);

  const effectiveCols = Math.max(1, Math.min(measuredCols, Math.max(1, pinCount), MAX_COLS));
  colsRef.current = effectiveCols;
  const gridColumnClass = GRID_COL_CLASSES[effectiveCols - 1] ?? "grid-cols-1";

  return { cols: effectiveCols, colsRef, gridColumnClass, density } as const;
}
