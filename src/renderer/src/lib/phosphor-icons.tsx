import type { IconEntry } from "@phosphor-icons/core";
import type { IconProps } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ComponentProps, CSSProperties } from "react";

type IconId = string;

let metadataPromise: Promise<IconEntry[]> | null = null;

/**
 * Lazily loads the Phosphor icon catalog metadata only when an icon picker is opened,
 * keeping `@phosphor-icons/core` metadata and `@phosphor-icons/react` components
 * completely out of the main browser window bundles.
 */
export function loadPhosphorIconsMetadata(): Promise<IconEntry[]> {
  if (!metadataPromise) {
    metadataPromise = import("@phosphor-icons/core").then((mod) => mod.icons as unknown as IconEntry[]);
  }
  return metadataPromise;
}

function toKebabCase(pascalName: string): string {
  return pascalName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

const INLINE_DUOTONE_PATHS: Record<string, { bg: string; fg: string }> = {
  DotOutline: {
    bg: "M152,128a24,24,0,1,1-24-24A24,24,0,0,1,152,128Z",
    fg: "M128,96a32,32,0,1,0,32,32A32,32,0,0,0,128,96Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,128,144Z"
  },
  Globe: {
    bg: "M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z",
    fg: "M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"
  }
};

/**
 * Renders a Phosphor duotone icon via inline SVG for core defaults and CSS-masked
 * `lumi-internal://phosphor/<name>` assets on demand, avoiding multi-megabyte bundles.
 */
export function PhosphorIcon({
  id,
  fallbackId,
  className,
  style,
  size,
  color,
  mirrored,
  alt
}: { id: IconId | (string & Record<never, never>); fallbackId?: string } & IconProps) {
  const resolvedId = id || fallbackId || "DotOutline";
  const inlinePaths = INLINE_DUOTONE_PATHS[resolvedId];

  const baseStyle: CSSProperties = {
    ...(size !== undefined ? { width: size, height: size } : {}),
    ...(color ? { color } : {}),
    ...(mirrored ? { transform: "scaleX(-1)" } : {}),
    ...style
  };

  if (inlinePaths) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        fill="currentColor"
        aria-hidden={alt ? undefined : true}
        aria-label={alt}
        className={cn("inline-block shrink-0", className)}
        style={baseStyle}
      >
        <path d={inlinePaths.bg} opacity="0.2" />
        <path d={inlinePaths.fg} />
      </svg>
    );
  }

  const protocol = typeof window !== "undefined" && window.location.protocol === "lumi:" ? "lumi:" : "lumi-internal:";
  const maskUrl = `url("${protocol}//phosphor/${toKebabCase(resolvedId)}")`;

  return (
    <span
      role="img"
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        ...baseStyle,
        WebkitMaskImage: maskUrl,
        maskImage: maskUrl,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain"
      }}
    />
  );
}

export function SpaceIcon({ ...props }: ComponentProps<typeof PhosphorIcon>) {
  return <PhosphorIcon fallbackId="DotOutline" weight="duotone" {...props} />;
}
