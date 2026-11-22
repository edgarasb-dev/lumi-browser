import { memo, useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusedTab } from "@/components/providers/tabs-provider";
import { useToast } from "@/components/providers/minimal-toast-provider";

export const ReaderButton = memo(function ReaderButton() {
  const focusedTab = useFocusedTab();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const isEligible =
    Boolean(focusedTab) &&
    !focusedTab!.asleep &&
    (focusedTab!.url.startsWith("http://") || focusedTab!.url.startsWith("https://"));
  const isActive = Boolean(focusedTab?.readerMode);

  const handleToggle = useCallback(async () => {
    if (!focusedTab || !isEligible || isLoading) return;
    setIsLoading(true);
    try {
      const state = await lumi.reader.toggle(focusedTab.id);
      if (state.error) {
        showToast("readerUnavailable");
      }
    } finally {
      setIsLoading(false);
    }
  }, [focusedTab, isEligible, isLoading, showToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === "KeyR") {
        e.preventDefault();
        void handleToggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggle]);

  if (!isEligible) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void handleToggle();
      }}
      className={cn(
        "size-6 flex items-center justify-center rounded-md shrink-0 transition-colors cursor-pointer",
        isActive
          ? "text-sky-600 dark:text-sky-400 bg-sky-500/15 hover:bg-sky-500/25"
          : "text-black/45 dark:text-white/45 group-hover/address:text-black/65 dark:group-hover/address:text-white/65 hover:text-black/80 dark:hover:text-white/85 hover:bg-black/10 dark:hover:bg-white/10"
      )}
      title={isActive ? "Exit Reader Mode (Cmd+Option+R)" : "Enter Reader Mode (Cmd+Option+R)"}
    >
      {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <BookOpen className="size-3.5" />}
    </button>
  );
});
