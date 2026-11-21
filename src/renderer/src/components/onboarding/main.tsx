import { OnboardingScreen } from "@/components/onboarding/screen";
import { OnboardingFinish } from "@/components/onboarding/stages/finish";
import { OnboardingImport } from "@/components/onboarding/stages/import";
import { OnboardingNewTab } from "@/components/onboarding/stages/new-tab";
import { OnboardingInitialSpace } from "@/components/onboarding/stages/initial-space/main";
import { OnboardingWelcome } from "@/components/onboarding/stages/welcome";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";

export type OnboardingAdvanceCallback = () => void;

export interface OnboardingSetupSummary {
  spaceName: string;
  spaceIcon: string;
  bgStartColor: string;
  bgEndColor: string;
  layoutLabel: string;
  importedLabel: string | null;
}

const DEFAULT_SUMMARY: OnboardingSetupSummary = {
  spaceName: "Personal",
  spaceIcon: "Globe",
  bgStartColor: "#1D4ED8",
  bgEndColor: "#0F172A",
  layoutLabel: "Left Sidebar",
  importedLabel: null
};

export function OnboardingMain() {
  const [stage, setStage] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);
  const [summary, setSummary] = useState<OnboardingSetupSummary>(DEFAULT_SUMMARY);

  const totalSteps = 5;

  const advance = useCallback(() => {
    setDirection(1);
    setStage((prev) => {
      const next = prev + 1;
      if (next >= totalSteps) {
        lumi.onboarding.finish();
        return prev;
      }
      return next;
    });
  }, []);

  const back = useCallback(() => {
    setDirection(-1);
    setStage((prev) => Math.max(0, prev - 1));
  }, []);

  const updateSummary = useCallback((patch: Partial<OnboardingSetupSummary>) => {
    setSummary((prev) => ({ ...prev, ...patch }));
  }, []);

  const renderStage = () => {
    switch (stage) {
      case 0:
        return <OnboardingWelcome advance={advance} />;
      case 1:
        return <OnboardingInitialSpace advance={advance} summary={summary} onUpdateSummary={updateSummary} />;
      case 2:
        return <OnboardingNewTab advance={advance} onSelectLayout={(layoutLabel) => updateSummary({ layoutLabel })} />;
      case 3:
        return (
          <OnboardingImport advance={advance} onImportedSummary={(importedLabel) => updateSummary({ importedLabel })} />
        );
      case 4:
        return <OnboardingFinish advance={advance} summary={summary} />;
      default:
        return null;
    }
  };

  return (
    <OnboardingScreen currentStep={stage} totalSteps={totalSteps} onBack={stage > 0 ? back : undefined}>
      <AnimatePresence mode="wait" custom={direction} initial={true}>
        <motion.div
          key={stage}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 28 : -28, scale: 0.985 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: direction > 0 ? -24 : 24, scale: 0.985 }}
          transition={{ type: "spring", stiffness: 360, damping: 32, mass: 0.9 }}
          className="flex w-full max-w-4xl flex-col items-center justify-center"
        >
          {renderStage()}
        </motion.div>
      </AnimatePresence>
    </OnboardingScreen>
  );
}
