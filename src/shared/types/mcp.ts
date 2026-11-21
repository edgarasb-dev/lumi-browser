export type McpAccessMode = "read-only" | "interactive" | "full";

export interface McpConfig {
  enabled: boolean;
  port: number;
  token: string;
  accessMode: McpAccessMode;
  allowedProfileId: string;
  allowExternalJs: boolean;
}

export interface McpActivityEntry {
  id: string;
  timestamp: number;
  method: string;
  toolName?: string;
  summary: string;
  status: "ok" | "denied" | "error";
  durationMs: number;
}

export interface McpClientConfigSnippets {
  endpointUrl: string;
  httpJson: string;
  claudeCodeCommand: string;
  claudeDesktopJson: string;
}

export interface McpServerStatus {
  running: boolean;
  listeningUrl: string | null;
  error: string | null;
  activeSessions: number;
  totalRequests: number;
  config: McpConfig;
  activity: McpActivityEntry[];
  snippets: McpClientConfigSnippets;
}

export interface McpConfigUpdate {
  enabled?: boolean;
  port?: number;
  accessMode?: McpAccessMode;
  allowedProfileId?: string;
  allowExternalJs?: boolean;
}
