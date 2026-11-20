import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Check, Rocket } from "lucide-react";
import { OnboardingAdvanceCallback } from "@/components/onboarding/main";

export function OnboardingFinish({ advance }: { advance: OnboardingAdvanceCallback }) {
  return (
    <>
      <motion.div
        className="relative z-elevated mb-6"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="flex size-24 items-center justify-center rounded-full border border-blue-400/40 bg-linear-to-br from-[#2563EB]/35 to-[#38BDF8]/25 shadow-[0_12px_40px_rgba(37,99,235,0.35)] backdrop-blur-xl">
          <Check className="h-12 w-12 text-sky-300" strokeWidth={3} />
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        className="relative z-elevated text-center max-w-2xl px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
      >
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">{"You're All Set"}</h1>
        <p className="text-slate-300/90 text-lg max-w-md mx-auto">
          Lumi is ready. You can adjust layout, shortcuts, or privacy controls anytime in Settings.
        </p>
      </motion.div>

      {/* Button */}
      <div className="mt-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        >
          <Button
            onClick={advance}
            className="cursor-pointer gap-2 rounded-xl border border-blue-400/40 bg-[#2563EB] px-9 py-6 text-base font-medium text-white shadow-[0_12px_32px_rgba(37,99,235,0.45)] hover:bg-[#1D4ED8]"
          >
            Start Browsing
            <Rocket className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </>
  );
}
