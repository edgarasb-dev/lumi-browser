import React from "react";

export function OnboardingScreen({
  children,
  currentStep,
  totalSteps
}: {
  children?: React.ReactNode;
  currentStep?: number;
  totalSteps?: number;
}) {
  return (
    <div className="relative flex h-screen w-full select-none flex-col overflow-hidden bg-[#060b18]">
      <title>Onboarding | Lumi</title>

      {/* Draggable topbar region with clean pill step indicators */}
      <div className="app-drag relative z-modal flex h-11 w-full shrink-0 items-center justify-center">
        {currentStep !== undefined && totalSteps !== undefined && totalSteps > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < currentStep
                    ? "w-5 bg-[#3B82F6]"
                    : i === currentStep
                      ? "w-7 bg-[#60A5FA] shadow-[0_0_10px_rgba(96,165,250,0.65)]"
                      : "w-2 bg-white/20"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Subtle Sapphire & Cyan ambient orbs */}
      <div
        className="pointer-events-none absolute -top-[22%] -left-[12%] z-[5] h-[72%] w-[72%] rounded-full bg-radial from-[#2563EB]/35 via-[#3B82F6]/15 to-transparent blur-[70px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-[28%] -right-[16%] z-[5] h-[76%] w-[76%] rounded-full bg-radial from-[#0EA5E9]/25 via-[#2563EB]/12 to-transparent blur-[80px]"
        aria-hidden="true"
      />

      {/* Content area */}
      <div className="relative z-controls flex w-full flex-1 flex-col items-center justify-center overflow-y-auto p-6">
        {children}
      </div>
    </div>
  );
}

export default OnboardingScreen;
