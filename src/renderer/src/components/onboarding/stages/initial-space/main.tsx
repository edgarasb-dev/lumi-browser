import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpaceIcon } from "@/lib/phosphor-icons";
import { cn } from "@/lib/utils";
import type { OnboardingAdvanceCallback, OnboardingSetupSummary } from "@/components/onboarding/main";

const QUICK_ICONS = [
  "Globe",
  "Code",
  "Briefcase",
  "Compass",
  "Sparkle",
  "BookOpen",
  "RocketLaunch",
  "MusicNote"
] as const;

const SPACE_PALETTES: Array<{ id: string; name: string; start: string; end: string }> = [
  { id: "sapphire", name: "Lumi Sapphire", start: "#2563EB", end: "#0F172A" },
  { id: "indigo", name: "Deep Indigo", start: "#4338CA", end: "#1E1B4B" },
  { id: "aurora", name: "Aurora Teal", start: "#0284C7", end: "#0F766E" },
  { id: "forest", name: "Nordic Emerald", start: "#059669", end: "#064E3B" },
  { id: "rose", name: "Crimson Velvet", start: "#E11D48", end: "#4C0519" },
  { id: "amber", name: "Solar Amber", start: "#D97706", end: "#451A03" }
];

export function OnboardingInitialSpace({
  advance,
  summary,
  onUpdateSummary
}: {
  advance: OnboardingAdvanceCallback;
  summary: OnboardingSetupSummary;
  onUpdateSummary: (patch: Partial<OnboardingSetupSummary>) => void;
}) {
  const [spaceName, setSpaceName] = useState(summary.spaceName || "Personal");
  const [selectedIcon, setSelectedIcon] = useState(summary.spaceIcon || "Globe");
  const [bgStart, setBgStart] = useState(summary.bgStartColor || SPACE_PALETTES[0].start);
  const [bgEnd, setBgEnd] = useState(summary.bgEndColor || SPACE_PALETTES[0].end);
  const [existingSpaceId, setExistingSpaceId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void lumi.spaces
      .getSpacesFromProfile("main")
      .then((spaces) => {
        if (spaces.length > 0) {
          const first = spaces[0];
          setExistingSpaceId(first.id);
        }
      })
      .catch(() => undefined);
  }, []);

  const handleContinue = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const trimmedName = spaceName.trim() || "Personal";

    try {
      let targetSpaceId = existingSpaceId;
      if (!targetSpaceId) {
        await lumi.spaces.createSpace("main", trimmedName);
        const spaces = await lumi.spaces.getSpacesFromProfile("main");
        targetSpaceId = spaces.find((s) => s.name === trimmedName)?.id ?? spaces[0]?.id ?? null;
      }

      if (targetSpaceId) {
        await lumi.spaces.updateSpace("main", targetSpaceId, {
          name: trimmedName,
          icon: selectedIcon,
          bgStartColor: bgStart,
          bgEndColor: bgEnd
        });
        await lumi.spaces.setUsingSpace("main", targetSpaceId);
      }

      onUpdateSummary({
        spaceName: trimmedName,
        spaceIcon: selectedIcon,
        bgStartColor: bgStart,
        bgEndColor: bgEnd
      });
      advance();
    } catch (error) {
      console.error("Failed to configure onboarding space:", error);
      advance();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-5 max-w-2xl px-4 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-white md:text-5xl">Craft Your First Space</h1>
        <p className="text-sm text-slate-300/90 md:text-base">
          Name your workspace, pick an icon, and set its ambient chrome tint — watch it update live.
        </p>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 px-2 md:grid-cols-12">
        {/* Left Studio Controls */}
        <div className="md:col-span-7 space-y-4 rounded-2xl border border-white/14 bg-white/[0.06] p-5 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <div className="space-y-1.5">
            <Label htmlFor="onboarding-space-name" className="text-xs font-medium text-slate-200">
              Space Name
            </Label>
            <Input
              id="onboarding-space-name"
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              placeholder="Personal, Work, Research..."
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleContinue();
              }}
              className="h-10 border-white/15 bg-black/30 text-white placeholder:text-slate-400 focus-visible:ring-sky-400/40"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-200">Space Icon</Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {QUICK_ICONS.map((iconId) => {
                const active = selectedIcon === iconId;
                return (
                  <motion.button
                    key={iconId}
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setSelectedIcon(iconId)}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-xl border transition-colors cursor-pointer",
                      active
                        ? "border-sky-400/70 bg-sky-500/25 text-white ring-2 ring-sky-400/30"
                        : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/10"
                    )}
                    title={iconId}
                  >
                    <SpaceIcon id={iconId} className="size-4.5" />
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-200">Chrome Gradient Theme</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {SPACE_PALETTES.map((palette) => {
                const active = bgStart === palette.start && bgEnd === palette.end;
                return (
                  <motion.button
                    key={palette.id}
                    type="button"
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      setBgStart(palette.start);
                      setBgEnd(palette.end);
                    }}
                    title={palette.name}
                    style={{ backgroundImage: `linear-gradient(135deg, ${palette.start}, ${palette.end})` }}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-xl border transition-all cursor-pointer",
                      active
                        ? "border-white ring-2 ring-sky-400/50 shadow-lg"
                        : "border-white/15 opacity-85 hover:opacity-100"
                    )}
                  >
                    {active && <Check className="size-4 text-white drop-shadow" />}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Live Space Browser Preview */}
        <div className="md:col-span-5 flex flex-col justify-between rounded-2xl border border-white/14 bg-white/[0.045] p-3.5 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
            <span>Live Window Preview</span>
            <span className="text-sky-300">Dynamic Tint</span>
          </div>

          <div
            className="flex flex-1 gap-2 overflow-hidden rounded-xl border border-white/15 p-2 transition-all duration-300"
            style={{
              backgroundImage: `linear-gradient(155deg, ${bgStart}, ${bgEnd})`
            }}
          >
            {/* Preview Sidebar */}
            <div className="flex w-32 shrink-0 flex-col justify-between rounded-lg bg-black/28 p-2 backdrop-blur-md border border-white/10">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-rose-400/90" />
                  <span className="size-2 rounded-full bg-amber-400/90" />
                  <span className="size-2 rounded-full bg-emerald-400/90" />
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-white/12 px-2 py-1.5 border border-white/15">
                  <motion.div
                    key={selectedIcon}
                    initial={{ scale: 0.65, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 450, damping: 24 }}
                    className="flex size-5 shrink-0 items-center justify-center rounded-md bg-white/15 text-white"
                  >
                    <SpaceIcon id={selectedIcon} className="size-3.5" />
                  </motion.div>
                  <span className="truncate text-[11px] font-semibold text-white">
                    {spaceName.trim() || "Personal"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <div className="h-6 rounded-md bg-white/10 border border-white/10" />
                  <div className="h-6 rounded-md bg-white/10 border border-white/10" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 rounded-md bg-white/16 px-2 py-1 text-[10px] text-white font-medium">
                    <span className="size-1.5 rounded-full bg-sky-300" />
                    <span>New Tab</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-white/65">
                    <Plus className="size-2.5" />
                    <span>Open Tab</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-1 text-[9px] text-white/60">
                <span>1 Space</span>
                <span>0.3s Blur</span>
              </div>
            </div>

            {/* Preview Viewport */}
            <div className="flex flex-1 flex-col justify-between rounded-lg border border-white/12 bg-[#090f20]/92 p-2.5">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-12 rounded-full bg-white/20" />
                <div className="ml-auto h-2 w-6 rounded-full bg-sky-400/40" />
              </div>
              <div className="my-auto space-y-2 text-center">
                <motion.div
                  key={`${selectedIcon}-${bgStart}`}
                  initial={{ scale: 0.9, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mx-auto flex size-9 items-center justify-center rounded-xl border border-white/15 bg-white/8 text-white shadow-inner"
                >
                  <SpaceIcon id={selectedIcon} className="size-4.5" />
                </motion.div>
                <div className="text-[11px] font-semibold text-white/95 truncate px-1">
                  {spaceName.trim() || "Personal"} Space
                </div>
              </div>
              <div className="h-4 rounded-md bg-white/6 border border-white/8" />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={() => void handleContinue()}
            disabled={isSaving}
            className="group cursor-pointer gap-2 rounded-xl border border-blue-400/45 bg-linear-to-r from-[#2563EB] to-[#1D4ED8] px-8 py-5.5 text-sm font-medium text-white shadow-[0_12px_32px_rgba(37,99,235,0.4)] hover:from-[#3B82F6] hover:to-[#2563EB]"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving Space...
              </>
            ) : (
              <>
                Create Space & Continue
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
