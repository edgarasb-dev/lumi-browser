import { ipcMain } from "electron";
import { downloadsController } from "@/controllers/downloads-controller";

ipcMain.handle("downloads:list", async (_event, profileId?: string) => {
  return downloadsController.list(profileId);
});

ipcMain.handle("downloads:pause", async (_event, id: string) => {
  return downloadsController.pause(id);
});

ipcMain.handle("downloads:resume", async (_event, id: string) => {
  return downloadsController.resume(id);
});

ipcMain.handle("downloads:cancel", async (_event, id: string) => {
  return downloadsController.cancel(id);
});

ipcMain.handle("downloads:retry", async (_event, id: string) => {
  return downloadsController.retry(id);
});

ipcMain.handle("downloads:open-file", async (_event, id: string) => {
  return await downloadsController.openFile(id);
});

ipcMain.handle("downloads:show-in-finder", async (_event, id: string) => {
  return await downloadsController.showInFinder(id);
});

ipcMain.handle("downloads:remove", async (_event, id: string) => {
  return downloadsController.remove(id);
});

ipcMain.handle("downloads:clear-completed", async (_event, profileId?: string) => {
  return downloadsController.clearCompleted(profileId);
});

ipcMain.handle("downloads:open-folder", async () => {
  return await downloadsController.openDownloadsFolder();
});
