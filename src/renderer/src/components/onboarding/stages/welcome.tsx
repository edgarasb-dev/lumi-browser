import { OnboardingAdvanceCallback } from "@/components/onboarding/main";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, Shield, Sparkles } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Layers, label: "Spaces & Split View" },
  { icon: Shield, label: "Built-in Privacy Shield" },
  { icon: Sparkles, label: "Liquid Glass Workspace" }
];

export function OnboardingWelcome({ advance }: { advance: OnboardingAdvanceCallback }) {
  return (
    <>
      <motion.div
        className="relative z-elevated mb-6"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="flex size-28 items-center justify-center rounded-3xl border border-white/15 bg-white/8 p-3 shadow-[0_20px_50px_rgba(37,99,235,0.35)] backdrop-blur-2xl">
          <img src="/assets/logo.svg" alt="Lumi Browser" className="size-full rounded-2xl object-contain" />
        </div>
      </motion.div>

      <motion.div
        className="relative z-elevated max-w-2xl px-4 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
      >
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-white md:text-6xl">
          Welcome to
          <br />
          <span className="bg-linear-to-r from-sky-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Lumi Browser
          </span>
        </h1>
        <p className="mx-auto max-w-md text-base text-slate-300/90 md:text-lg">
          A calm, native-feeling workspace built for clarity, focus, and speed.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/7 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur-md"
              >
                <Icon className="size-3.5 text-sky-400" />
                {item.label}
              </span>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-9">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.45, delay: 0.22, ease: "easeOut" }}
        >
          <Button
            onClick={advance}
            className="cursor-pointer gap-2 rounded-xl border border-blue-400/40 bg-[#2563EB] px-9 py-6 text-base font-medium text-white shadow-[0_12px_32px_rgba(37,99,235,0.45)] transition hover:bg-[#1D4ED8]"
          >
            Get Started
            <ArrowRight className="size-5" />
          </Button>
        </motion.div>
      </div>
    </>
  );
}
