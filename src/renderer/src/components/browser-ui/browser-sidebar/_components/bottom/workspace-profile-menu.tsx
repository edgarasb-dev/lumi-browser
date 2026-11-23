import { BubbleEvent } from "@/components/logic/bubble-event";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { useSidePanel } from "@/components/providers/side-panel-provider";
import { useSpaces } from "@/components/providers/spaces-provider";
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  BookmarkCheck,
  CameraIcon,
  DownloadIcon,
  FocusIcon,
  HistoryIcon,
  KeyRound,
  type LucideIcon,
  NotebookPen,
  OrbitIcon,
  PanelRightIcon,
  RotateCcw,
  SettingsIcon,
  SparklesIcon,
  StarIcon,
  UserIcon
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Favourite } from "~/lumi/interfaces/browser/favourites";
import type { Profile } from "~/lumi/interfaces/sessions/profiles";
import { RecentlyClosedPopover } from "../recently-closed-popover";
import { SpaceScratchpad } from "../space-scratchpad";

function WorkspaceMenuItem({
  id,
  Icon,
  label,
  target,
  active = false,
  onItemSelected
}: {
  id: string;
  Icon: LucideIcon;
  label: string;
  target: string;
  active?: boolean;
  onItemSelected: (target: string) => void;
}) {
  return (
    <CommandItem value={id} onSelect={() => onItemSelected(target)} className="text-black dark:text-white">
      <Icon className="size-4 text-black/80 dark:text-white/85 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {active && <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />}
    </CommandItem>
  );
}

