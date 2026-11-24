import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const BAR_CONFIGS: Array<{ duration: string; delay: string; idleHeight: string }> = [
  { duration: "0.78s", delay: "0ms", idleHeight: "h-1.5" },
  { duration: "0.62s", delay: "160ms", idleHeight: "h-2.5" },
  { duration: "0.88s", delay: "90ms", idleHeight: "h-2" }
];

interface AudioVisualizerBarsProps {
  active: boolean;
  muted?: boolean;
  className?: string;
  barClassName?: string;
}

/**
 * Compact 3-bar audio equalizer that animates while media is playing and rests when paused or muted.
 */
export function AudioVisualizerBars({ active, muted = false, className, barClassName }: AudioVisualizerBarsProps) {
  const isAnimating = active && !muted;

  return (
    <span aria-hidden="true" className={cn("inline-flex items-end gap-[1.5px] h-3 shrink-0", className)}>
      {BAR_CONFIGS.map((bar, index) => (
        <span
          key={index}
          style={
            isAnimating
              ? ({
                  "--eq-duration": bar.duration,
                  "--eq-delay": bar.delay
                } as CSSProperties)
              : undefined
          }
          className={cn(
            "w-[2px] rounded-full transition-[height,opacity,background-color] duration-200",
            isAnimating
              ? cn("h-3 lumi-eq-bar bg-primary dark:bg-sky-400")
              : cn(bar.idleHeight, "opacity-45 bg-current"),
            barClassName
          )}
        />
      ))}
    </span>
  );
}
