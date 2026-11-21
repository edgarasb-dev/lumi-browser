import type { McpConfigUpdate, McpServerStatus } from "~/types/mcp";

export interface LumiMcpAPI {
  getStatus: () => Promise<McpServerStatus>;
  setEnabled: (enabled: boolean) => Promise<McpServerStatus>;
  updateConfig: (updates: McpConfigUpdate) => Promise<McpServerStatus>;
  rotateToken: () => Promise<McpServerStatus>;
  clearActivity: () => Promise<McpServerStatus>;
  onStatusChanged: (callback: (status: McpServerStatus) => void) => () => void;
}
