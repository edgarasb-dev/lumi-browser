import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBrowserSidebar } from "@/components/browser-ui/browser-sidebar/provider";
import { toast } from "sonner";

export type FocusPhase = "focus" | "break";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const FOCUS_DOMAINS_KEY = "lumi.focus.blockedDomains";
const DEFAULT_DOMAINS = ["youtube.com", "x.com", "twitter.com", "reddit.com", "instagram.com", "tiktok.com"];

function loadBlockedDomains(): string[] {
  try {
    const raw = localStorage.getItem(FOCUS_DOMAINS_KEY);
    if (!raw) return DEFAULT_DOMAINS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((d): d is string => typeof d === "string" && d.trim().length > 0);
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_DOMAINS;
}

interface FocusModeContextValue {
  isZenMode: boolean;
  setZenMode: (enabled: boolean) => void;
  toggleZenMode: () => void;
  timerRunning: boolean;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: (nextPhase?: FocusPhase) => void;
  toggleTimer: () => void;
  blockDistractions: boolean;
  setBlockDistractions: (enabled: boolean) => void;
  blockedDomains: string[];
  setBlockedDomains: (domains: string[]) => void;
}

interface FocusTimerContextValue {
  phase: FocusPhase;
  remainingSeconds: number;
}

const FocusModeContext = createContext<FocusModeContextValue | null>(null);
const FocusTimerContext = createContext<FocusTimerContextValue | null>(null);

export function useFocusMode(): FocusModeContextValue {
  const ctx = useContext(FocusModeContext);
  if (!ctx) {
    throw new Error("useFocusMode must be used within FocusModeProvider");
  }
  return ctx;
}

export function useOptionalFocusMode(): FocusModeContextValue | null {
  return useContext(FocusModeContext);
}

export function useFocusTimer(): FocusTimerContextValue {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) {
    throw new Error("useFocusTimer must be used within FocusModeProvider");
  }
  return ctx;
}

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const { hasSidebar, isVisible: sidebarVisible, setVisible: setSidebarVisible } = useBrowserSidebar();
  const [isZenMode, setIsZenModeState] = useState(false);
  const [phase, setPhase] = useState<FocusPhase>("focus");
  const [timerRunning, setTimerRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(FOCUS_SECONDS);
  const [blockDistractions, setBlockDistractionsState] = useState(false);
  const [blockedDomains, setBlockedDomainsState] = useState<string[]>(() => loadBlockedDomains());

  const preZenSidebarVisibleRef = useRef<boolean>(true);
  const sidebarVisibleRef = useRef(sidebarVisible);
  sidebarVisibleRef.current = sidebarVisible;

  const setZenMode = useCallback(
    (enabled: boolean) => {
      setIsZenModeState((prev) => {
        if (prev === enabled) return prev;
        if (enabled) {
          preZenSidebarVisibleRef.current = sidebarVisibleRef.current;
          if (hasSidebar) {
            setSidebarVisible(false);
          }
          toast("Focus / Zen Mode enabled", { description: "Press Cmd+Shift+Z to return to normal view." });
        } else {
          if (hasSidebar && preZenSidebarVisibleRef.current) {
            setSidebarVisible(true);
          }
        }
        return enabled;
      });
    },
    [hasSidebar, setSidebarVisible]
  );

  const toggleZenMode = useCallback(() => {
    setZenMode(!isZenMode);
  }, [isZenMode, setZenMode]);

  useEffect(() => {
    const onWorkspaceAction = (e: Event) => {
      const action = (e as CustomEvent<string>).detail;
      if (action === "toggle_zen_mode") {
        setZenMode(!isZenMode);
      }
    };
    window.addEventListener("lumi:workspace-action", onWorkspaceAction);
    return () => window.removeEventListener("lumi:workspace-action", onWorkspaceAction);
  }, [isZenMode, setZenMode]);

  const wasFocusBlockActiveRef = useRef(false);

  // Keep Focus Blocklist in sync with main-process ContentBlocker (skip mount IPC when inactive)
  useEffect(() => {
    const active = blockDistractions && (timerRunning || isZenMode) && phase === "focus";
    if (!active && !wasFocusBlockActiveRef.current) {
      return;
    }
    wasFocusBlockActiveRef.current = active;
    void lumi.contentBlocker.setFocusBlocklist(active, blockedDomains).catch(() => undefined);
  }, [blockDistractions, timerRunning, isZenMode, phase, blockedDomains]);

  useEffect(() => {
    return () => {
      if (wasFocusBlockActiveRef.current) {
        wasFocusBlockActiveRef.current = false;
        void lumi.contentBlocker.setFocusBlocklist(false).catch(() => undefined);
      }
    };
  }, []);

  // Pomodoro tick loop
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          const nextPhase: FocusPhase = phase === "focus" ? "break" : "focus";
          setPhase(nextPhase);
          setTimerRunning(false);
          toast(nextPhase === "break" ? "Focus session complete!" : "Break finished!", {
            description: nextPhase === "break" ? "Take a 5 minute breather." : "Ready for your next 25 minute sprint."
          });
          return nextPhase === "break" ? BREAK_SECONDS : FOCUS_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, phase]);

  const startTimer = useCallback(() => setTimerRunning(true), []);
  const pauseTimer = useCallback(() => setTimerRunning(false), []);
  const resetTimer = useCallback((nextPhase: FocusPhase = "focus") => {
    setTimerRunning(false);
    setPhase(nextPhase);
    setRemainingSeconds(nextPhase === "break" ? BREAK_SECONDS : FOCUS_SECONDS);
  }, []);
  const toggleTimer = useCallback(() => setTimerRunning((prev) => !prev), []);

  const setBlockedDomains = useCallback((domains: string[]) => {
    const clean = domains.map((d) => d.trim().toLowerCase()).filter(Boolean);
    const finalDomains = clean.length > 0 ? clean : DEFAULT_DOMAINS;
    setBlockedDomainsState(finalDomains);
    try {
      localStorage.setItem(FOCUS_DOMAINS_KEY, JSON.stringify(finalDomains));
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = useMemo<FocusModeContextValue>(
    () => ({
      isZenMode,
      setZenMode,
      toggleZenMode,
      timerRunning,
      startTimer,
      pauseTimer,
      resetTimer,
      toggleTimer,
      blockDistractions,
      setBlockDistractions: setBlockDistractionsState,
      blockedDomains,
      setBlockedDomains
    }),
    [
      isZenMode,
      setZenMode,
      toggleZenMode,
      timerRunning,
      startTimer,
      pauseTimer,
      resetTimer,
      toggleTimer,
      blockDistractions,
      blockedDomains,
      setBlockedDomains
    ]
  );

  const timerValue = useMemo<FocusTimerContextValue>(
    () => ({
      phase,
      remainingSeconds
    }),
    [phase, remainingSeconds]
  );

  return (
    <FocusModeContext.Provider value={value}>
      <FocusTimerContext.Provider value={timerValue}>{children}</FocusTimerContext.Provider>
    </FocusModeContext.Provider>
  );
}
