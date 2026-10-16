import { Space } from "~/lumi/interfaces/sessions/spaces";
import { SpaceIcon } from "@/lib/phosphor-icons";
import { cn } from "@/lib/utils";
import { Palette } from "lucide-react";
import { SpaceThemePopover } from "./space-theme-popover";

export function SpaceTitle({ space }: { space: Space | null }) {
  if (!space) return null;

  return (
    <div className={cn("group flex flex-row gap-1.5 items-center justify-between", "w-full h-6", "px-2 mt-1.5 py-1")}>
      <div className="flex flex-row gap-1.5 items-center min-w-0 flex-1">
        <SpaceIcon
          fallbackId={undefined}
          id={space.icon}
          strokeWidth={2.5}
          className="space-icon-color dark:text-white! size-4.5 shrink-0"
        />
        <span className="font-bold text-black/50 dark:text-white/50 h-5 leading-5 text-sm truncate">{space.name}</span>
      </div>

      <SpaceThemePopover space={space}>
        <button
          className={cn(
            "size-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100",
            "text-black/40 hover:text-black/80 dark:text-white/40 dark:hover:text-white/80",
            "hover:bg-black/10 dark:hover:bg-white/10 transition-all"
          )}
          title="Customize Space Theme & Colors"
        >
          <Palette className="size-3.5" />
        </button>
      </SpaceThemePopover>
    </div>
  );
}
