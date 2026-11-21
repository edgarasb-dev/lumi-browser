import { OnboardingAdvanceCallback } from "@/components/onboarding/main";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { BasicSettingsCard } from "@/components/settings/sections/general/basic-settings-cards";
import { useSetting, useSettings } from "@/components/providers/settings-provider";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LAYOUT_CHOICES = [
  { id: "sidebar-left", label: "Left Sidebar", layout: "sidebar" as const, side: "left" as const },
  { id: "sidebar-right", label: "Right Sidebar", layout: "sidebar" as const, side: "right" as const },
  { id: "topbar", label: "Horizontal Topbar", layout: "topbar" as const }
];

function MiniLayoutCard({ layout, side }: { layout: "sidebar" | "topbar"; side?: "left" | "right" }) {
  return (
    <div className="flex h-11 w-full gap-1.5 overflow-hidden rounded-lg border border-white/15 bg-black/30 p-1.5">
      {layout === "sidebar" && side === "left" && (
        <>
          <div className="flex h-full w-6 shrink-0 flex-col gap-1 rounded bg-blue-500/40 p-1">
            <div className="h-1 w-full rounded-xs bg-blue-300/80" />
            <div className="h-1 w-4/5 rounded-xs bg-white/45" />
          </div>
          <div className="h-full flex-1 rounded bg-white/12" />
        </>
      )}
      {layout === "sidebar" && side === "right" && (
        <>
          <div className="h-full flex-1 rounded bg-white/12" />
          <div className="flex h-full w-6 shrink-0 flex-col gap-1 rounded bg-blue-500/40 p-1">
            <div className="h-1 w-full rounded-xs bg-blue-300/80" />
            <div className="h-1 w-4/5 rounded-xs bg-white/45" />
          </div>
        </>
      )}
      {layout === "topbar" && (
        <div className="flex h-full flex-1 flex-col gap-1">
          <div className="flex h-3 w-full items-center gap-1 rounded bg-blue-500/40 px-1">
            <div className="h-1 w-4 rounded-xs bg-blue-200/80" />
            <div className="h-1 w-4 rounded-xs bg-white/45" />
          </div>
          <div className="flex-1 rounded bg-white/12" />
        </div>
      )}
    </div>
  );
}

export function OnboardingNewTab({
  advance,
  onSelectLayout
}: {
  advance: OnboardingAdvanceCallback;
  onSelectLayout?: (label: string) => void;
}) {
  const card = useSettings().cards.find((c) => c.title === "New Tab Mode");
  const [navigationLayout = "sidebar", setNavigationLayout] = useSetting<"sidebar" | "topbar">("navigationLayout");
  const [sidebarSide = "left", setSidebarSide] = useSetting<"left" | "right">("sidebarSide");

  const activeChoice =
    LAYOUT_CHOICES.find((opt) =>
      opt.layout === "topbar"
        ? navigationLayout === "topbar"
        : navigationLayout === "sidebar" && sidebarSide === opt.side
    ) ?? LAYOUT_CHOICES[0];

  const handleChoose = (opt: (typeof LAYOUT_CHOICES)[number]) => {
    setNavigationLayout(opt.layout);
    if (opt.side) setSidebarSide(opt.side);
    onSelectLayout?.(opt.label);
  };

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative z-elevated mb-5 max-w-2xl px-4 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-white md:text-5xl">Your Browser Layout</h1>
        <p className="text-sm text-slate-300/90 md:text-base">
          Switch between vertical sidebars or a compact topbar live — your chrome adapts instantaneously.
        </p>
      </div>

      <div className="relative z-elevated w-full max-w-2xl space-y-3.5 px-4">
        {/* Live Interactive Animated Frame Morph */}
        <div className="rounded-2xl border border-white/14 bg-white/[0.05] p-3 backdrop-blur-2xl shadow-[0_18px_46px_rgba(0,0,0,0.35)]">
          <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
            <span>Interactive Chrome Preview</span>
            <span className="text-sky-300">{activeChoice.label}</span>
          </div>

          <div
            className={cn(
              "flex h-28 gap-2 overflow-hidden rounded-xl border border-white/12 bg-[#070d1e]/90 p-2",
              navigationLayout === "topbar" ? "flex-col" : sidebarSide === "right" ? "flex-row-reverse" : "flex-row"
            )}
          >
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn(
                "shrink-0 rounded-lg border border-sky-400/35 bg-linear-to-br from-[#2563EB]/45 to-[#1E3A8A]/45 p-2 flex",
                navigationLayout === "topbar"
                  ? "h-8 w-full flex-row items-center justify-between"
                  : "h-full w-32 flex-col justify-between"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5",
                  navigationLayout === "topbar" ? "flex-row" : "flex-col items-stretch"
                )}
              >
                <div className="flex items-center gap-1 px-0.5">
                  <span className="size-1.5 rounded-full bg-rose-400/90" />
                  <span className="size-1.5 rounded-full bg-amber-400/90" />
                  <span className="size-1.5 rounded-full bg-emerald-400/90" />
                </div>
                <div
                  className={cn(
                    "rounded bg-white/16 border border-white/15 px-2 py-0.5 text-[9px] font-medium text-white",
                    navigationLayout === "topbar" ? "w-28" : "w-full mt-1"
                  )}
                >
                  lumi.dev
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-8 rounded-full bg-sky-300/45" />
                <span className="h-2 w-5 rounded-full bg-white/20" />
              </div>
            </motion.div>

            <motion.div
              layout
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="flex flex-1 flex-col justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-4"
            >
              <div className="h-2.5 w-2/5 rounded-full bg-white/20" />
              <div className="h-2 w-3/4 rounded-full bg-white/10" />
              <div className="h-2 w-3/5 rounded-full bg-white/8" />
            </motion.div>
          </div>
        </div>

        {/* Layout Selector Cards */}
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/14 bg-white/[0.06] p-3 backdrop-blur-xl">
          {LAYOUT_CHOICES.map((opt) => {
            const active = activeChoice.id === opt.id;
            return (
              <motion.button
                key={opt.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChoose(opt)}
                className={cn(
                  "relative flex flex-col items-start gap-2 rounded-xl border p-2.5 text-left transition-colors cursor-pointer",
                  active
                    ? "border-sky-400/70 bg-blue-500/20 ring-2 ring-sky-400/30"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/10"
                )}
              >
                <MiniLayoutCard layout={opt.layout} side={opt.side} />
                <span className="text-xs font-medium text-white">{opt.label}</span>
              </motion.button>
            );
          })}
        </div>

        {card && <BasicSettingsCard card={card} transparent />}
      </div>

      <motion.div className="mt-6" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          onClick={advance}
          className="group cursor-pointer gap-2 rounded-xl border border-blue-400/45 bg-linear-to-r from-[#2563EB] to-[#1D4ED8] px-9 py-5.5 text-base font-medium text-white shadow-[0_12px_32px_rgba(37,99,235,0.4)] hover:from-[#3B82F6] hover:to-[#2563EB]"
        >
          Continue
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </motion.div>
    </div>
  );
}
