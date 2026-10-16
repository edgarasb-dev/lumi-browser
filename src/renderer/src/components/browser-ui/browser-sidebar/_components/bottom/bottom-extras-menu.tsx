import { BubbleEvent } from "@/components/logic/bubble-event";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { useSpaces } from "@/components/providers/spaces-provider";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ArchiveIcon, HistoryIcon, LucideIcon, SettingsIcon, StarIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Favourite } from "~/lumi/interfaces/browser/favourites";

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

export function BottomExtrasMenu() {
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
      lumi.windows.openSettingsWindow();
    } else {
      lumi.tabs.newTab(url, true);
    }
    setOpen(false);
  }, []);

  const { isCurrentSpaceLight } = useSpaces();
  const spaceInjectedClasses = cn(isCurrentSpaceLight ? "" : "dark");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Button size="icon" className="size-8 bg-transparent hover:bg-black/10 dark:hover:bg-white/10" asChild>
        <PopoverTrigger nativeButton={true}>
          <ArchiveIcon strokeWidth={2} className="w-4 h-4 text-black/80 dark:text-white/80" />
        </PopoverTrigger>
      </Button>
      <PopoverContent className={cn("w-56 p-2 select-none")} positionerClassName={spaceInjectedClasses}>
        <Command ref={commandRef} loop>
          <BubbleEvent targetRef={commandRef} eventType="keydown" />
          <CommandList>
            <BottomExtrasMenuItem
              id="history"
              Icon={HistoryIcon}
              label="History"
              url="lumi://history"
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
