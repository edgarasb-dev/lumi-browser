import React from "react";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["Welcome", "Space", "Layout", "Import", "Launch"] as const;

export function OnboardingScreen({
  children,
  currentStep,
  totalSteps,
  onBack
}: {
  children?: React.ReactNode;
  currentStep?: number;
  totalSteps?: number;
  onBack?: () => void;
}) {
  const showBack = Boolean(onBack && currentStep !== undefined && currentStep > 0);

  return (
    <div className="relative flex h-screen w-full select-none flex-col overflow-hidden bg-[#050a16]">
      <title>Onboarding | Lumi</title>

      {/* Living Liquid Glass Sapphire & Cyan Aurora Backdrop */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.045]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.75) 1px, transparent 1px)",
          backgroundSize: "24px 24px"
        }}
        aria-hidden="true"
      />
      <motion.div
        className="pointer-events-none absolute -top-[24%] -left-[12%] z-[2] h-[74%] w-[74%] rounded-full bg-radial from-[#2563EB]/38 via-[#3B82F6]/16 to-transparent blur-[76px]"
        animate={{ x: [0, 26, -8, 0], y: [0, 14, -10, 0], scale: [1, 1.05, 0.98, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
      <motion.div
        className="pointer-events-none absolute -bottom-[28%] -right-[14%] z-[2] h-[78%] w-[78%] rounded-full bg-radial from-[#0EA5E9]/28 via-[#6366F1]/14 to-transparent blur-[84px]"
        animate={{ x: [0, -24, 10, 0], y: [0, -18, 8, 0], scale: [1, 1.06, 0.97, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
      <motion.div
        className="pointer-events-none absolute top-[22%] left-[36%] z-[2] h-[44%] w-[44%] rounded-full bg-radial from-[#38BDF8]/12 via-transparent to-transparent blur-[72px]"
        animate={{ opacity: [0.55, 0.9, 0.55], scale: [0.95, 1.08, 0.95] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />

      {/* Draggable Top Header + Sliding Spring Step Progress */}
      <div className="app-drag relative z-modal flex h-13 w-full shrink-0 items-center justify-between px-5 platform-darwin:pl-22 platform-darwin:pr-22">
        <div className="w-24 flex items-center justify-start">
          {showBack && (
            <motion.button
              type="button"
              onClick={onBack}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.96 }}
              className="remove-app-drag inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur-md transition-colors hover:bg-white/12 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </motion.button>
          )}
        </div>

        {currentStep !== undefined && totalSteps !== undefined && totalSteps > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] p-1 shadow-[0_6px_24px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const active = i === currentStep;
              const completed = i < currentStep;
              const label = STEP_LABELS[i] ?? `Step ${i + 1}`;
              return (
                <div
                  key={label}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active ? "text-white" : completed ? "text-sky-300/90" : "text-slate-400/70"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="onboarding-active-step"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-full border border-sky-400/45 bg-linear-to-r from-[#2563EB]/85 to-[#0EA5E9]/70 shadow-[0_0_16px_rgba(59,130,246,0.45)]"
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 size-1.5 rounded-full transition-colors",
                      active ? "bg-white" : completed ? "bg-sky-400" : "bg-white/25"
                    )}
                  />
                  <span className="relative z-10 hidden sm:inline">{label}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="w-24" />
      </div>

      {/* Main Centered Viewport */}
      <div className="relative z-controls flex w-full flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-4 no-scrollbar">
        {children}
      </div>
    </div>
  );
}

export default OnboardingScreen;
