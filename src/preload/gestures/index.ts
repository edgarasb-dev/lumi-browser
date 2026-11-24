import { ipcRenderer } from "electron";

type GestureDirection = "back" | "forward";

interface GestureNavigationState {
  enabled: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface ActiveGesture {
  id: number;
  direction: GestureDirection;
  progress: number;
  eventCount: number;
  canNavigate: boolean;
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "file:", "lumi:"]);
const SVG_NS = "http://www.w3.org/2000/svg";

const GESTURE_IDLE_GAP_MS = 220;
const SETTLE_COMMIT_MS = 95;
const HORIZ_SCROLL_SUPPRESS_MS = 350;
const PER_EVENT_DELTA_CLAMP = 45;
const MIN_EVENT_COUNT = 3;
const SHOW_THRESHOLD = 16;
const READY_THRESHOLD = 110;
const INSTANT_COMMIT_THRESHOLD = 220;
const INSTANT_COMMIT_MIN_EVENTS = 5;
const MOMENTUM_DRAIN_IDLE_MS = 180;
const MOMENTUM_MIN_COOLDOWN_MS = 450;
const MOMENTUM_MAX_COOLDOWN_MS = 1500;

let installed = false;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveStartElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return document.documentElement;
}

function getNextAncestorCrossingShadow(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  if (root instanceof ShadowRoot && root.host instanceof Element) {
    return root.host;
  }
  return null;
}

/**
 * Walks ancestors (crossing open shadow roots) to respect CSS `overscroll-behavior-x`
 * and horizontally scrollable containers before allowing gesture history navigation.
 */
function inspectHorizontalScrollChain(
  startTarget: EventTarget | null,
  direction: GestureDirection
): "allow" | "blocked" {
  const scrollingEl = document.scrollingElement;
  let visitedDocEl = false;
  let visitedBody = false;

  const checkElement = (node: Element): "allow" | "blocked" => {
    if (node === document.documentElement) visitedDocEl = true;
    if (node === document.body) visitedBody = true;

    const style = window.getComputedStyle(node);
    if (style.overscrollBehaviorX === "none") {
      return "blocked";
    }

    const isRoot = node === document.documentElement || node === document.body || node === scrollingEl;
    const hasOverflow = node.scrollWidth > node.clientWidth + 1;
    const canScrollAxis = isRoot
      ? hasOverflow && style.overflowX !== "hidden" && style.overflowX !== "clip"
      : hasOverflow && (style.overflowX === "auto" || style.overflowX === "scroll" || style.overflowX === "overlay");

    if (style.overscrollBehaviorX === "contain" && (isRoot || canScrollAxis)) {
      return "blocked";
    }

    if (canScrollAxis) {
      const maxScroll = node.scrollWidth - node.clientWidth;
      const isRtl = style.direction === "rtl";
      const canScrollLeft = isRtl ? node.scrollLeft > -maxScroll + 1 : node.scrollLeft > 1;
      const canScrollRight = isRtl ? node.scrollLeft < -1 : node.scrollLeft < maxScroll - 1;

      if ((direction === "back" && canScrollLeft) || (direction === "forward" && canScrollRight)) {
        return "blocked";
      }
    }

    return "allow";
  };

  let el = resolveStartElement(startTarget);
  while (el) {
    if (checkElement(el) === "blocked") {
      return "blocked";
    }
    el = getNextAncestorCrossingShadow(el);
  }

  if (!visitedBody && document.body && checkElement(document.body) === "blocked") {
    return "blocked";
  }
  if (!visitedDocEl && document.documentElement && checkElement(document.documentElement) === "blocked") {
    return "blocked";
  }

  return "allow";
}

function createChevronSvg(direction: GestureDirection): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.25");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", direction === "back" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6");
  svg.appendChild(path);
  return svg;
}

