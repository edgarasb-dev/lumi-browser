import { useState } from "react";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useToast } from "@/components/providers/minimal-toast-provider";
import { cn } from "@/lib/utils";

interface TidyButtonProps {
  spaceId: string;
  disabled?: boolean;
}

export function TidyButton({ spaceId, disabled = false }: TidyButtonProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const { showToast } = useToast();

  const handleTidy = async () => {
    if (isRunning || disabled) return;
    setIsRunning(true);
    try {
      const result = await lumi.tabs.tidySpace(spaceId);
      showToast("tidyApplied", result.summary, result.undoId);
    } catch (err) {
      console.error("[TidyButton] Failed to tidy space:", err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-1 pt-0.5 pb-1 select-none">
      <div className="h-px flex-1 bg-black/[0.08] dark:bg-white/[0.1]" />
      <motion.button
        type="button"
        onClick={() => void handleTidy()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        animate={{ scale: isPressed ? 0.94 : 1 }}
        transition={{ type: "spring", stiffness: 550, damping: 24 }}
        disabled={disabled || isRunning}
        title="Tidy loose tabs into folders & remove duplicates"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
          "text-black/45 dark:text-white/45 hover:text-black/80 dark:hover:text-white/85",
          "hover:bg-black/[0.06] dark:hover:bg-white/[0.08]",
          "disabled:opacity-35 disabled:pointer-events-none"
        )}
      >
        <motion.span
          animate={{
            rotate: isRunning ? 180 : isHovered ? 18 : 0,
            scale: isRunning ? 1.15 : isHovered ? 1.1 : 1
          }}
          transition={{ type: "spring", stiffness: 420, damping: 20 }}
          className="inline-flex items-center justify-center"
        >
          <Sparkles className={cn("size-3", isRunning && "animate-pulse text-primary")} />
        </motion.span>
        <span>Tidy</span>
      </motion.button>
    </div>
  );
}
