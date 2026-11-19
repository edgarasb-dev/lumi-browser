import { useMemo } from "react";
import { generateQrMatrix } from "@/lib/qr-code";

interface QrCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCodeSvg({ value, size = 172, className }: QrCodeSvgProps) {
  const pathData = useMemo(() => {
    try {
      const { size: matrixSize, modules } = generateQrMatrix(value);
      const quietZone = 3;
      const total = matrixSize + quietZone * 2;
      const parts: string[] = [];

      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (modules[r]?.[c]) {
            parts.push(`M${c + quietZone},${r + quietZone}h1v1h-1z`);
          }
        }
      }

      return { total, d: parts.join("") };
    } catch {
      return null;
    }
  }, [value]);

  if (!pathData) {
    return <div className={className} style={{ width: size, height: size }} aria-label="QR code unavailable" />;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${pathData.total} ${pathData.total}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label="Companion pairing QR code"
    >
      <rect width={pathData.total} height={pathData.total} fill="#ffffff" rx="1.5" />
      <path d={pathData.d} fill="#0b1020" />
    </svg>
  );
}