const INDICATOR_CSS = `
:host {
  all: initial !important;
  position: fixed !important;
  inset: 0 !important;
  pointer-events: none !important;
  z-index: 2147483647 !important;
  user-select: none !important;
}

.pill {
  position: fixed;
  top: 50%;
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  pointer-events: none;
  will-change: transform, opacity;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.78);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.85);
  color: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  transition:
    background-color 140ms ease,
    color 140ms ease,
    border-color 140ms ease,
    box-shadow 140ms ease;
}

.pill.ready {
  background: rgba(15, 23, 42, 0.86);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.26);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(255, 255, 255, 0.16);
}

.pill.committing {
  transition:
    transform 160ms ease-out,
    opacity 160ms ease-out !important;
}

.pill.cancelling {
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms ease-out !important;
}

@media (prefers-color-scheme: dark) {
  .pill {
    background: rgba(28, 30, 36, 0.74);
    border: 1px solid rgba(255, 255, 255, 0.16);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.14);
    color: rgba(248, 250, 252, 0.94);
  }

  .pill.ready {
    background: rgba(248, 250, 252, 0.92);
    color: #0f172a;
    border-color: rgba(255, 255, 255, 0.7);
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.5);
  }
}
`;

/**
 * Lazily renders a closed-Shadow-DOM Liquid Glass chevron pill on screen edges
 * only while an eligible horizontal navigation swipe is in progress.
 */
