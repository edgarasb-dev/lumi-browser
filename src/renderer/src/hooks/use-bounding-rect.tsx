import { useState, useLayoutEffect, RefObject, useRef } from "react";
import { usePortalContext } from "@/components/portal/portal";

/** Number of consecutive stable frames before the rAF loop auto-stops. */
const SETTLE_FRAMES = 3;

/** Default epsilon (in px) for floating-point comparison. */
const DEFAULT_EPSILON = 0.5;

export interface UseBoundingRectOptions {
  /**
   * When `true`, runs a continuous `requestAnimationFrame` loop that never
   * auto-stops. Toggle this on during animations for frame-accurate tracking,
   * and off when the element is static to save resources.
   */
  observingWithLoop?: boolean;

  /**
   * Pixel threshold for change detection.  Differences smaller than this are
   * ignored to suppress sub-pixel float jitter.  Defaults to 0.5.
   */
  epsilon?: number;
}

interface ElementListener {
  epsilon: number;
  observingWithLoop: boolean;
  lastRect: DOMRect | null;
  onRect: (rect: DOMRect) => void;
}

interface ElementTracker {
  element: HTMLElement;
  listeners: Set<ElementListener>;
  ro: ResizeObserver;
  start: () => void;
  cleanup: () => void;
  rafId: number | null;
  running: boolean;
  lastRawRect: DOMRect | null;
  stableFrames: number;
}

const elementTrackers = new WeakMap<HTMLElement, ElementTracker>();

function getOrCreateTracker(el: HTMLElement): ElementTracker {
  const existing = elementTrackers.get(el);
  if (existing) return existing;

  const listeners = new Set<ElementListener>();

  const tracker: ElementTracker = {
    element: el,
    listeners,
    rafId: null,
    running: false,
    lastRawRect: null,
    stableFrames: 0,
    ro: null as unknown as ResizeObserver,
    start: () => {},
    cleanup: () => {}
  };

  const anyLooping = () => {
    for (const listener of listeners) {
      if (listener.observingWithLoop) return true;
    }
    return false;
  };

  const minEpsilon = () => {
    let min = DEFAULT_EPSILON;
    for (const listener of listeners) {
      if (listener.epsilon < min) min = listener.epsilon;
    }
    return min;
  };

  const tick = () => {
    if (listeners.size === 0 || !el.isConnected) {
      tracker.running = false;
      tracker.rafId = null;
      return;
    }

    const next = el.getBoundingClientRect();

    if (rectChanged(tracker.lastRawRect, next, minEpsilon())) {
      tracker.lastRawRect = next;
      tracker.stableFrames = 0;
      for (const listener of listeners) {
        if (rectChanged(listener.lastRect, next, listener.epsilon)) {
          listener.lastRect = next;
          listener.onRect(next);
        }
      }
    } else {
      tracker.stableFrames += 1;
    }

    const keepGoing = anyLooping() || tracker.stableFrames < SETTLE_FRAMES;
    if (keepGoing) {
      tracker.rafId = requestAnimationFrame(tick);
    } else {
      tracker.running = false;
      tracker.rafId = null;
    }
  };

  const start = () => {
    if (tracker.running) {
      tracker.stableFrames = 0;
      return;
    }
    tracker.running = true;
    tracker.stableFrames = 0;
    tracker.rafId = requestAnimationFrame(tick);
  };

  const ro = new ResizeObserver(start);
  ro.observe(el);
  window.addEventListener("scroll", start, { capture: true, passive: true });
  window.addEventListener("resize", start, { passive: true });

  tracker.ro = ro;
  tracker.start = start;
  tracker.cleanup = () => {
    ro.disconnect();
    window.removeEventListener("scroll", start, { capture: true } as EventListenerOptions);
    window.removeEventListener("resize", start);
    if (tracker.rafId != null) {
      cancelAnimationFrame(tracker.rafId);
      tracker.rafId = null;
    }
    tracker.running = false;
    elementTrackers.delete(el);
  };

  elementTrackers.set(el, tracker);
  return tracker;
}

/**
 * Tracks an element's `getBoundingClientRect()` over time, adjusted by the
 * portal offset (if rendered inside a `PortalComponent`).
 *
 * Multiple consumers observing the same target element share a single
 * `ResizeObserver`, scroll/resize listener, and `requestAnimationFrame` burst.
 */
export function useBoundingRect<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: UseBoundingRectOptions = {}
): DOMRect | null {
  const { epsilon = DEFAULT_EPSILON, observingWithLoop = false } = options;

  const { x: portalX, y: portalY } = usePortalContext();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const listenerRef = useRef<ElementListener | null>(null);
  const trackerRef = useRef<ElementTracker | null>(null);

  useLayoutEffect(() => {
    if (listenerRef.current) {
      listenerRef.current.epsilon = epsilon;
      listenerRef.current.observingWithLoop = observingWithLoop;
    }
    if (observingWithLoop && trackerRef.current) {
      trackerRef.current.start();
    }
  }, [epsilon, observingWithLoop]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tracker = getOrCreateTracker(el);
    trackerRef.current = tracker;

    const initial = el.getBoundingClientRect();
    tracker.lastRawRect = initial;
    setRect(initial);

    const listener: ElementListener = {
      epsilon,
      observingWithLoop,
      lastRect: initial,
      onRect: setRect
    };
    listenerRef.current = listener;
    tracker.listeners.add(listener);
    tracker.start();

    return () => {
      tracker.listeners.delete(listener);
      listenerRef.current = null;
      trackerRef.current = null;
      if (tracker.listeners.size === 0) {
        tracker.cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  // ---- portal offset adjustment ----
  // Recompute the final rect only when `rect`, `portalX`, or `portalY` change.
  const finalRect = rect
    ? new DOMRect(rect.x + (portalX ?? 0), rect.y + (portalY ?? 0), rect.width, rect.height)
    : null;

  // Avoid creating a new DOMRect object every render when values haven't
  // actually changed.
  const finalRectRef = useRef<DOMRect | null>(null);
  if (!rectChanged(finalRectRef.current, finalRect, epsilon)) {
    return finalRectRef.current;
  }
  finalRectRef.current = finalRect;
  return finalRect;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns `true` when two rects differ by more than `epsilon` px. */
function rectChanged(a: DOMRect | null, b: DOMRect | null, epsilon: number): boolean {
  if (a == null || b == null) return a !== b;
  return (
    Math.abs(a.x - b.x) > epsilon ||
    Math.abs(a.y - b.y) > epsilon ||
    Math.abs(a.width - b.width) > epsilon ||
    Math.abs(a.height - b.height) > epsilon
  );
}
