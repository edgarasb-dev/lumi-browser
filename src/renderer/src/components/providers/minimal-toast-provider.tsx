/* eslint-disable @typescript-eslint/no-explicit-any */
import { PortalComponent } from "@/components/portal/portal";
import { useBoundingRect } from "@/hooks/use-bounding-rect";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { SidebarSide } from "@/components/browser-ui/types";
import { cn } from "@/lib/utils";
import { useSpaces } from "@/components/providers/spaces-provider";

// TYPES //
interface ToastConfiguration<T extends any[]> {
  generate: (...args: T) => ToastGenerateData;
}
interface ToastGenerateData {
  message: string;
  duration: number;
  actionLabel?: string;
  onAction?: () => void;
}

type ToastId = keyof typeof TOAST_CONFIGURATIONS;

interface ActiveToast {
  uid: string;
  message: string;
  duration: number;
  actionLabel?: string;
  onAction?: () => void;
}

// CONFIGURATION //
const TOAST_WIDTH = 312;
const TOAST_HEIGHT = 46;
const TOAST_PADDING = 8;
const TOAST_CONFIGURATIONS = {
  copyTabUrl: {
    generate: () => ({
      message: "Copied Current URL",
      duration: 4500
    })
  },
  readerUnavailable: {
    generate: () => ({
      message: "No article detected on page",
      duration: 3200
    })
  },
  downloadStarted: {
    generate: (filename: string) => ({
      message: `Downloading ${filename}`,
      duration: 3000
    })
  },
  downloadCompleted: {
    generate: (filename: string) => ({
      message: `Downloaded ${filename}`,
      duration: 4200
    })
  },
  tidyApplied: {
    generate: (summary: string, undoId: string | null) => ({
      message: summary,
      duration: undoId ? 6500 : 2800,
      actionLabel: undoId ? "Undo" : undefined,
      onAction: undoId ? () => void lumi.tabs.undoTidy(undoId) : undefined
    })
  }
} satisfies Record<string, ToastConfiguration<any[]>>;

