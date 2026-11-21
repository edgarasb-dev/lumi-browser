/**
 * Cursor Edge Monitor
 *
 * Polls `screen.getCursorScreenPoint()` in the main process and fires
 * "interface:cursor-at-edge" IPC events to focused browser windows with
 * the current cursor position and edge state.
 *
 * This is needed because tab WebContentsViews sit above the chrome renderer
 * and consume all mouse events, preventing the renderer's document.mousemove
 * from detecting the cursor near the window edge.
 *
 * Events are sent on every poll tick while the cursor is inside the window
 * (plus one final event when it exits) so the renderer has continuous
 * position data for both edge-enter detection and distance-based detach.
 */

import { app, screen } from "electron";
import { windowsController } from "@/controllers/windows-controller";
import { BrowserWindow } from "@/controllers/windows-controller/types/browser";
import type { CursorEdgeEvent, CursorEdgeMonitorMode } from "~/lumi/interfaces/browser/interface";

const TRACK_POLL_MS = 1000 / 30; // ~30 fps when floating sidebar is open & cursor moves
const EDGE_POLL_MS = 50; // 20 Hz lightweight check when sidebar is hidden & waiting for edge trigger
const EDGE_THRESHOLD = 12; // px from edge to trigger

/** Track per-window monitor modes reported by each BrowserWindow's sidebar provider. */
const windowMonitorModes = new Map<number, CursorEdgeMonitorMode>();

/** Track whether the cursor was inside the window / at edge on the last tick. */
const cursorInsideWindow = new Map<number, boolean>();
const lastSentEdgeByWindow = new Map<number, "left" | "right" | null>();

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollIntervalMs: number = EDGE_POLL_MS;
let lastPolledState: {
  windowId: number;
  cursorX: number;
  cursorY: number;
  winX: number;
  winY: number;
  winW: number;
  winH: number;
} | null = null;

function getEdge(localX: number, windowWidth: number): "left" | "right" | null {
  if (localX < EDGE_THRESHOLD) return "left";
  if (localX > windowWidth - EDGE_THRESHOLD) return "right";
  return null;
}

function getFocusedMonitorTarget(): { focused: BrowserWindow; mode: CursorEdgeMonitorMode } | null {
  const focused = windowsController.getFocused();
  if (!focused || !(focused instanceof BrowserWindow) || focused.destroyed) return null;

  const win = focused.browserWindow;
  if (win.isDestroyed() || !win.isFocused() || win.isMinimized()) return null;

  const mode = windowMonitorModes.get(focused.id) ?? "off";
  if (mode === "off") return null;

  return { focused, mode };
}

function poll() {
  const target = getFocusedMonitorTarget();
  if (!target) {
    stopPolling();
    return;
  }

  const { focused, mode } = target;
  const win = focused.browserWindow;
  const cursor = screen.getCursorScreenPoint();
  const bounds = win.getBounds();

  // Deduplicate stationary cursor ticks — zero IPC while mouse is still
  if (
    lastPolledState &&
    lastPolledState.windowId === focused.id &&
    lastPolledState.cursorX === cursor.x &&
    lastPolledState.cursorY === cursor.y &&
    lastPolledState.winX === bounds.x &&
    lastPolledState.winY === bounds.y &&
    lastPolledState.winW === bounds.width &&
    lastPolledState.winH === bounds.height
  ) {
    return;
  }

  lastPolledState = {
    windowId: focused.id,
    cursorX: cursor.x,
    cursorY: cursor.y,
    winX: bounds.x,
    winY: bounds.y,
    winW: bounds.width,
    winH: bounds.height
  };

  // Convert screen coords to window-local coords
  const localX = cursor.x - bounds.x;
  const localY = cursor.y - bounds.y;

  // Be a bit lenient, allow for mouse to be slightly outside of the window bounds
  const leftEdgeExit = EDGE_THRESHOLD * -22;
  const rightEdgeExit = EDGE_THRESHOLD * 22;

  const isInside =
    localX >= leftEdgeExit && localX <= bounds.width + rightEdgeExit && localY >= 0 && localY <= bounds.height;
  const wasInside = cursorInsideWindow.get(focused.id) ?? false;

  if (mode === "edge-only") {
    const edge = isInside ? getEdge(localX, bounds.width) : null;
    const prevEdge = lastSentEdgeByWindow.get(focused.id) ?? null;
    cursorInsideWindow.set(focused.id, isInside);

    if (edge !== null || prevEdge !== null) {
      lastSentEdgeByWindow.set(focused.id, edge);
      sendEvent(focused, { edge, x: localX });
    }
    return;
  }

  // "track" mode (floating sidebar is currently open and needs continuous detach distance)
  if (isInside) {
    cursorInsideWindow.set(focused.id, true);
    const edge = getEdge(localX, bounds.width);
    lastSentEdgeByWindow.set(focused.id, edge);
    sendEvent(focused, { edge, x: localX });
  } else if (wasInside) {
    cursorInsideWindow.set(focused.id, false);
    lastSentEdgeByWindow.set(focused.id, null);
    sendEvent(focused, { edge: null, x: localX });
  }
}

function sendEvent(win: BrowserWindow, event: CursorEdgeEvent) {
  win.sendMessageToCoreWebContents("interface:cursor-at-edge", event);
}

function startPolling(intervalMs: number) {
  if (pollTimer != null && pollIntervalMs === intervalMs) return;
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  pollIntervalMs = intervalMs;
  pollTimer = setInterval(poll, intervalMs);
}

function stopPolling() {
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  lastPolledState = null;
  cursorInsideWindow.clear();
  lastSentEdgeByWindow.clear();
}

function syncPollingState() {
  const target = getFocusedMonitorTarget();
  if (!target) {
    stopPolling();
    return;
  }
  lastPolledState = null;
  startPolling(target.mode === "track" ? TRACK_POLL_MS : EDGE_POLL_MS);
}

export function setWindowCursorEdgeMode(windowId: number, mode: CursorEdgeMonitorMode) {
  if (mode === "off") {
    windowMonitorModes.delete(windowId);
    cursorInsideWindow.delete(windowId);
    lastSentEdgeByWindow.delete(windowId);
  } else {
    windowMonitorModes.set(windowId, mode);
  }
  syncPollingState();
}

/** Call once at app startup to wire up the monitor. */
export function initCursorEdgeMonitor() {
  app.on("browser-window-focus", syncPollingState);
  app.on("browser-window-blur", syncPollingState);

  windowsController.on("window-removed", (_id, window) => {
    if (window instanceof BrowserWindow) {
      windowMonitorModes.delete(window.id);
      cursorInsideWindow.delete(window.id);
      lastSentEdgeByWindow.delete(window.id);
      syncPollingState();
    }
  });
}
