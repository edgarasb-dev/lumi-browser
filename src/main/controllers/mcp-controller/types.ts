import type { McpConfig } from "~/types/mcp";

export type McpToolScope = "read" | "interactive" | "full";

export type McpTextContent = {
  type: "text";
  text: string;
};

export type McpImageContent = {
  type: "image";
  data: string;
  mimeType: "image/png" | "image/jpeg";
};

export type McpContentBlock = McpTextContent | McpImageContent;

export interface McpToolResult {
  content: McpContentBlock[];
  isError?: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  scope: McpToolScope;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, context: McpExecutionContext) => Promise<McpToolResult>;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: (context: McpExecutionContext) => Promise<string>;
}

export interface McpExecutionContext {
  config: McpConfig;
}

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}
