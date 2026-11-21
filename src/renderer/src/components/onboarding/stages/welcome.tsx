import { OnboardingAdvanceCallback } from "@/components/onboarding/main";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Columns2, Download, Layers, PlugZap, Shield, Sparkles } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Layers, label: "Spaces & Split View" },
  { icon: Shield, label: "Ghostery Privacy Shield" },
  { icon: Download, label: "37-Browser Migration" },
  { icon: PlugZap, label: "Native Local MCP" },
  { icon: Sparkles, label: "Liquid Glass Chrome" }
];

const DEMO_TABS = [
  { label: "Lumi Workspace", badge: "Active", accent: "bg-sky-400" },
  { label: "Design Spec · Split", badge: "Split", accent: "bg-indigo-400" },
  { label: "Reader View · Docs", badge: "Calm", accent: "bg-emerald-400" }
];

export function OnboardingWelcome({ advance }: { advance: OnboardingAdvanceCallback }) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      {/* Floating Logo + Rotating Sapphire Aura Ring */}
      <motion.div
        className="relative z-elevated mb-4 flex items-center justify-center"
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
      >
        <motion.div
          className="absolute -inset-2 rounded-[26px] opacity-60 blur-md"
          style={{
            background: "conic-gradient(from 0deg, #38BDF8, #2563EB, #818CF8, #0EA5E9, #38BDF8)"
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          aria-hidden="true"
        />
        <motion.div
          className="relative flex size-19 items-center justify-center rounded-3xl border border-white/20 bg-slate-950/80 p-2 shadow-[0_20px_50px_rgba(37,99,235,0.4)] backdrop-blur-2xl"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <img src="/assets/logo.svg" alt="Lumi Browser" className="size-full rounded-2xl object-contain" />
        </motion.div>
      </motion.div>

      {/* Title & Tagline */}
      <motion.div
        className="relative z-elevated max-w-2xl px-4"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
      >
        <h1 className="mb-2.5 text-4xl font-bold tracking-tight text-white md:text-[54px] md:leading-[1.06]">
          Welcome to{" "}
          <span className="bg-linear-to-r from-sky-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Lumi Browser
          </span>
        </h1>
        <p className="mx-auto max-w-lg text-sm text-slate-300/90 md:text-base">
          A calm, liquid-glass workspace engineered for deep focus, Spaces, Split View, and privacy.
        </p>

        {/* Staggered Capability Pills */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {HIGHLIGHTS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.span
                key={item.label}
                initial={{ opacity: 0, y: 8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.14 + idx * 0.045, type: "spring", stiffness: 400, damping: 26 }}
                whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.12)" }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-100 backdrop-blur-md transition-colors"
              >
                <Icon className="size-3.5 text-sky-400" />
                {item.label}
              </motion.span>
            );
          })}
        </div>
      </motion.div>

      {/* Miniature Interactive Browser Shell Showcase */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 28 }}
        className="relative z-elevated mt-5 w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-white/[0.045] p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
      >
        <div className="flex h-40 gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#070d1e]/90 p-2">
          {/* Mini Translucent Sidebar */}
          <div className="flex w-40 shrink-0 flex-col justify-between rounded-lg bg-linear-to-b from-[#2563EB]/30 to-[#0F172A]/60 p-2 border border-white/10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 pb-1">
                <span className="size-2 rounded-full bg-rose-400/80" />
                <span className="size-2 rounded-full bg-amber-400/80" />
                <span className="size-2 rounded-full bg-emerald-400/80" />
                <span className="ml-auto text-[9px] font-semibold tracking-wider uppercase text-sky-300/80">Space</span>
              </div>
              {DEMO_TABS.map((tab, idx) => (
                <motion.div
                  key={tab.label}
                  animate={
                    idx === 0
                      ? { backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.2)" }
                      : { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }
                  }
                  transition={{ duration: 0.4 }}
                  className="flex items-center justify-between gap-1.5 rounded-md border px-2 py-1 text-left"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={`size-1.5 rounded-full shrink-0 ${tab.accent}`} />
                    <span className="truncate text-[10px] font-medium text-slate-100">{tab.label}</span>
                  </span>
                  <span className="text-[8px] font-medium text-sky-300/80 shrink-0">{tab.badge}</span>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-md bg-white/[0.06] px-2 py-1 text-[9px] text-slate-300">
              <span>⌘L Command</span>
              <span>⌘⇧\ Split</span>
            </div>
          </div>

          {/* Mini Split Viewport */}
          <div className="grid flex-1 grid-cols-2 gap-1.5">
            <div className="flex flex-col justify-between rounded-lg border border-white/10 bg-linear-to-br from-slate-900/90 to-blue-950/40 p-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">
                  <Columns2 className="size-2.5" /> Split Left
                </span>
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <motion.div
                  className="h-2 w-3/4 rounded bg-white/25"
                  animate={{ opacity: [0.65, 1, 0.65] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <div className="h-1.5 w-full rounded bg-white/10" />
                <div className="h-1.5 w-5/6 rounded bg-white/10" />
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-left">
              <span className="inline-flex w-fit items-center gap-1 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-medium text-indigo-300">
                Reader Mode
              </span>
              <div className="space-y-1.5">
                <div className="h-2 w-2/3 rounded bg-white/20" />
                <div className="h-1.5 w-full rounded bg-white/10" />
                <motion.div
                  className="h-1.5 w-4/5 rounded bg-sky-400/35"
                  animate={{ width: ["68%", "88%", "68%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Primary Action */}
      <motion.div
        className="mt-5 mb-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34 }}
      >
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={advance}
            className="group cursor-pointer gap-2 rounded-xl border border-blue-400/45 bg-linear-to-r from-[#2563EB] to-[#1D4ED8] px-9 py-5 text-base font-medium text-white shadow-[0_14px_36px_rgba(37,99,235,0.45)] transition hover:from-[#3B82F6] hover:to-[#2563EB]"
          >
            Get Started
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
