// This is for other controllers to interface with the settings window
import { windowsController } from "@/controllers/windows-controller";

const settingsWindowManager = () => windowsController.settings;
let pendingSection: string | null = null;

export const settings = {
  show: async (section?: string) => {
    if (section) {
      pendingSection = section;
    }
    const existing = settingsWindowManager().getExistingSingletonWindow();
    const window = existing ?? settingsWindowManager().getSingletonWindow();
    if (existing && section) {
      existing.sendMessage("settings:navigate-section", section);
    }
    await window.show(true);
  },
  consumePendingSection: () => {
    const next = pendingSection;
    pendingSection = null;
    return next;
  },
  hide: () => {
    const window = settingsWindowManager().getExistingSingletonWindow();
    if (!window) return;
    window.destroy();
  },
  isVisible: () => {
    const window = settingsWindowManager().getExistingSingletonWindow();
    if (!window) return false;
    return window.isVisible();
  },
  toggle: () => {
    if (settings.isVisible()) {
      settings.hide();
    } else {
      settings.show();
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendMessage: (channel: string, ...args: any[]) => {
    const window = settingsWindowManager().getExistingSingletonWindow();
    if (!window) return;
    window.sendMessage(channel, ...args);
  }
};
