import { useCallback, useEffect, useRef, type MouseEvent } from "react";

interface UseWindowDragOptions {
  onDragStart?: () => void;
  shouldIgnoreTarget?: (target: HTMLElement) => boolean;
}

export function useWindowDrag(options?: UseWindowDragOptions) {
  const isDraggingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const resetDrag = useCallback(() => {
    isDraggingRef.current = false;
    startPosRef.current = null;
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent<HTMLElement>) => {
    // Only primary (left) button
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    const currentTarget = e.currentTarget;

    // Ignore React synthetic events bubbling across createPortal boundaries (e.g. native portal popovers)
    if (!target || target.ownerDocument !== currentTarget.ownerDocument || !currentTarget.contains(target)) {
      return;
    }

    if (target.closest("[data-slot='popover-content'], [role='dialog'], [role='menu'], [role='listbox']")) {
      return;
    }

    if (optionsRef.current?.shouldIgnoreTarget?.(target)) {
      return;
    }
    startPosRef.current = { x: e.screenX, y: e.screenY };
    hasDraggedRef.current = false;
    isDraggingRef.current = true;
  }, []);

  useEffect(() => {
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDraggingRef.current || !startPosRef.current) return;
      // Stop immediately if the primary button was released over a WebContentsView or outside the window
      if ((e.buttons & 1) === 0) {
        resetDrag();
        return;
      }
      const dx = e.screenX - startPosRef.current.x;
      const dy = e.screenY - startPosRef.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        if (!hasDraggedRef.current) {
          hasDraggedRef.current = true;
          optionsRef.current?.onDragStart?.();
        }
        lumi.interface.moveWindowBy(dx, dy);
        startPosRef.current = { x: e.screenX, y: e.screenY };
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) resetDrag();
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", resetDrag);
    window.addEventListener("pointerup", resetDrag);
    window.addEventListener("pointercancel", resetDrag);
    window.addEventListener("blur", resetDrag);
    window.addEventListener("contextmenu", resetDrag);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", resetDrag);
      window.removeEventListener("pointerup", resetDrag);
      window.removeEventListener("pointercancel", resetDrag);
      window.removeEventListener("blur", resetDrag);
      window.removeEventListener("contextmenu", resetDrag);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [resetDrag]);

  return {
    handleMouseDown,
    hasDraggedRef,
    isDraggingRef
  };
}