function getProfileMonogram(name?: string | null): string {
  const cleaned = (name ?? "").trim();
  if (!cleaned) return "L";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function WorkspaceProfileMenu({ className }: { className?: string } = {}) {
  const [open, setOpen] = useState(false);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usingProfileId, setUsingProfileId] = useState<string | null>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  const { currentSpace, isCurrentSpaceLight } = useSpaces();
  const { isOpen: sidePanelOpen } = useSidePanel();

  useEffect(() => {
    const onCloseOtherPopovers = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "profile") {
        setOpen(false);
      }
    };
    window.addEventListener("lumi:close-footer-popovers", onCloseOtherPopovers);
    return () => window.removeEventListener("lumi:close-footer-popovers", onCloseOtherPopovers);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      window.dispatchEvent(new CustomEvent("lumi:close-footer-popovers", { detail: "profile" }));
    }
    setOpen(nextOpen);
  };

  useEffect(() => {
    let cancelled = false;
    const loadProfiles = () => {
      Promise.all([lumi.profiles.getProfiles(), lumi.profiles.getUsingProfile()])
        .then(([loadedProfiles, activeId]) => {
          if (cancelled) return;
          setProfiles(loadedProfiles);
          setUsingProfileId(activeId);
        })
        .catch(() => {});
    };

    loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [currentSpace?.profileId]);

  useEffect(() => {
    if (!open) return;
    lumi.favourites
      .getAllFavourites()
      .then(setFavourites)
      .catch(() => {});
  }, [open]);

  const activeProfile = useMemo(() => {
    const targetId = currentSpace?.profileId ?? usingProfileId;
    return profiles.find((p) => p.id === targetId) ?? profiles.find((p) => !p.internal) ?? null;
  }, [currentSpace?.profileId, profiles, usingProfileId]);

  const monogram = useMemo(
    () => getProfileMonogram(activeProfile?.name ?? currentSpace?.name),
    [activeProfile?.name, currentSpace?.name]
  );

  const onItemSelected = (target: string) => {
    setOpen(false);

    if (target === "internal://settings") {
      lumi.windows.openSettings();
      return;
    }
    if (target.startsWith("internal://settings:")) {
      const section = target.slice("internal://settings:".length);
      lumi.windows.openSettings(section);
      return;
    }
    if (target === "action:open_scratchpad") {
      setScratchpadOpen(true);
      return;
    }
    if (target.startsWith("action:")) {
      const action = target.slice("action:".length);
      window.dispatchEvent(new CustomEvent("lumi:workspace-action", { detail: action }));
      return;
    }

    lumi.tabs.newTab(target, true);
  };

  const spaceInjectedClasses = cn(isCurrentSpaceLight ? "" : "dark");
  const avatarGradient =
    currentSpace?.bgStartColor && currentSpace?.bgEndColor
      ? `linear-gradient(135deg, ${currentSpace.bgStartColor}, ${currentSpace.bgEndColor})`
      : undefined;

  return (
    <div className={cn("relative flex items-center shrink-0", className)}>
      <SpaceScratchpad hideTrigger open={scratchpadOpen} onOpenChange={setScratchpadOpen} side="top" align="end" />
      <RecentlyClosedPopover hideTrigger open={recentOpen} onOpenChange={setRecentOpen} side="top" align="end" />

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={
            activeProfile ? `${activeProfile.name} — Workspace & Profile Menu` : "Workspace Tools, Pages & Profile"
          }
          className={cn(
            "relative size-7 rounded-full shrink-0 inline-flex items-center justify-center cursor-pointer select-none",
            "text-[10.5px] font-semibold tracking-tight transition-all duration-150 active:scale-[0.95]",
            "border border-black/10 dark:border-white/15 shadow-xs",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/25",
            open
              ? "ring-2 ring-black/20 dark:ring-white/25 brightness-110"
              : "hover:brightness-110 opacity-90 hover:opacity-100"
          )}
          style={avatarGradient ? { backgroundImage: avatarGradient } : undefined}
        >
          <span
            className={cn(
              "flex size-full items-center justify-center rounded-full text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]",
              !avatarGradient && "bg-black/20 dark:bg-white/20 text-black dark:text-white"
            )}
          >
            {monogram}
          </span>
        </PopoverTrigger>

        <PopoverContent
          variant="translucent"
          side="top"
          align="end"
          sideOffset={8}
          className="w-60 p-2 select-none"
          positionerClassName={spaceInjectedClasses}
        >
          {activeProfile && (
            <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-black/[0.04] px-2.5 py-1.5 dark:bg-white/[0.06]">
              <div className="flex min-w-0 items-center gap-2">
                <UserIcon className="size-3.5 shrink-0 text-black/65 dark:text-white/70" />
                <span className="truncate text-xs font-medium text-black dark:text-white">{activeProfile.name}</span>
              </div>
              <button
                type="button"
                onClick={() => onItemSelected("internal://settings:profiles")}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-black/65 hover:bg-black/[0.06] hover:text-black dark:text-white/70 dark:hover:bg-white/[0.1] dark:hover:text-white cursor-pointer"
              >
                Manage
              </button>
            </div>
          )}

          <Command ref={commandRef} loop>
            <BubbleEvent targetRef={commandRef} eventType="keydown" />
            <CommandList className="max-h-[420px]">
              <WorkspaceMenuItem
                id="side-panel"
                Icon={PanelRightIcon}
                label="Split Side Panel"
                target="action:toggle_side_panel"
                active={sidePanelOpen}
                onItemSelected={onItemSelected}
              />
              <WorkspaceMenuItem
                id="scratchpad"
                Icon={NotebookPen}
                label="Space Scratchpad"
                target="action:open_scratchpad"
                onItemSelected={onItemSelected}
              />
              <WorkspaceMenuItem
                id="recently-closed"
                Icon={RotateCcw}
                label="Recently Closed Tabs"
                target="action:recently_closed"
                onItemSelected={onItemSelected}
              />
              <WorkspaceMenuItem
                id="snapshots"
                Icon={BookmarkCheck}
                label="Workspace Snapshots"
                target="action:save_snapshot"
                onItemSelected={onItemSelected}
              />
              <WorkspaceMenuItem
                id="zen-mode"
                Icon={FocusIcon}
                label="Focus / Zen Mode"
                target="action:toggle_zen_mode"
                onItemSelected={onItemSelected}
              />
              <WorkspaceMenuItem
                id="capture-page"
                Icon={CameraIcon}
                label="Capture Screenshot"
                target="action:capture_region"
                onItemSelected={onItemSelected}
              />
              <CommandSeparator />
              <WorkspaceMenuItem
                id="history"
                Icon={HistoryIcon}
                label="History"
                target="lumi://history"
                onItemSelected={onItemSelected}
              />
              <WorkspaceMenuItem
                id="downloads"
                Icon={DownloadIcon}
                label="Downloads"
                target="lumi://downloads"
                onItemSelected={onItemSelected}
              />
              <WorkspaceMenuItem
                id="passwords"
                Icon={KeyRound}
                label="Passwords"
                target="lumi://passwords"
                onItemSelected={onItemSelected}
              />
              <WorkspaceMenuItem
                id="bangs"
                Icon={SparklesIcon}
                label="Search Bangs"
                target="lumi://bangs"
                onItemSelected={onItemSelected}
              />
              <WorkspaceMenuItem
                id="spaces"
                Icon={OrbitIcon}
                label="Manage Spaces"
                target="internal://settings:spaces"
                onItemSelected={onItemSelected}
              />
              <WorkspaceMenuItem
                id="settings"
                Icon={SettingsIcon}
                label="Settings"
                target="internal://settings"
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
    </div>
  );
}
