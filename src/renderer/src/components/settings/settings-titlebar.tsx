import { WindowControls } from "@/components/window-controls";
import { usePlatform } from "@/components/main/platform";
import type { ReactNode } from "react";

interface SettingsTitlebarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function SettingsTitlebar({ title, subtitle, actions }: SettingsTitlebarProps) {
  const { platform } = usePlatform();

  return (
    <header className="w-full h-11 border-b border-black/[0.06] dark:border-white/[0.07] bg-white/30 dark:bg-white/[0.02] backdrop-blur-xl px-6 flex items-center justify-between select-none app-drag shrink-0 z-20">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[13px] font-semibold tracking-tight text-foreground truncate">{title}</span>
        {subtitle && <span className="hidden sm:inline text-xs text-muted-foreground truncate">/ {subtitle}</span>}
      </div>

      <div className="ml-auto flex items-center gap-2 remove-app-drag">
        {actions}
        {platform !== "darwin" && <WindowControls />}
      </div>
    </header>
  );
}
