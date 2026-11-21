import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useUnmount } from "react-use";
import { copyStylesToDocument } from "@/hooks/use-copy-styles";

const MAX_IDLE_PORTALS = 3;
const DEFAULT_MIN_IDLE_PORTALS = 1;

interface Portal {
  id: string;
  window: Window;
  _destroy: () => void;
}

declare global {
  interface Window {
    portals: {
      available: Map<string, Portal>;
      used: Map<string, Portal>;
    };
  }
}

if (!window.portals) {
  window.portals = {
    available: new Map(),
    used: new Map()
  };
}

// Vite hot reloading compatibility
if (import.meta.hot) {
  const cleanup = () => {
    if (window.portals) {
      // Close all available portals
      for (const portal of window.portals.available.values()) {
        removePortal(portal);
      }
      // Close all used portals
      for (const portal of window.portals.used.values()) {
        removePortal(portal);
      }
      // Clear the maps
      window.portals.available.clear();
      window.portals.used.clear();
    }
  };

  // Cleanup all portals when this module is about to be hot reloaded
  import.meta.hot.dispose(() => {
    cleanup();
  });

  // Re-initialize portal pool after hot reload
  import.meta.hot.accept(() => {
    cleanup();
  });
}

interface PortalContextValue {
  takePortal: typeof takePortal;
  takeAvailablePortal: typeof takeAvailablePortal;
  getAvailablePortals: typeof getAvailablePortals;
  releasePortal: typeof releasePortal;
  removePortal: typeof removePortal;
  usePortal: typeof usePortal;
}

const PortalContext = createContext<PortalContextValue | null>(null);

function generatePortalId() {
  return Math.random().toString(36).substring(2, 15);
}

export function usePortalsProvider() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error("usePortalsProvider must be used within a PortalsProvider");
  }
  return context;
}

function createPortal() {
  const portalId = generatePortalId();

  const windowName = `portal_${portalId}`;
  const containerWin = window.open("about:blank", windowName, `componentId=${portalId}`);

  if (!containerWin) {
    return null;
  }

  // Reset any default margins/paddings and suppress scrollbars.
  const htmlStyle = containerWin.document.documentElement.style;
  htmlStyle.overflow = "hidden";

  const bodyStyle = containerWin.document.body.style;
  bodyStyle.margin = "0";
  bodyStyle.padding = "0";
  bodyStyle.overflow = "hidden";

  // Pre-warm: copy all Tailwind / app styles from the main document into
  // the portal immediately so the very first render already has correct
  // styles (dark mode, translate-x-full, etc.). useCopyStyles() in the
  // React tree will later attach a MutationObserver to keep them in sync.
  copyStylesToDocument(containerWin.document);

  const portal: Portal = {
    id: portalId,
    window: containerWin,
    _destroy: () => {
      containerWin.close();
    }
  };

  window.portals.available.set(portalId, portal);
  return portal;
}

/// UTILITY FUNCTIONS ///
function takePortal(id: string) {
  const portal = window.portals.available.get(id);
  if (portal) {
    window.portals.used.set(id, portal);
    window.portals.available.delete(id);
    return portal;
  }
  return null;
}

function takeAvailablePortal() {
  const portal = window.portals.available.values().next().value;
  if (portal) {
    window.portals.used.set(portal.id, portal);
    window.portals.available.delete(portal.id);
    return portal;
  }
  return null;
}

function getAvailablePortals() {
  return window.portals.available;
}

// Global handler populated by the active PortalsProvider so pool optimization respects its minIdlePortals setting
let onPortalReleasedHook: (() => void) | null = null;

function releasePortal(portal: Portal) {
  window.portals.used.delete(portal.id);
  window.portals.available.set(portal.id, portal);

  lumi.interface.releaseComponentWindow(portal.id);
  onPortalReleasedHook?.();
}

function removePortal(portal: Portal) {
  window.portals.used.delete(portal.id);
  window.portals.available.delete(portal.id);

  portal._destroy();
}

function usePortal() {
  const currentPortal = useMemo(() => {
    let portal = takeAvailablePortal();
    if (!portal) {
      portal = createPortal();
      if (portal) {
        window.portals.available.delete(portal.id);
        window.portals.used.set(portal.id, portal);
      }
    }
    return portal;
  }, []);

  useUnmount(() => {
    if (currentPortal) {
      releasePortal(currentPortal);
    }
  });

  return currentPortal;
}

/// PROVIDER ///
export function PortalsProvider({
  children,
  minIdlePortals = DEFAULT_MIN_IDLE_PORTALS
}: {
  children: React.ReactNode;
  minIdlePortals?: number;
}) {
  const minIdlePortalsRef = useRef(minIdlePortals);
  minIdlePortalsRef.current = minIdlePortals;
  const optimizeTimerRef = useRef<number | null>(null);

  const scheduleOptimizePortalPool = useCallback(() => {
    if (optimizeTimerRef.current !== null) {
      window.clearTimeout(optimizeTimerRef.current);
    }
    optimizeTimerRef.current = window.setTimeout(() => {
      optimizeTimerRef.current = null;
      const runOptimize = () => {
        const availablePortals = window.portals.available;

        // Check all the portals are still alive
        for (const portal of availablePortals.values()) {
          if (portal.window.closed) {
            removePortal(portal);
          }
        }

        // Top up toward minIdlePortals cleanly (one per idle tick, stopping on failure)
        if (availablePortals.size < minIdlePortalsRef.current) {
          const created = createPortal();
          if (created) {
            scheduleOptimizePortalPool();
          }
          return;
        }

        // If the count of available portals exceeds MAX_IDLE_PORTALS, close the excess portals
        while (availablePortals.size > MAX_IDLE_PORTALS) {
          const portal = availablePortals.values().next().value;
          if (!portal) break;
          removePortal(portal);
        }
      };

      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(runOptimize, { timeout: 500 });
      } else {
        runOptimize();
      }
    }, 100);
  }, []);

  useEffect(() => {
    onPortalReleasedHook = scheduleOptimizePortalPool;
    if (minIdlePortals > 0 && window.portals.available.size < minIdlePortals) {
      scheduleOptimizePortalPool();
    }
    return () => {
      if (onPortalReleasedHook === scheduleOptimizePortalPool) {
        onPortalReleasedHook = null;
      }
      if (optimizeTimerRef.current !== null) {
        window.clearTimeout(optimizeTimerRef.current);
        optimizeTimerRef.current = null;
      }
    };
  }, [minIdlePortals, scheduleOptimizePortalPool]);

  const contextValue = useMemo<PortalContextValue>(
    () => ({
      takePortal,
      takeAvailablePortal,
      getAvailablePortals,
      releasePortal,
      removePortal,
      usePortal
    }),
    []
  );

  return <PortalContext.Provider value={contextValue}>{children}</PortalContext.Provider>;
}
