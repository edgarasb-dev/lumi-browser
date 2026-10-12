import type { ComponentType, CSSProperties } from "react";

export interface IconProps {
  color?: string;
  size?: string | number;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  mirrored?: boolean;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  onClick?: React.MouseEventHandler<SVGSVGElement>;
  [key: string]: unknown;
}

export type Icon = ComponentType<IconProps>;
export type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

declare const icon: Icon;
export default icon;

// Named re-exports used by phosphor-icons.tsx
export declare const IconContext: ComponentType<{ children?: React.ReactNode; value?: Partial<IconProps> }>;
export declare const IconBase: Icon;
export declare const DotOutline: Icon;

// Wildcard fallback: all named exports are Icon components
declare const _default: Record<string, Icon | undefined>;
export = _default;
