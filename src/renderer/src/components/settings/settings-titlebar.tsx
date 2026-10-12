"use client";

import { WindowControls } from "@/components/window-controls";
import { usePlatform } from "@/components/main/platform";

export function SettingsTitlebar() {
  const { platform } = usePlatform();

  return (
    <div className="relative w-full h-11 border-b border-border/40 bg-card/60 backdrop-blur-xl px-4 flex items-center justify-between select-none app-drag shrink-0 z-20">
      <div className="flex items-center gap-2.5">
        {platform === "darwin" && <div className="w-14 h-full" />}
        <div className="flex items-center gap-2">
          <img src="/assets/logo.svg" alt="Lumi" className="size-5 rounded-md object-contain shrink-0" />
          <span className="font-semibold text-sm tracking-tight text-foreground">Lumi</span>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md border border-border/40">
            Settings
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 remove-app-drag">
        <WindowControls />
      </div>
    </div>
  );
}
