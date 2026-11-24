import { AttachedDirection, useBrowserSidebar } from "./provider";
import { SidebarWindowControlsMacOS } from "@/components/browser-ui/window-controls/macos";
import { usePlatform } from "@/components/main/platform";
import { AddressBar } from "./_components/address-bar";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSpaces } from "@/components/providers/spaces-provider";
import { cn } from "@/lib/utils";
import { NavigationControls, NavButton } from "@/components/browser-ui/browser-sidebar/_components/navigation-controls";
import { SlotMachineGuard } from "@/components/browser-ui/browser-sidebar/_components/pin-grid/slot-machine/guard";
import {
  SlotMachinePinGrid,
  resetSlotMachine
} from "@/components/browser-ui/browser-sidebar/_components/pin-grid/slot-machine/main";
import { SpacePagesCarousel } from "@/components/browser-ui/browser-sidebar/_components/space-pages-carousel";
import { McpStatusPill } from "@/components/browser-ui/browser-sidebar/_components/mcp-status-pill";
import { UpdateBanner } from "@/components/browser-ui/browser-sidebar/_components/update-banner";
import { BottomDock } from "@/components/browser-ui/browser-sidebar/_components/bottom/bottom-dock";
import { MediaMiniPlayer } from "@/components/browser-ui/media-mini-player";
import { useWindowDrag } from "@/hooks/use-window-drag";
import { shouldIgnoreWindowDragTarget } from "@/lib/chrome-interactions";

const SIDEBAR_WHEEL_IDLE_GAP_MS = 200;
const SIDEBAR_WHEEL_SWITCH_THRESHOLD = 70;
const SIDEBAR_WHEEL_COOLDOWN_MS = 420;
const SIDEBAR_WHEEL_DRAIN_IDLE_MS = 160;
const SIDEBAR_WHEEL_DRAIN_MAX_MS = 1200;

function hasHorizontalScrollableAncestor(target: Element, boundary: HTMLElement): boolean {
  let el: Element | null = target;
  while (el && el !== boundary) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflowX = window.getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") {
        return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

function SidebarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x={4.625} y={3.75} width={30.75} height={24.5} rx={4.75} ry={4.75} />
      <path strokeLinecap="square" d="M15.25 5v22" />
      <path strokeWidth={2} d="M9 9.5h2M9 13.5h2M9 17.5h2" />
    </svg>
  );
}

export function SidebarInner({ direction }: { direction: AttachedDirection }) {
  const { isAnimating, setVisible, mode, slotMachineEnabled, setSlotMachineEnabled } = useBrowserSidebar();
  const { platform } = usePlatform();

  const { spaces, currentSpace, setCurrentSpace, isCurrentSpaceInternal, isCurrentSpaceLight } = useSpaces();
  const sidebarRootRef = useRef<HTMLDivElement>(null);
  const drainStateRef = useRef({
    draining: false,
    minUntil: 0,
    hardMaxUntil: 0,
    lastEventAt: 0
  });

  const { handleMouseDown } = useWindowDrag({
    shouldIgnoreTarget: shouldIgnoreWindowDragTarget
  });

  useEffect(() => {
    const root = sidebarRootRef.current;
    if (!root || isCurrentSpaceInternal || spaces.length <= 1 || !currentSpace) return;

    let lastWheelAt = 0;
    let accumX = 0;
    let eventCount = 0;
    let burstLockedOut = false;

    const resetBurst = () => {
      accumX = 0;
      eventCount = 0;
      burstLockedOut = false;
    };

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.deltaMode !== 0) {
        return;
      }

      if (event.target instanceof Element) {
        if (
          event.target.closest(
            "[data-space-carousel], [data-slot='popover-content'], [role='dialog'], [role='menu'], input, textarea"
          )
        ) {
          return;
        }
        if (hasHorizontalScrollableAncestor(event.target, root)) {
          return;
        }
      }

      const now = performance.now();
      const drain = drainStateRef.current;
      if (drain.draining) {
        const pastHardMax = now >= drain.hardMaxUntil;
        const pastMinAndIdle = now >= drain.minUntil && now - drain.lastEventAt > SIDEBAR_WHEEL_DRAIN_IDLE_MS;
        if (pastHardMax || pastMinAndIdle) {
          drain.draining = false;
        } else {
          drain.lastEventAt = now;
          return;
        }
      }

      if (now - lastWheelAt > SIDEBAR_WHEEL_IDLE_GAP_MS) {
        resetBurst();
      }
      lastWheelAt = now;

      if (burstLockedOut) return;

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      if (absX < 1 && absY < 1) return;

      if (absY > absX * 0.75 || (eventCount === 0 && absX < 1.5)) {
        burstLockedOut = true;
        accumX = 0;
        eventCount = 0;
        return;
      }

      const clampedDx = Math.max(-50, Math.min(50, event.deltaX));
      accumX += clampedDx;
      eventCount += 1;

      if (Math.abs(accumX) >= SIDEBAR_WHEEL_SWITCH_THRESHOLD && eventCount >= 2) {
        const currentIndex = spaces.findIndex((s) => s.id === currentSpace.id);
        const delta = accumX > 0 ? 1 : -1;
        const nextIndex = currentIndex + delta;

        accumX = 0;
        eventCount = 0;
        drainStateRef.current = {
          draining: true,
          minUntil: now + SIDEBAR_WHEEL_COOLDOWN_MS,
          hardMaxUntil: now + SIDEBAR_WHEEL_DRAIN_MAX_MS,
          lastEventAt: now
        };

        if (currentIndex !== -1 && nextIndex >= 0 && nextIndex < spaces.length) {
          setCurrentSpace(spaces[nextIndex].id);
        }
      }
    };

    root.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      root.removeEventListener("wheel", onWheel);
    };
  }, [spaces, currentSpace, setCurrentSpace, isCurrentSpaceInternal]);

  const handleSetSlotMachine = useCallback(
    (enabled: boolean) => {
      if (!enabled) resetSlotMachine();
      setSlotMachineEnabled(enabled);
    },
    [setSlotMachineEnabled]
  );

  const spaceInjectedClasses = useMemo(() => cn(isCurrentSpaceLight ? "" : "dark"), [isCurrentSpaceLight]);

  return (
    <div
      ref={sidebarRootRef}
      onMouseDown={handleMouseDown}
      className={cn(spaceInjectedClasses, "h-full max-h-full flex flex-col overflow-hidden")}
    >
      {/* Top Section */}
      <div className="shrink-0 flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-1.5">
          {direction === "left" && platform === "darwin" && <SidebarWindowControlsMacOS isAnimating={isAnimating} />}
          <NavButton
            icon={<SidebarIcon className="size-5.5" />}
            onClick={() => setVisible(!mode.startsWith("attached"))}
          />
        </div>
        <NavigationControls />
      </div>
      {/* Middle Section */}
      <div className="flex-1 min-h-0 gap-2 flex flex-col overflow-hidden">
        <AddressBar />
        <SlotMachineGuard passed={slotMachineEnabled} setPassed={handleSetSlotMachine} />
        {slotMachineEnabled && <SlotMachinePinGrid />}
        <SpacePagesCarousel />
      </div>
      {/* MCP Activity, Update Banner & Live Media Mini-Player */}
      <McpStatusPill />
      <UpdateBanner />
      <MediaMiniPlayer variant="sidebar" />
      {/* Bottom Dock Section */}
      <BottomDock />
    </div>
  );
}
