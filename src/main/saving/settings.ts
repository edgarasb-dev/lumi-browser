import { app, nativeTheme } from "electron";
import { DataStoreData, getDatastore } from "./datastore";
import { fireOnSettingsChanged } from "@/ipc/window/settings";
import { BasicSettings } from "@/modules/basic-settings";
import { TypedEventEmitter } from "@/modules/typed-event-emitter";
import { BasicSetting, SettingType } from "~/types/settings";

function applyInterfaceTheme(theme: unknown) {
  if (theme !== "system" && theme !== "light" && theme !== "dark") return;
  const apply = () => {
    nativeTheme.themeSource = theme;
  };
  if (app.isReady()) {
    apply();
  } else {
    void app.whenReady().then(apply);
  }
}

export const SettingsDataStore = getDatastore("settings");

type SettingsEvents = {
  "settings-changed": [];
};
export const settingsEmitter = new TypedEventEmitter<SettingsEvents>();

// Settings: Settings Config //
const basicSettingsCurrentValues: Record<string, SettingType["defaultValue"]> = {};

function validateSettingValue<T extends SettingType>(setting: T, value: unknown) {
  if (setting.type === "boolean") {
    return typeof value === "boolean";
  }
  if (setting.type === "enum") {
    return setting.options.some((option) => option.id === value);
  }
  return false;
}

// Cache Settings //
const settingsCachedPromise = SettingsDataStore.getFullData()
  .catch(() => ({}) as DataStoreData)
  .then((allData) => {
    for (const setting of BasicSettings) {
      const value = allData[setting.id];
      if (value !== undefined && validateSettingValue(setting, value)) {
        basicSettingsCurrentValues[setting.id] = value;
      } else {
        basicSettingsCurrentValues[setting.id] = setting.defaultValue;
      }
    }
    applyInterfaceTheme(basicSettingsCurrentValues["interfaceTheme"]);
  });

export const onSettingsCached = () => settingsCachedPromise;

// Export: Get Setting //
export function getSettingValueById(settingId: string): SettingType["defaultValue"] {
  return basicSettingsCurrentValues[settingId];
}

export function getAllSettingValues(): Record<string, SettingType["defaultValue"]> {
  return { ...basicSettingsCurrentValues };
}

// Export: Set Setting //
async function setSettingValue<T extends BasicSetting>(setting: T, value: unknown) {
  if (validateSettingValue(setting, value)) {
    const saveSuccess = await SettingsDataStore.set(setting.id, value)
      .then(() => true)
      .catch(() => false);

    if (saveSuccess) {
      basicSettingsCurrentValues[setting.id] = value as T["defaultValue"];
      if (setting.id === "interfaceTheme") {
        applyInterfaceTheme(value);
      }
      fireOnSettingsChanged();
      settingsEmitter.emit("settings-changed");
      return true;
    }
  }
  return false;
}

export async function setSettingValueById(settingId: string, value: unknown) {
  const setting = BasicSettings.find((setting) => setting.id === settingId);
  if (setting) {
    return setSettingValue(setting, value);
  }
  return false;
}
