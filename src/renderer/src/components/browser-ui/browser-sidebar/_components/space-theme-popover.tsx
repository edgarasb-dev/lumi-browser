import { useState, useCallback, useMemo, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { Space } from "~/lumi/interfaces/sessions/spaces";
import { SpaceIcon } from "@/lib/phosphor-icons";
import { cn } from "@/lib/utils";
import { Palette, Shuffle, Check, Sparkles } from "lucide-react";

export const SPACE_THEME_PRESETS = [
  { name: "Sunset Flame", start: "#FF512F", end: "#DD2476" },
  { name: "Aurora Emerald", start: "#10B981", end: "#059669" },
  { name: "Deep Ocean", start: "#06B6D4", end: "#3B82F6" },
  { name: "Electric Violet", start: "#8B5CF6", end: "#EC4899" },
  { name: "Midnight Indigo", start: "#312E81", end: "#4F46E5" },
  { name: "Solar Amber", start: "#F59E0B", end: "#EF4444" },
  { name: "Mint Forest", start: "#059669", end: "#064E3B" },
  { name: "Cyberpunk", start: "#F43F5E", end: "#8B5CF6" },
  { name: "Slate Minimal", start: "#334155", end: "#0F172A" },
  { name: "Pure Monochrome", start: "#27272A", end: "#09090B" }
];

export const SPACE_ICON_OPTIONS = [
  "House",
  "Briefcase",
  "Code",
  "Sparkle",
  "Compass",
  "Heart",
  "Bookmark",
  "BookOpen",
  "GraduationCap",
  "MusicNotes",
  "GameController",
  "Globe",
  "Folder",
  "Palette",
  "Coffee",
  "ShoppingBag"
];

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

interface SpaceThemePopoverProps {
  space: Space;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SpaceThemePopover({
  space,
  children,
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: SpaceThemePopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setIsOpen = setControlledOpen !== undefined ? setControlledOpen : setUncontrolledOpen;

  const [name, setName] = useState(space.name);
  const [bgStartColor, setBgStartColor] = useState(space.bgStartColor || "#10B981");
  const [bgEndColor, setBgEndColor] = useState(space.bgEndColor || "#059669");
  const [selectedIcon, setSelectedIcon] = useState(space.icon || "House");

  useEffect(() => {
    setName(space.name);
    setBgStartColor(space.bgStartColor || "#10B981");
    setBgEndColor(space.bgEndColor || "#059669");
    setSelectedIcon(space.icon || "House");
  }, [space]);

  const applyUpdates = useCallback(
    async (updates: Partial<Space>) => {
      try {
        await lumi.spaces.updateSpace(space.profileId, space.id, updates);
      } catch (err) {
        console.error("Failed to update space theme:", err);
      }
    },
    [space.id, space.profileId]
  );

  const handlePresetSelect = useCallback(
    (preset: (typeof SPACE_THEME_PRESETS)[number]) => {
      setBgStartColor(preset.start);
      setBgEndColor(preset.end);
      applyUpdates({ bgStartColor: preset.start, bgEndColor: preset.end });
    },
    [applyUpdates]
  );

  const handleRandomize = useCallback(() => {
    const hue = Math.floor(Math.random() * 360);
    const saturationStart = 65 + Math.floor(Math.random() * 25);
    const saturationEnd = 65 + Math.floor(Math.random() * 25);
    const lightnessStart = 50 + Math.floor(Math.random() * 20);
    const lightnessEnd = 55 + Math.floor(Math.random() * 15);
    const hueVariation = Math.random() > 0.5 ? 30 + Math.floor(Math.random() * 60) : 180;
    const hueEnd = (hue + hueVariation) % 360;

    const start = hslToHex(hue, saturationStart, lightnessStart);
    const end = hslToHex(hueEnd, saturationEnd, lightnessEnd);

    setBgStartColor(start);
    setBgEndColor(end);
    applyUpdates({ bgStartColor: start, bgEndColor: end });
  }, [applyUpdates]);

  const handleIconSelect = useCallback(
    (icon: string) => {
      setSelectedIcon(icon);
      applyUpdates({ icon });
    },
    [applyUpdates]
  );

  const handleNameBlur = useCallback(() => {
    if (name.trim() && name !== space.name) {
      applyUpdates({ name: name.trim() });
    }
  }, [name, space.name, applyUpdates]);

  const activePreset = useMemo(() => {
    return SPACE_THEME_PRESETS.find(
      (p) => p.start.toLowerCase() === bgStartColor.toLowerCase() && p.end.toLowerCase() === bgEndColor.toLowerCase()
    );
  }, [bgStartColor, bgEndColor]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      {children && <PopoverTrigger nativeButton={false}>{children}</PopoverTrigger>}
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className={cn(
          "w-80 p-0 overflow-hidden rounded-xl border border-white/10 dark:border-white/15",
          "bg-popover/95 backdrop-blur-xl shadow-2xl z-50 text-foreground"
        )}
      >
        {/* Live Space Banner Preview */}
        <div
          className="relative h-24 p-4 flex flex-col justify-between transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${bgStartColor}, ${bgEndColor})`
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-black/25 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                <SpaceIcon id={selectedIcon} strokeWidth={2.5} className="size-5 text-white" />
              </div>
              <span className="text-xs uppercase font-bold tracking-wider text-white/80">Space Theme</span>
            </div>
            <button
              onClick={handleRandomize}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/30 hover:bg-black/45 active:scale-95 text-white text-xs font-medium backdrop-blur-sm transition-all"
              title="Generate harmonious random colors"
            >
              <Shuffle className="size-3" />
              <span>Random</span>
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Space Name"
              className="w-full bg-black/25 hover:bg-black/35 focus:bg-black/50 text-white font-semibold text-sm px-2.5 py-1 rounded-md outline-none border border-white/20 focus:border-white/50 transition-colors"
            />
          </div>
        </div>

        {/* Controls Container */}
        <div className="p-3.5 space-y-3.5 max-h-[380px] overflow-y-auto">
          {/* Gradient Presets */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Color Themes</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {SPACE_THEME_PRESETS.map((preset) => {
                const isSelected = activePreset?.name === preset.name;
                return (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetSelect(preset)}
                    className={cn(
                      "group relative h-9 rounded-lg overflow-hidden flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border",
                      isSelected
                        ? "border-white ring-2 ring-primary ring-offset-1"
                        : "border-black/10 dark:border-white/10"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${preset.start}, ${preset.end})`
                    }}
                    title={preset.name}
                  >
                    {isSelected && <Check className="size-4 text-white drop-shadow-md" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Hex Color Pickers */}
          <div className="pt-1 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Custom Colors
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {bgStartColor.toUpperCase()} → {bgEndColor.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 p-1.5 rounded-lg border border-border/60 hover:bg-muted/50 cursor-pointer">
                <input
                  type="color"
                  value={bgStartColor}
                  onChange={(e) => {
                    setBgStartColor(e.target.value);
                    applyUpdates({ bgStartColor: e.target.value });
                  }}
                  className="size-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                />
                <span className="text-xs font-medium truncate">Start</span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded-lg border border-border/60 hover:bg-muted/50 cursor-pointer">
                <input
                  type="color"
                  value={bgEndColor}
                  onChange={(e) => {
                    setBgEndColor(e.target.value);
                    applyUpdates({ bgEndColor: e.target.value });
                  }}
                  className="size-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                />
                <span className="text-xs font-medium truncate">End</span>
              </label>
            </div>
          </div>

          {/* Icon Picker */}
          <div className="pt-1 border-t border-border/50">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Palette className="size-3.5" />
              <span>Space Icon</span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {SPACE_ICON_OPTIONS.map((iconName) => {
                const isSelected = selectedIcon === iconName;
                return (
                  <button
                    key={iconName}
                    onClick={() => handleIconSelect(iconName)}
                    className={cn(
                      "size-8 rounded-lg flex items-center justify-center transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    title={iconName}
                  >
                    <SpaceIcon id={iconName} strokeWidth={2.5} className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
