import { ipcMain } from "electron";
import { mcpController } from "@/controllers/mcp-controller";
import type { McpConfigUpdate } from "~/types/mcp";

ipcMain.handle("mcp:get-status", async () => {
  return mcpController.getStatus();
});

ipcMain.handle("mcp:set-enabled", async (_event, enabled: boolean) => {
  return mcpController.setEnabled(Boolean(enabled));
});

ipcMain.handle("mcp:update-config", async (_event, updates: McpConfigUpdate) => {
  return mcpController.updateConfig(updates ?? {});
});

ipcMain.handle("mcp:rotate-token", async () => {
  return mcpController.rotateToken();
});

ipcMain.handle("mcp:clear-activity", async () => {
  return mcpController.clearActivity();
});