// CONTEXT //
type ToastContextType = {
  showToast: <T extends ToastId>(
    toastId: T,
    ...args: Parameters<(typeof TOAST_CONFIGURATIONS)[T]["generate"]>
  ) => string;
  removeToast: (toastUID: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

// PROVIDER //
interface ToastProviderProps {
  children: React.ReactNode;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  sidebarSide: SidebarSide;
}

function ActiveToastPortal({
  activeToast,
  isVisible,
  onHideCompleted,
  anchorRef,
  sidebarSide,
  onRemoveToast
}: {
  activeToast: ActiveToast | null;
  isVisible: boolean;
  onHideCompleted: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  sidebarSide: SidebarSide;
  onRemoveToast: (toastUID: string) => void;
}) {
  const { isCurrentSpaceLight } = useSpaces();
  const anchorRect = useBoundingRect(anchorRef);
  const currentMessage = activeToast?.message ?? null;

  if (!anchorRect) {
    return null;
  }

  const spaceInjectedClasses = cn(isCurrentSpaceLight ? "" : "dark");
  return (
    <PortalComponent
      visible={isVisible}
      layerType="floatingSidebar"
      className="fixed"
      style={{
        top: anchorRect.y,
        ...(sidebarSide === "left"
          ? { right: window.innerWidth - anchorRect.right + TOAST_PADDING }
          : { left: anchorRect.x + TOAST_PADDING }),
        width: TOAST_WIDTH,
        height: TOAST_HEIGHT + TOAST_PADDING
      }}
    >
      <div className={cn("relative w-full h-full select-none", spaceInjectedClasses)}>
        <AnimatePresence mode="sync" onExitComplete={onHideCompleted}>
          {currentMessage && activeToast && (
            <motion.div
              key={activeToast.uid}
              initial={{ y: 0, opacity: 0, scale: 0.92 }}
              animate={{ y: TOAST_PADDING, opacity: 1, scale: 1 }}
              exit={{
                opacity: 0,
                scale: 0.95,
                transition: { duration: 0.15, ease: [0.4, 0, 1, 1] }
              }}
              style={{
                transformOrigin: "top center",
                position: "absolute",
                left: 0,
                right: 0,
                height: TOAST_HEIGHT
              }}
              transition={{
                type: "spring",
                stiffness: 440,
                damping: 28,
                opacity: { duration: 0.15, ease: "easeOut" }
              }}
              className={cn(
                "box-border overflow-hidden",
                "flex items-center gap-2 px-3",
                "border rounded-lg",
                "border-t-gray-800/30 dark:border-t-gray-300/30",
                "border-x-gray-800/40 dark:border-x-gray-300/40",
                "border-b-gray-800/50 dark:border-b-gray-300/50",
                "dimmed-space-background-start"
              )}
              onClick={() => onRemoveToast(activeToast.uid)}
            >
              <span
                className={cn(
                  "text-white/90 text-[13px] font-bold tracking-[-0.01em] truncate flex-1 leading-none",
                  !activeToast.actionLabel && "text-center"
                )}
              >
                {currentMessage}
              </span>
              {activeToast.actionLabel && activeToast.onAction && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    activeToast.onAction?.();
                    onRemoveToast(activeToast.uid);
                  }}
                  className="shrink-0 rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-900 shadow-xs hover:bg-white cursor-pointer transition-colors"
                >
                  {activeToast.actionLabel}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PortalComponent>
  );
}

function ToastContainer({
  activeToast,
  anchorRef,
  sidebarSide,
  onRemoveToast
}: {
  activeToast: ActiveToast | null;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  sidebarSide: SidebarSide;
  onRemoveToast: (toastUID: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const activeToastRef = useRef(activeToast);

  activeToastRef.current = activeToast;

  useEffect(() => {
    if (!activeToast) return;
    setIsVisible(true);
  }, [activeToast]);

  useEffect(() => {
    if (!activeToast) return;

    const timer = window.setTimeout(() => {
      onRemoveToast(activeToast.uid);
    }, activeToast.duration);

    return () => window.clearTimeout(timer);
  }, [activeToast, onRemoveToast]);

  const handleHideCompleted = useCallback(() => {
    if (!activeToastRef.current) {
      setIsVisible(false);
    }
  }, []);

  if (!activeToast && !isVisible) {
    return null;
  }

  return (
    <ActiveToastPortal
      activeToast={activeToast}
      isVisible={isVisible}
      onHideCompleted={handleHideCompleted}
      anchorRef={anchorRef}
      sidebarSide={sidebarSide}
      onRemoveToast={onRemoveToast}
    />
  );
}

export function MinimalToastProvider({ children, anchorRef, sidebarSide }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const removeToast = useCallback((toastUID: string) => {
    setToasts((prev) => prev.filter((t) => t.uid !== toastUID));
  }, []);

  const showToast = useCallback(
    <T extends ToastId>(toastId: T, ...args: Parameters<(typeof TOAST_CONFIGURATIONS)[T]["generate"]>) => {
      type GenerateFunction = (...args: Parameters<(typeof TOAST_CONFIGURATIONS)[T]["generate"]>) => ToastGenerateData;

      const configuration = TOAST_CONFIGURATIONS[toastId];
      const generateToastData = configuration.generate as GenerateFunction;
      const { message, duration, actionLabel, onAction } = generateToastData(...args);
      const uid = crypto.randomUUID();
      setToasts([{ uid, message, duration, actionLabel, onAction }]);
      return uid;
    },
    []
  );

  const activeToast = toasts.length > 0 ? toasts[toasts.length - 1]! : null;
  const contextValue = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer
        activeToast={activeToast}
        anchorRef={anchorRef}
        sidebarSide={sidebarSide}
        onRemoveToast={removeToast}
      />
    </ToastContext.Provider>
  );
}

export default MinimalToastProvider;