class EdgeSwipeIndicator {
  private host: HTMLDivElement | null = null;
  private pill: HTMLDivElement | null = null;
  private svg: SVGSVGElement | null = null;
  private activeDirection: GestureDirection | null = null;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  private clearCleanupTimer(): void {
    if (this.cleanupTimer !== null) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private ensureMounted(direction: GestureDirection): void {
    this.clearCleanupTimer();

    if (!this.host || !this.pill || !this.host.isConnected) {
      this.destroyImmediate();

      const mountTarget = document.documentElement;
      if (!mountTarget) return;

      const host = document.createElement("div");
      host.setAttribute("data-lumi-swipe-indicator", "");
      const shadow = host.attachShadow({ mode: "closed" });

      const style = document.createElement("style");
      style.textContent = INDICATOR_CSS;

      const pill = document.createElement("div");
      pill.className = "pill";

      shadow.appendChild(style);
      shadow.appendChild(pill);
      mountTarget.appendChild(host);

      this.host = host;
      this.pill = pill;
      this.activeDirection = null;
    }

    const pill = this.pill;
    if (!pill) return;

    pill.classList.remove("committing", "cancelling");

    if (this.activeDirection !== direction || !this.svg) {
      this.activeDirection = direction;
      if (this.svg) {
        this.svg.remove();
      }
      const nextSvg = createChevronSvg(direction);
      pill.appendChild(nextSvg);
      this.svg = nextSvg;

      if (direction === "back") {
        pill.style.left = "0";
        pill.style.right = "auto";
      } else {
        pill.style.right = "0";
        pill.style.left = "auto";
      }
    }
  }

  public update(direction: GestureDirection, progress: number): void {
    if (progress < SHOW_THRESHOLD) return;

    this.ensureMounted(direction);
    const pill = this.pill;
    if (!pill) return;

    const rawT = clamp((progress - SHOW_THRESHOLD) / (READY_THRESHOLD - SHOW_THRESHOLD), 0, 1);
    const eased = 1 - Math.pow(1 - rawT, 2);
    const tx = direction === "back" ? -48 + eased * 68 : 48 - eased * 68;
    const isReady = progress >= READY_THRESHOLD;
    const scale = isReady ? 1.08 : 0.88 + eased * 0.12;
    const opacity = clamp(0.35 + rawT * 0.65, 0, 1);

    pill.classList.toggle("ready", isReady);
    pill.style.transform = `translate3d(${tx.toFixed(1)}px, -50%, 0) scale(${scale.toFixed(3)})`;
    pill.style.opacity = opacity.toFixed(3);
  }

  public commit(direction: GestureDirection): void {
    if (!this.pill || !this.host?.isConnected) {
      this.destroyImmediate();
      return;
    }

    const pill = this.pill;
    this.clearCleanupTimer();
    void pill.offsetWidth;
    pill.classList.remove("cancelling");
    pill.classList.add("ready", "committing");
    const tx = direction === "back" ? 28 : -28;
    pill.style.transform = `translate3d(${tx}px, -50%, 0) scale(1.18)`;
    pill.style.opacity = "0";

    this.cleanupTimer = setTimeout(() => {
      this.destroyImmediate();
    }, 180);
  }

  public cancel(): void {
    if (!this.pill || !this.host?.isConnected) {
      this.destroyImmediate();
      return;
    }

    const pill = this.pill;
    const direction = this.activeDirection ?? "back";
    this.clearCleanupTimer();
    void pill.offsetWidth;
    pill.classList.remove("ready", "committing");
    pill.classList.add("cancelling");
    const tx = direction === "back" ? -48 : 48;
    pill.style.transform = `translate3d(${tx}px, -50%, 0) scale(0.85)`;
    pill.style.opacity = "0";

    this.cleanupTimer = setTimeout(() => {
      this.destroyImmediate();
    }, 200);
  }

  public destroyImmediate(): void {
    this.clearCleanupTimer();
    if (this.host) {
      this.host.remove();
    }
    this.host = null;
    this.pill = null;
    this.svg = null;
    this.activeDirection = null;
  }
}

/**
 * Installs top-level trackpad two-finger horizontal overscroll swipe recognition
 * (Back / Forward) on navigable web and `lumi://` tab documents.
 */
export function tryPatchTrackpadGestures(): boolean {
  if (installed) return true;
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  try {
    if (window !== window.top) return false;
  } catch {
    return false;
  }

  if (!ALLOWED_PROTOCOLS.has(window.location.protocol)) {
    return false;
  }

  installed = true;

  const indicator = new EdgeSwipeIndicator();
  const prevScrollLeft = new WeakMap<Element, number>();

  let lastHorizontalScrollAt = 0;
  let lastWheelAt = 0;
  let burstLockedOut = false;
  let gestureSeq = 0;
  let activeGesture: ActiveGesture | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  let drainingMomentum = false;
  let drainMinUntil = 0;
  let drainHardMaxUntil = 0;
  let drainIdleTimer: ReturnType<typeof setTimeout> | null = null;

  const clearSettleTimer = () => {
    if (settleTimer !== null) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  };

  const clearDrainTimer = () => {
    if (drainIdleTimer !== null) {
      clearTimeout(drainIdleTimer);
      drainIdleTimer = null;
    }
  };

  const stopMomentumDrain = () => {
    clearDrainTimer();
    drainingMomentum = false;
    drainMinUntil = 0;
    drainHardMaxUntil = 0;
  };

  const scheduleMomentumDrainCheck = (now: number) => {
    clearDrainTimer();
    const minRemaining = Math.max(0, drainMinUntil - now);
    const delay = Math.max(MOMENTUM_DRAIN_IDLE_MS, minRemaining);
    const maxRemaining = Math.max(0, drainHardMaxUntil - now);
    const boundedDelay = Math.min(delay, maxRemaining);

    drainIdleTimer = setTimeout(() => {
      drainIdleTimer = null;
      const currentNow = performance.now();
      if (currentNow < drainMinUntil && currentNow < drainHardMaxUntil) {
        scheduleMomentumDrainCheck(currentNow);
        return;
      }
      stopMomentumDrain();
    }, boundedDelay);
  };

  const beginMomentumDrain = (now: number) => {
    drainingMomentum = true;
    drainMinUntil = now + MOMENTUM_MIN_COOLDOWN_MS;
    drainHardMaxUntil = now + MOMENTUM_MAX_COOLDOWN_MS;
    scheduleMomentumDrainCheck(now);
  };

  const cancelActiveGesture = (animateIndicator = true) => {
    clearSettleTimer();
    const hadGesture = activeGesture !== null;
    activeGesture = null;
    if (hadGesture && animateIndicator) {
      indicator.cancel();
    } else if (!animateIndicator) {
      indicator.destroyImmediate();
    }
  };

  const commitActiveGesture = (now: number) => {
    if (!activeGesture || !activeGesture.canNavigate) {
      cancelActiveGesture(true);
      return;
    }

    const direction = activeGesture.direction;
    clearSettleTimer();
    activeGesture = null;
    beginMomentumDrain(now);
    indicator.commit(direction);
    ipcRenderer.send("navigation:gesture-navigate", direction);
  };

  const onScroll = (event: Event) => {
    const el =
      event.target === document ? document.scrollingElement : event.target instanceof Element ? event.target : null;
    if (!el) return;

    const current = el.scrollLeft;
    const prev = prevScrollLeft.get(el);
    prevScrollLeft.set(el, current);
    if (prev !== undefined && Math.abs(current - prev) > 0.5) {
      lastHorizontalScrollAt = performance.now();
    }
  };

  const onWheel = (event: WheelEvent) => {
    const now = performance.now();

    if (event.defaultPrevented) {
      cancelActiveGesture(true);
      burstLockedOut = true;
      lastWheelAt = now;
      return;
    }

    // Pinch-to-zoom arrives on Chromium as ctrlKey wheel events; never hijack it.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      cancelActiveGesture(true);
      return;
    }

    if (event.deltaMode !== 0) {
      return;
    }

    if (drainingMomentum) {
      if (now >= drainHardMaxUntil) {
        stopMomentumDrain();
      } else {
        lastWheelAt = now;
        scheduleMomentumDrainCheck(now);
        return;
      }
    }

    if (now - lastWheelAt > GESTURE_IDLE_GAP_MS) {
      burstLockedOut = false;
      if (activeGesture) {
        cancelActiveGesture(true);
      }
    }
    lastWheelAt = now;

    if (burstLockedOut) {
      return;
    }

    if (!activeGesture) {
      if (now - lastHorizontalScrollAt < HORIZ_SCROLL_SUPPRESS_MS) {
        burstLockedOut = true;
        return;
      }

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      if (absX < 1 && absY < 1) {
        return;
      }

      if (absY > absX * 0.85 || absX < 1.5) {
        burstLockedOut = true;
        return;
      }

      const direction: GestureDirection = event.deltaX < 0 ? "back" : "forward";
      if (inspectHorizontalScrollChain(event.target, direction) === "blocked") {
        burstLockedOut = true;
        return;
      }

      const seq = ++gestureSeq;
      activeGesture = {
        id: seq,
        direction,
        progress: 0,
        eventCount: 0,
        canNavigate: false
      };

      void ipcRenderer
        .invoke("navigation:get-gesture-state")
        .then((state: GestureNavigationState | null) => {
          if (!activeGesture || activeGesture.id !== seq) return;
          const allowed = Boolean(state?.enabled && (direction === "back" ? state.canGoBack : state.canGoForward));
          if (!allowed) {
            cancelActiveGesture(false);
            burstLockedOut = true;
            return;
          }

          activeGesture.canNavigate = true;
          if (activeGesture.progress >= SHOW_THRESHOLD) {
            indicator.update(activeGesture.direction, activeGesture.progress);
          }
        })
        .catch(() => {
          if (activeGesture?.id === seq) {
            cancelActiveGesture(false);
            burstLockedOut = true;
          }
        });
    }

    if (!activeGesture) {
      return;
    }

    if (activeGesture.progress < SHOW_THRESHOLD) {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX) * 1.15) {
        cancelActiveGesture(true);
        burstLockedOut = true;
        return;
      }

