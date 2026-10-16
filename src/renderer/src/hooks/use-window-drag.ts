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

  const handleMouseDown = useCallback((e: MouseEvent<HTMLElement>) => {
    // Only primary (left) button
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
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

    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
      startPosRef.current = null;
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  return {
    handleMouseDown,
    hasDraggedRef,
    isDraggingRef
  };
}
