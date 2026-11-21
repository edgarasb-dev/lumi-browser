import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Check, PlugZap, Rocket, ShieldCheck } from "lucide-react";
import { SpaceIcon } from "@/lib/phosphor-icons";
import type { OnboardingAdvanceCallback, OnboardingSetupSummary } from "@/components/onboarding/main";

export function OnboardingFinish({
  advance,
  summary
}: {
  advance: OnboardingAdvanceCallback;
  summary: OnboardingSetupSummary;
}) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      {/* Celebratory Animated Sapphire Checkmark Badge */}
      <motion.div
        className="relative z-elevated mb-5 flex items-center justify-center"
        initial={{ scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
      >
        <motion.div
          className="absolute -inset-3 rounded-full border border-sky-400/35"
          animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0.15, 0.6] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        />
        <div className="relative flex size-22 items-center justify-center rounded-full border border-blue-400/45 bg-linear-to-br from-[#2563EB]/45 to-[#38BDF8]/30 shadow-[0_14px_42px_rgba(37,99,235,0.42)] backdrop-blur-xl">
          <Check className="size-10 text-sky-200" strokeWidth={3} />
        </div>
      </motion.div>

      <motion.div
        className="relative z-elevated max-w-2xl px-4"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white md:text-6xl">You&apos;re All Set</h1>
        <p className="mx-auto max-w-md text-sm text-slate-300/90 md:text-base">
          Your Lumi workspace is tuned and ready. Everything lives locally with full control in{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-sky-300">lumi://settings</code>.
        </p>
      </motion.div>

      {/* Personalized Setup Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.18, type: "spring", stiffness: 340, damping: 28 }}
        className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2.5 rounded-2xl border border-white/14 bg-white/[0.06] p-4 text-left backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:grid-cols-2"
      >
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white shadow-inner"
            style={{ backgroundImage: `linear-gradient(135deg, ${summary.bgStartColor}, ${summary.bgEndColor})` }}
          >
            <SpaceIcon id={summary.spaceIcon} className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Starting Space</div>
            <div className="truncate text-xs font-semibold text-white">{summary.spaceName}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
            <Rocket className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Chrome Layout</div>
            <div className="truncate text-xs font-semibold text-white">{summary.layoutLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
            <ShieldCheck className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Data &amp; Privacy</div>
            <div className="truncate text-xs font-semibold text-white">
              {summary.importedLabel ?? "Local SQLite · Private"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
            <PlugZap className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Local MCP Server</div>
            <div className="truncate text-xs font-semibold text-white">Opt-in in Settings → MCP</div>
          </div>
        </div>
      </motion.div>

      <motion.div className="mt-7" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
        <Button
          onClick={advance}
          className="group cursor-pointer gap-2 rounded-xl border border-blue-400/45 bg-linear-to-r from-[#2563EB] to-[#1D4ED8] px-10 py-6 text-base font-medium text-white shadow-[0_14px_38px_rgba(37,99,235,0.48)] hover:from-[#3B82F6] hover:to-[#2563EB]"
        >
          Start Browsing
          <Rocket className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Button>
      </motion.div>
    </div>
  );
}
