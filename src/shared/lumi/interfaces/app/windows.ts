import { IPCListener, WindowState } from "~/lumi/types";

// API //
export interface LumiWindowsAPI {
  /**
   * Opens or focuses the Settings tab (`lumi://settings`), optionally navigating to a section
   */
  openSettings: (section?: string) => void;

  /**
   * Listens for Settings section navigation requests from the app menu or main process
   */
  onSettingsSectionNavigate: IPCListener<[string]>;

  // Generic window controls — work for any internal window (browser, onboarding, etc.)

  /**
   * Minimizes the current window
   */
  minimizeCurrentWindow: () => void;

  /**
   * Toggles maximize/restore on the current window
   */
  maximizeCurrentWindow: () => void;

  /**
   * Closes the current window
   */
  closeCurrentWindow: () => void;

  /**
   * Gets the current window's state (maximized, fullscreen)
   */
  getCurrentWindowState: () => Promise<WindowState>;

  /**
   * Listens for window state changes on the current window
   */
  onCurrentWindowStateChanged: IPCListener<[WindowState]>;
}
