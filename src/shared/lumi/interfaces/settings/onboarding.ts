// API //
export interface LumiOnboardingAPI {
  /**
   * Finishes the onboarding process
   */
  finish: () => void;

  /**
   * Resets the onboarding process
   */
  reset: () => void;
}
