import { IPCListener, WindowState } from "~/lumi/types";

// API //
export interface LumiWindowsAPI {
  /**
   * Opens the settings window (optionally focusing a specific section)
   */
  openSettingsWindow: (section?: string) => void;

  /**
   * Consumes any pending section deep-link requested before Settings finished mounting
   */
  consumePendingSettingsSection: () => Promise<string | null>;

  /**
   * Listens for Settings section navigation requests from other windows
   */
  onSettingsSectionNavigate: IPCListener<[string]>;

  /**
   * Closes the settings window
   */
  closeSettingsWindow: () => void;

  // Generic window controls — work for any internal window (browser, settings, etc.)

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