      if (inspectHorizontalScrollChain(event.target, activeGesture.direction) === "blocked") {
        cancelActiveGesture(true);
        burstLockedOut = true;
        return;
      }
    }

    const clampedDx = clamp(event.deltaX, -PER_EVENT_DELTA_CLAMP, PER_EVENT_DELTA_CLAMP);
    const signedDelta = activeGesture.direction === "back" ? -clampedDx : clampedDx;
    activeGesture.progress = Math.max(0, activeGesture.progress + signedDelta);
    activeGesture.eventCount += 1;

    if (activeGesture.canNavigate) {
      indicator.update(activeGesture.direction, activeGesture.progress);

      if (activeGesture.progress >= INSTANT_COMMIT_THRESHOLD && activeGesture.eventCount >= INSTANT_COMMIT_MIN_EVENTS) {
        commitActiveGesture(now);
        return;
      }
    }

    clearSettleTimer();
    const expectedGestureId = activeGesture.id;
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (!activeGesture || activeGesture.id !== expectedGestureId) return;

      if (
        activeGesture.canNavigate &&
        activeGesture.progress >= READY_THRESHOLD &&
        activeGesture.eventCount >= MIN_EVENT_COUNT
      ) {
        commitActiveGesture(performance.now());
      } else {
        cancelActiveGesture(true);
      }
    }, SETTLE_COMMIT_MS);
  };

  const resetOnLifecycleInterruption = () => {
    clearSettleTimer();
    stopMomentumDrain();
    activeGesture = null;
    burstLockedOut = false;
    indicator.destroyImmediate();
  };

  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  window.addEventListener("wheel", onWheel, { capture: false, passive: true });
  window.addEventListener("pagehide", resetOnLifecycleInterruption);
  window.addEventListener("blur", resetOnLifecycleInterruption);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resetOnLifecycleInterruption();
    }
  });

  return true;
}
