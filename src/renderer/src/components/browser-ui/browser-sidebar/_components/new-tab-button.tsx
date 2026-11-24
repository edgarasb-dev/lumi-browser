import { motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M13.5 4a1.5 1.5 0 0 0-3 0v6.5H4a1.5 1.5 0 0 0 0 3h6.5V20a1.5 1.5 0 0 0 3 0v-6.5H20a1.5 1.5 0 0 0 0-3h-6.5V4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function NewTabButton() {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleNewTab = () => {
    lumi.newTab.open();
  };

  return (
    <motion.button
      onClick={handleNewTab}
      // motion's whileTap does not work in a different document,
      // so we have to use our own state.
      onMouseEnter={() => setIsHovered(true)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      animate={{ scale: isPressed ? 0.985 : 1 }}
      transition={{ scale: { type: "spring", stiffness: 600, damping: 24 } }}
      className={cn(
        "lumi-glass-sheen flex items-center gap-2 px-2 py-1.5 h-9 rounded-lg w-full cursor-pointer",
        "bg-transparent hover:bg-black/10 dark:hover:bg-white/10 transition-colors duration-150",
        "text-black/50 hover:text-black/75 dark:text-white/50 dark:hover:text-white/80"
      )}
    >
      <motion.span
        animate={{
          rotate: isPressed || isHovered ? 90 : 0,
          scale: isPressed ? 0.9 : isHovered ? 1.08 : 1
        }}
        transition={{ type: "spring", stiffness: 460, damping: 24 }}
        className="flex items-center justify-center"
      >
        <PlusIcon className="size-4" />
      </motion.span>
      <span className="font-medium text-sm">New Tab</span>
    </motion.button>
  );
}
