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
    <div className="flex h-12 w-full gap-1.5 overflow-hidden rounded-lg border border-white/15 bg-black/30 p-1.5">
      {layout === "sidebar" && side === "left" && (
        <>
          <div className="flex h-full w-6 shrink-0 flex-col gap-1 rounded bg-blue-500/35 p-1">
            <div className="h-1 w-full rounded-xs bg-blue-300/80" />
            <div className="h-1 w-4/5 rounded-xs bg-white/40" />
          </div>
          <div className="h-full flex-1 rounded bg-white/12" />
        </>
      )}
      {layout === "sidebar" && side === "right" && (
        <>
          <div className="h-full flex-1 rounded bg-white/12" />
          <div className="flex h-full w-6 shrink-0 flex-col gap-1 rounded bg-blue-500/35 p-1">
            <div className="h-1 w-full rounded-xs bg-blue-300/80" />
            <div className="h-1 w-4/5 rounded-xs bg-white/40" />
          </div>
        </>
      )}
      {layout === "topbar" && (
        <div className="flex h-full flex-1 flex-col gap-1">
          <div className="flex h-3 w-full items-center gap-1 rounded bg-blue-500/35 px-1">
            <div className="h-1 w-4 rounded-xs bg-blue-200/80" />
            <div className="h-1 w-4 rounded-xs bg-white/40" />
          </div>
          <div className="flex-1 rounded bg-white/12" />
        </div>
      )}
    </div>
  );
}

export function OnboardingNewTab({ advance }: { advance: OnboardingAdvanceCallback }) {
  const card = useSettings().cards.find((c) => c.title === "New Tab Mode");
  const [navigationLayout = "sidebar", setNavigationLayout] = useSetting<"sidebar" | "topbar">("navigationLayout");
  const [sidebarSide = "left", setSidebarSide] = useSetting<"left" | "right">("sidebarSide");

  return (
    <>
      <motion.div
        className="relative z-elevated mb-6 max-w-2xl px-4 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white md:text-5xl">Your Browser Layout</h1>
        <p className="text-base text-slate-300/90 md:text-lg">
          Pick your chrome orientation and how new tabs open. You can change this anytime.
        </p>
      </motion.div>

      <motion.div
        className="relative z-elevated w-full max-w-xl space-y-4 px-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
      >
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/14 bg-white/7 p-3.5 backdrop-blur-xl">
          {LAYOUT_CHOICES.map((opt) => {
            const active =
              opt.layout === "topbar"
                ? navigationLayout === "topbar"
                : navigationLayout === "sidebar" && sidebarSide === opt.side;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setNavigationLayout(opt.layout);
                  if (opt.side) setSidebarSide(opt.side);
                }}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-2.5 text-left transition-all",
                  active
                    ? "border-blue-400/70 bg-blue-500/20 ring-2 ring-blue-400/35"
                    : "border-white/10 bg-white/4 hover:bg-white/10"
                )}
              >
                <MiniLayoutCard layout={opt.layout} side={opt.side} />
                <span className="text-xs font-medium text-white">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {card && <BasicSettingsCard card={card} transparent />}
      </motion.div>

      <div className="mt-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.45, delay: 0.2, ease: "easeOut" }}
        >
          <Button
            onClick={advance}
            className="cursor-pointer gap-2 rounded-xl border border-blue-400/40 bg-[#2563EB]/90 px-9 py-6 text-base font-medium text-white backdrop-blur-md hover:bg-[#2563EB]"
          >
            Continue
            <ArrowRight className="size-5" />
          </Button>
        </motion.div>
      </div>
    </>
  );
}
