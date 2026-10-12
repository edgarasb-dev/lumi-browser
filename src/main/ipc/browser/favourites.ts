import { ipcMain } from "electron";
import { sendMessageToListeners } from "@/ipc/listeners-manager";
import { getAllFavourites, addFavourite, removeFavourite, isFavourite, favouritesEmitter } from "@/saving/favourites";

favouritesEmitter.on("favourites-changed", (favourites) => {
  sendMessageToListeners("favourites:on-changed", favourites);
});

ipcMain.handle("favourites:get-all", async () => {
  return await getAllFavourites();
});

ipcMain.handle("favourites:add", async (_event, title: string, url: string, faviconURL?: string | null) => {
  return await addFavourite(title, url, faviconURL);
});

ipcMain.handle("favourites:remove", async (_event, idOrUrl: string) => {
  return await removeFavourite(idOrUrl);
});

ipcMain.handle("favourites:is-favourite", async (_event, url: string) => {
  return await isFavourite(url);
});
