import { ColorPicker } from "../color-picker";
import { Palette, Shuffle } from "lucide-react";
import { Space } from "~/lumi/interfaces/sessions/spaces";
import { useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpaceIcon } from "@/lib/phosphor-icons";

type BackgroundGradientEditor = {
  editedSpace: Space;
  updateEditedSpace: (updates: Partial<Space>) => void;
};

export function BackgroundGradientEditor({ editedSpace, updateEditedSpace }: BackgroundGradientEditor) {
  const [randomiseCount, randomised] = useReducer((count: number) => count + 1, 0);

  const [localPreview, setLocalPreview] = useState({
    bgStartColor: editedSpace.bgStartColor || "#2563eb",
    bgEndColor: editedSpace.bgEndColor || "#6366f1"
  });

  const handleColorChange = (colorKey: "bgStartColor" | "bgEndColor", newColor: string) => {
    setLocalPreview((prev) => ({ ...prev, [colorKey]: newColor }));
    updateEditedSpace({ [colorKey]: newColor });
  };

  const hslToHex = (h: number, s: number, l: number): string => {
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
  };

  const generateRandomColors = () => {
    const hue = Math.floor(Math.random() * 360);
    const saturationStart = 65 + Math.floor(Math.random() * 25);
    const saturationEnd = 65 + Math.floor(Math.random() * 25);
    const lightnessStart = 48 + Math.floor(Math.random() * 18);
    const lightnessEnd = 52 + Math.floor(Math.random() * 16);
    const hueVariation = Math.random() > 0.5 ? 30 + Math.floor(Math.random() * 55) : 145;
    const hueEnd = (hue + hueVariation) % 360;

    const startColor = hslToHex(hue, saturationStart, lightnessStart);
    const endColor = hslToHex(hueEnd, saturationEnd, lightnessEnd);

    setLocalPreview({ bgStartColor: startColor, bgEndColor: endColor });
    updateEditedSpace({ bgStartColor: startColor, bgEndColor: endColor });
    randomised();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Live Window Gradient Preview</h4>
        </div>
        <Button variant="outline" size="sm" onClick={generateRandomColors} className="h-7 px-2.5 text-xs gap-1.5">
          <Shuffle className="size-3" />
          Randomize
        </Button>
      </div>

      {/* Live Mini-Lumi Browser Window Preview */}
      <div
        className="rounded-2xl overflow-hidden border border-black/15 dark:border-white/15 shadow-lg p-2.5 flex gap-2.5 h-40"
        style={{
          background: `linear-gradient(135deg, ${localPreview.bgStartColor}, ${localPreview.bgEndColor})`
        }}
      >
        {/* Simulated Sidebar */}
        <div className="w-36 rounded-xl bg-black/20 backdrop-blur-md border border-white/15 p-2.5 flex flex-col justify-between text-white shrink-0">
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-red-400/90" />
              <span className="size-2 rounded-full bg-amber-400/90" />
              <span className="size-2 rounded-full bg-emerald-400/90" />
            </div>
            <div className="h-6 rounded-lg bg-white/18 px-2 flex items-center text-[10px] text-white/85 truncate">
              lumi.browser
            </div>
            <div className="space-y-1">
              <div className="h-6 rounded-lg bg-white/25 px-2 flex items-center text-[10px] font-medium truncate">
                Workspace Overview
              </div>
              <div className="h-6 rounded-lg bg-white/10 px-2 flex items-center text-[10px] text-white/75 truncate">
                Research &amp; Notes
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1.5 border-t border-white/15">
            <div className="size-5 rounded-md bg-white/20 flex items-center justify-center shrink-0">
              <SpaceIcon id={editedSpace.icon} className="size-3.5 text-white" />
            </div>
            <span className="text-[11px] font-semibold truncate">{editedSpace.name || "Untitled Space"}</span>
          </div>
        </div>

        {/* Simulated Floating Content Card */}
        <div className="flex-1 rounded-xl bg-white/90 dark:bg-zinc-950/88 border border-white/40 dark:border-white/10 shadow-md p-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-2.5 w-28 rounded-full bg-black/10 dark:bg-white/15" />
            <div className="h-2 w-44 rounded-full bg-black/[0.06] dark:bg-white/10" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-12 rounded-lg bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.07]" />
            <div className="h-12 rounded-lg bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.07]" />
            <div className="h-12 rounded-lg bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.07]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ColorPicker
          key={`start-${randomiseCount}`}
          defaultColor={localPreview.bgStartColor}
          label="Start Color"
          onChange={(color) => handleColorChange("bgStartColor", color)}
        />
        <ColorPicker
          key={`end-${randomiseCount}`}
          defaultColor={localPreview.bgEndColor}
          label="End Color"
          onChange={(color) => handleColorChange("bgEndColor", color)}
        />
      </div>
    </div>
  );
}
