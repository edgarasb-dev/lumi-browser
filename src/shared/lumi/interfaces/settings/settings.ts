import { IPCListener } from "~/lumi/types";
import type { BasicSetting, BasicSettingCard, SettingType } from "~/types/settings";

// API //
export interface LumiSettingsAPI {
  /**
   * Gets the value of a setting
   */
  getSetting<T extends BasicSetting>(settingId: string): Promise<T["defaultValue"]>;

  /**
   * Gets all setting values in a single batched map
   */
  getAllSettings: () => Promise<Record<string, SettingType["defaultValue"]>>;

  /**
   * Sets the value of a setting
   */
  setSetting: (settingId: string, value: unknown) => Promise<boolean>;

  /**
   * Gets the basic settings, cards, and initial setting values
   */
  getBasicSettings: () => Promise<{
    settings: BasicSetting[];
    cards: BasicSettingCard[];
    values: Record<string, SettingType["defaultValue"]>;
  }>;

  /**
   * Listens for changes to the settings */
  onSettingsChanged: IPCListener<[void]>;
}
