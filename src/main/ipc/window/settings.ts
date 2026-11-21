import { sendMessageToListeners } from "@/ipc/listeners-manager";
import { BasicSettings, BasicSettingCards } from "@/modules/basic-settings";
import { getAllSettingValues, getSettingValueById, onSettingsCached, setSettingValueById } from "@/saving/settings";
import { settings } from "@/controllers/windows-controller/interfaces/settings";
import { ipcMain } from "electron";

ipcMain.on("settings:open", (_event, section?: string) => {
  void settings.show(section);
});

ipcMain.handle("settings:get-setting", async (_event, settingId: string) => {
  await onSettingsCached();
  return getSettingValueById(settingId);
});

ipcMain.handle("settings:get-all-settings", async () => {
  await onSettingsCached();
  return getAllSettingValues();
});

ipcMain.handle("settings:set-setting", (_event, settingId: string, value: unknown) => {
  return setSettingValueById(settingId, value);
});

ipcMain.handle("settings:get-basic-settings", async () => {
  await onSettingsCached();
  return {
    settings: BasicSettings,
    cards: BasicSettingCards,
    values: getAllSettingValues()
  };
});

export function fireOnSettingsChanged() {
  sendMessageToListeners("settings:on-changed");
}
