import { BubbleEvent } from "@/components/logic/bubble-event";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { useSpaces } from "@/components/providers/spaces-provider";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  ArchiveIcon,
  CameraIcon,
  DownloadIcon,
  FocusIcon,
  HistoryIcon,
  LucideIcon,
  PanelRightIcon,
  SettingsIcon,
  SparklesIcon,
  StarIcon
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Favourite } from "~/lumi/interfaces/browser/favourites";
import { DOCK_BUTTON_CLASSES, type DockButtonSize } from "./dock-button-sizes";

function BottomExtrasMenuItem({
  id,
  Icon,
  label,
  url,
  onItemSelected
}: {
  id: string;
  Icon: LucideIcon;
  label: string;
  url: string;
  onItemSelected: (url: string) => void;
}) {
  return (
    <CommandItem value={id} onSelect={() => onItemSelected(url)} className="text-black dark:text-white">
      <Icon className="size-4 text-black dark:text-white" />
      {label}
    </CommandItem>
  );
}

export function BottomExtrasMenu({ size = "default" }: { size?: DockButtonSize } = {}) {
  const [open, setOpen] = useState(false);
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const commandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      lumi.favourites.getAllFavourites().then(setFavourites);
    }
  }, [open]);

  const onItemSelected = useCallback((url: string) => {
    if (url === "internal://settings") {
      lumi.windows.openSettings();
    } else if (url.startsWith("action:")) {
      const action = url.slice("action:".length);
      window.dispatchEvent(new CustomEvent("lumi:workspace-action", { detail: action }));
    } else {
      lumi.tabs.newTab(url, true);
    }
    setOpen(false);
  }, []);

  const { isCurrentSpaceLight } = useSpaces();
  const spaceInjectedClasses = cn(isCurrentSpaceLight ? "" : "dark");
  const sizeClasses = DOCK_BUTTON_CLASSES[size];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Button
        size="icon"
        className={cn(sizeClasses.button, "bg-transparent hover:bg-black/10 dark:hover:bg-white/10")}
        asChild
      >
        <PopoverTrigger nativeButton={true}>
          <ArchiveIcon strokeWidth={2} className={cn(sizeClasses.icon, "text-black/80 dark:text-white/80")} />
        </PopoverTrigger>
      </Button>
      <PopoverContent className={cn("w-56 p-2 select-none")} positionerClassName={spaceInjectedClasses}>
        <Command ref={commandRef} loop>
          <BubbleEvent targetRef={commandRef} eventType="keydown" />
          <CommandList>
            <BottomExtrasMenuItem
              id="zen-mode"
              Icon={FocusIcon}
              label="Focus / Zen Mode"
              url="action:toggle_zen_mode"
              onItemSelected={onItemSelected}
            />
            <BottomExtrasMenuItem
              id="side-panel"
              Icon={PanelRightIcon}
              label="Split Side Panel"
              url="action:toggle_side_panel"
              onItemSelected={onItemSelected}
            />
            <BottomExtrasMenuItem
              id="capture-page"
              Icon={CameraIcon}
              label="Capture Screenshot"
              url="action:capture_region"
              onItemSelected={onItemSelected}
            />
            <CommandSeparator />
            <BottomExtrasMenuItem
              id="history"
              Icon={HistoryIcon}
              label="History"
              url="lumi://history"
              onItemSelected={onItemSelected}
            />
            <BottomExtrasMenuItem
              id="downloads"
              Icon={DownloadIcon}
              label="Downloads"
              url="lumi://downloads"
              onItemSelected={onItemSelected}
            />
            <BottomExtrasMenuItem
              id="bangs"
              Icon={SparklesIcon}
              label="Search Bangs"
              url="lumi://bangs"
              onItemSelected={onItemSelected}
            />
            <BottomExtrasMenuItem
              id="settings"
              Icon={SettingsIcon}
              label="Settings"
              url="internal://settings"
              onItemSelected={onItemSelected}
            />
            {favourites.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Favourites">
                  {favourites.slice(0, 8).map((fav) => (
                    <CommandItem
                      key={fav.id}
                      value={fav.url}
                      onSelect={() => onItemSelected(fav.url)}
                      className="text-black dark:text-white flex items-center gap-2"
                    >
                      <StarIcon className="size-3.5 text-amber-500 fill-amber-400 shrink-0" />
                      <span className="truncate flex-1 text-xs">{fav.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
