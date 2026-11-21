import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { spacesController } from "@/controllers/spaces-controller";
import { profilesController } from "@/controllers/profiles-controller";
import {
  executeBrowserImport,
  importBookmarksHtmlFile,
  previewBrowserProfile,
  scanInstalledBrowsers
} from "@/modules/importer";
import type { PrivacySettingsPane } from "~/lumi/interfaces/settings/importer";
import type { BrowserImportRequest } from "~/types/importer";

async function resolveDefaultProfileId(sender: Electron.WebContents): Promise<string> {
  const win = browserWindowsController.getWindowFromWebContents(sender);
  if (win?.currentSpaceId) {
    const space = await spacesController.get(win.currentSpaceId);
    if (space?.profileId) return space.profileId;
  }

  const allProfiles = await profilesController.getAll();
  const primary = allProfiles.find((p) => !p.internal);
  return primary?.id ?? "main";
}

ipcMain.handle("importer:scan-browsers", async () => {
  return scanInstalledBrowsers();
});

ipcMain.handle(
  "importer:preview-profile",
  async (event, browserId: string, profileId: string, targetProfileId?: string) => {
    const effectiveTargetProfileId = targetProfileId || (await resolveDefaultProfileId(event.sender));
    return previewBrowserProfile(browserId, profileId, effectiveTargetProfileId);
  }
);

ipcMain.handle("importer:import-browser", async (event, request: BrowserImportRequest) => {
  const fallbackProfileId = await resolveDefaultProfileId(event.sender);
  return executeBrowserImport(request, fallbackProfileId);
});

ipcMain.handle("importer:import-html", async (event) => {
  const parentWin = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow() ?? undefined;
  const dialogOptions: Electron.OpenDialogOptions = {
    title: "Import Bookmarks HTML",
    properties: ["openFile"],
    filters: [{ name: "HTML Bookmarks", extensions: ["html", "htm"] }]
  };

  const selection = parentWin
    ? await dialog.showOpenDialog(parentWin, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (selection.canceled || selection.filePaths.length === 0) {
    return { canceled: true, importedBookmarks: 0 };
  }

  const filePath = selection.filePaths[0];
  try {
    const importedBookmarks = await importBookmarksHtmlFile(filePath);
    return { canceled: false, filePath, importedBookmarks };
  } catch (error) {
    return {
      canceled: false,
      filePath,
      importedBookmarks: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

ipcMain.handle("importer:open-privacy-settings", async (_event, pane: PrivacySettingsPane = "fullDisk") => {
  if (process.platform !== "darwin") {
    return false;
  }

  const query = pane === "filesAndFolders" ? "Privacy_FilesAndFolders" : "Privacy_AllFiles";
  await shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${query}`, {
    activate: true
  });
  return true;
});
