import { ChevronRight } from "lucide-react";
import type { Space } from "~/lumi/interfaces/sessions/spaces";
import { SpaceIcon } from "@/lib/phosphor-icons";

interface SpaceCardProps {
  space: Space;
  activateEdit: () => void;
}

export function SpaceCard({ space, activateEdit }: SpaceCardProps) {
  return (
    <button
      type="button"
      onClick={activateEdit}
      className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer text-left group"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ring-1 ring-black/10 dark:ring-white/15"
          style={{
            background:
              space.bgStartColor && space.bgEndColor
                ? `linear-gradient(135deg, ${space.bgStartColor}, ${space.bgEndColor})`
                : "var(--muted)"
          }}
        >
          <SpaceIcon id={space.icon} className="size-5 text-white drop-shadow-xs" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-foreground truncate">{space.name}</div>
          <div className="text-[11px] font-mono text-muted-foreground truncate">{space.id}</div>
        </div>
      </div>

      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors shrink-0">
        Customize
        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
