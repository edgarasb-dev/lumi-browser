import { useState } from "react";
import { Pause, Play, RotateCcw, Shield, ShieldOff, X } from "lucide-react";
import { PortalComponent } from "@/components/portal/portal";
import { useFocusMode } from "@/components/providers/focus-mode-provider";
import { cn } from "@/lib/utils";

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function FocusTimerPill() {
  const {
    isZenMode,
    setZenMode,
    phase,
    timerRunning,
    remainingSeconds,
    toggleTimer,
    resetTimer,
    blockDistractions,
    setBlockDistractions
  } = useFocusMode();
  const [expanded, setExpanded] = useState(false);

  const defaultSeconds = phase === "break" ? 5 * 60 : 25 * 60;
  const visible = isZenMode || timerRunning;
  const showReset = expanded || timerRunning || remainingSeconds !== defaultSeconds;

  const pillWidth = (isZenMode ? 248 : 168) + (showReset ? 30 : 0);

  return (
    <PortalComponent
      visible={visible}
      layerType="focusTimerPill"
      className="fixed bottom-4 right-4"
      style={{ width: pillWidth, height: 38 }}
    >
      <div className="dark flex h-full w-full items-center justify-between gap-1.5 rounded-full border border-white/18 bg-zinc-950/90 px-2.5 py-1 text-xs text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl select-none">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition hover:bg-white/10"
          title="Focus Pomodoro Timer"
        >
          <span
            className={cn(
              "size-2 rounded-full shrink-0",
              phase === "break" ? "bg-emerald-400" : timerRunning ? "animate-pulse bg-blue-400" : "bg-slate-400"
            )}
          />
          <span className="text-[11px] font-medium text-white/75">{phase === "break" ? "Break" : "Focus"}</span>
          <span className="font-mono text-xs font-semibold tabular-nums text-white">
            {formatClock(remainingSeconds)}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={toggleTimer}
            className="flex size-6 items-center justify-center rounded-full bg-white/12 transition hover:bg-white/22"
            title={timerRunning ? "Pause timer" : "Start focus timer"}
          >
            {timerRunning ? <Pause className="size-3" /> : <Play className="size-3 translate-x-[0.5px]" />}
          </button>

          {showReset && (
            <button
              type="button"
              onClick={() => resetTimer("focus")}
              className="flex size-6 items-center justify-center rounded-full text-white/70 transition hover:bg-white/12 hover:text-white"
              title="Reset Pomodoro timer"
            >
              <RotateCcw className="size-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setBlockDistractions(!blockDistractions)}
            className={cn(
              "flex size-6 items-center justify-center rounded-full transition",
              blockDistractions
                ? "bg-blue-500/35 text-blue-300 ring-1 ring-blue-400/50"
                : "text-white/60 hover:bg-white/12 hover:text-white"
            )}
            title={blockDistractions ? "Focus Distraction Shield ON" : "Block distraction sites during Focus"}
          >
            {blockDistractions ? <Shield className="size-3" /> : <ShieldOff className="size-3" />}
          </button>

          {isZenMode && (
            <button
              type="button"
              onClick={() => setZenMode(false)}
              className="ml-0.5 flex items-center gap-1 rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-medium text-white/90 transition hover:bg-white/22"
              title="Exit Zen Mode (Cmd+Shift+Z)"
            >
              <X className="size-3" />
              Zen
            </button>
          )}
        </div>
      </div>
    </PortalComponent>
  );
}
