import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useFocusMode } from "@/components/providers/focus-mode-provider";
import type { CompanionWebState } from "~/lumi/interfaces/browser/side-panel";

export type SidePanelMode = "scratchpad" | "web";

const WIDTH_STORAGE_KEY = "lumi.sidePanel.width";
const COMPANION_URL_PREFIX = "lumi.sidePanel.url.";

function loadSavedWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 260 && n <= 560) {
        return Math.round(n);
      }
    }
  } catch {
    // ignore storage errors
  }
  return 340;
}

function loadCompanionUrl(spaceId?: string): string {
  try {
    const raw = localStorage.getItem(`${COMPANION_URL_PREFIX}${spaceId ?? "default"}`);
    if (raw && raw.trim()) return raw.trim();
  } catch {
    // ignore storage errors
  }
  return "https://duckduckgo.com";
}

interface SidePanelContextValue {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  activeMode: SidePanelMode;
  setActiveMode: (mode: SidePanelMode) => void;
  panelWidth: number;
  setPanelWidth: (width: number) => void;
  companionUrl: string;
  setCompanionUrl: (url: string) => void;
  companionState: CompanionWebState;
}

const DEFAULT_WEB_STATE: CompanionWebState = {
  url: "https://duckduckgo.com",
  title: "Companion Web",
  isLoading: false,
  canGoBack: false,
  canGoForward: false
};

const SidePanelContext = createContext<SidePanelContextValue | null>(null);

export function useSidePanel(): SidePanelContextValue {
  const ctx = useContext(SidePanelContext);
  if (!ctx) {
    throw new Error("useSidePanel must be used within SidePanelProvider");
  }
  return ctx;
}

export function SidePanelProvider({ children }: { children: ReactNode }) {
  const { currentSpace } = useSpaces();
  const currentSpaceId = currentSpace?.id;
  const { isZenMode } = useFocusMode();
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<SidePanelMode>("scratchpad");
  const [panelWidth, setPanelWidthState] = useState<number>(() => loadSavedWidth());
  const [companionUrl, setCompanionUrlState] = useState<string>(() => loadCompanionUrl(currentSpaceId));
  const [companionState, setCompanionState] = useState<CompanionWebState>(DEFAULT_WEB_STATE);

  useEffect(() => {
    setCompanionUrlState(loadCompanionUrl(currentSpaceId));
  }, [currentSpaceId]);

  useEffect(() => {
    const unsub = lumi.sidePanel.onStateUpdated((next) => {
      setCompanionState(next);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const onWorkspaceAction = (e: Event) => {
      const action = (e as CustomEvent<string>).detail;
      if (action === "toggle_side_panel") {
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("lumi:workspace-action", onWorkspaceAction);
    return () => window.removeEventListener("lumi:workspace-action", onWorkspaceAction);
  }, []);

  // Ensure main-process WebContentsView hides when panel closes, switches to scratchpad, or enters Zen mode
  useEffect(() => {
    if (!isOpen || isZenMode || activeMode !== "web") {
      void lumi.sidePanel.setState({
        visible: false,
        mode: activeMode
      });
    }
  }, [isOpen, isZenMode, activeMode]);

  const setPanelWidth = useCallback((width: number) => {
    const clamped = Math.max(260, Math.min(560, Math.round(width)));
    setPanelWidthState(clamped);
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(clamped));
    } catch {
      // ignore storage errors
    }
  }, []);

  const setCompanionUrl = useCallback(
    (url: string) => {
      setCompanionUrlState(url);
      try {
        localStorage.setItem(`${COMPANION_URL_PREFIX}${currentSpaceId ?? "default"}`, url);
      } catch {
        // ignore storage errors
      }
    },
    [currentSpaceId]
  );

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  const value = useMemo<SidePanelContextValue>(
    () => ({
      isOpen,
      setOpen: setIsOpen,
      toggleOpen,
      activeMode,
      setActiveMode,
      panelWidth,
      setPanelWidth,
      companionUrl,
      setCompanionUrl,
      companionState
    }),
    [isOpen, toggleOpen, activeMode, panelWidth, setPanelWidth, companionUrl, setCompanionUrl, companionState]
  );

  return <SidePanelContext.Provider value={value}>{children}</SidePanelContext.Provider>;
}
