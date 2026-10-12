import { ipcMain } from "electron";
import { sendMessageToListeners } from "@/ipc/listeners-manager";
import {
  getAllSearchEngines,
  getDefaultSearchEngine,
  setDefaultSearchEngine,
  addSearchEngine,
  updateSearchEngine,
  deleteSearchEngine,
  resetSearchEngines,
  searchEnginesEmitter,
  onSearchEnginesLoaded
} from "@/saving/search-engines";
import type { SearchEngineInput } from "~/types/search-engines";

searchEnginesEmitter.on("search-engines-changed", (engines) => {
  sendMessageToListeners("search-engines:on-changed", engines);
});

ipcMain.handle("search-engines:get-all", async () => {
  await onSearchEnginesLoaded();
  return getAllSearchEngines();
});

ipcMain.handle("search-engines:get-default", async () => {
  await onSearchEnginesLoaded();
  return getDefaultSearchEngine();
});

ipcMain.handle("search-engines:set-default", async (_event, id: string) => {
  return await setDefaultSearchEngine(id);
});

ipcMain.handle("search-engines:add", async (_event, engine: SearchEngineInput) => {
  return await addSearchEngine(engine);
});

ipcMain.handle("search-engines:update", async (_event, id: string, engine: Partial<SearchEngineInput>) => {
  return await updateSearchEngine(id, engine);
});

ipcMain.handle("search-engines:delete", async (_event, id: string) => {
  return await deleteSearchEngine(id);
});

ipcMain.handle("search-engines:reset", async () => {
  return await resetSearchEngines();
});
