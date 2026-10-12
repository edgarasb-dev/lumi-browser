import { OnboardingAdvanceCallback } from "@/components/onboarding/main";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function OnboardingWelcome({ advance }: { advance: OnboardingAdvanceCallback }) {
  return (
    <>
      {/* Logo */}
      <motion.div
        className="relative z-elevated mb-6"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <img
          src="/assets/logo.svg"
          alt="Lumi Browser"
          className="size-28 rounded-2xl drop-shadow-[0_12px_30px_rgba(99,102,241,0.4)] object-contain"
        />
      </motion.div>

      {/* Content */}
      <motion.div
        className="relative z-elevated text-center max-w-2xl px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
      >
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
          Welcome to
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Lumi Browser
          </span>
        </h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto">
          {"Let's get you set up. This will only take a moment."}
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
            className="cursor-pointer px-10 py-6 text-lg bg-[#0066FF] hover:bg-[#0055DD] text-white border border-[#0066FF]/50 gap-2"
          >
            Get Started
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </>
  );
}
