import http, { type IncomingMessage, type ServerResponse } from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { getDatastore } from "@/saving/datastore";
import { sendMessageToListeners } from "@/ipc/listeners-manager";
import { generateID } from "@/modules/utils";
import { TypedEventEmitter } from "@/modules/typed-event-emitter";
import { debugError, debugPrint } from "@/modules/output";
import { isToolPermitted, MCP_RESOURCES, MCP_TOOLS } from "./tools";
import type { JsonRpcRequest } from "./types";
import type {
  McpActivityEntry,
  McpClientConfigSnippets,
  McpConfig,
  McpConfigUpdate,
  McpServerStatus
} from "~/types/mcp";

const McpDataStore = getDatastore("mcp");
const CONFIG_KEY = "config";
const DEFAULT_PORT = 47321;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_ACTIVITY_ENTRIES = 40;
const MCP_PROTOCOL_VERSION = "2025-03-26";

type McpControllerEvents = {
  "status-changed": [status: McpServerStatus];
};

function generateToken(): string {
  return `lumi_mcp_${crypto.randomBytes(24).toString("hex")}`;
}

function getRuntimeFilePath(): string {
  return path.join(app.getPath("userData"), "mcp-runtime.json");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Request body exceeds 1 MB limit"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Malformed JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown, headers?: Record<string, string>): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(headers ?? {})
  });
  res.end(payload);
}

function jsonRpcError(id: string | number | null | undefined, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: data !== undefined ? { code, message, data } : { code, message }
  };
}

class McpController extends TypedEventEmitter<McpControllerEvents> {
  private config: McpConfig = {
    enabled: false,
    port: DEFAULT_PORT,
    token: generateToken(),
    accessMode: "interactive",
    allowedProfileId: "all",
    allowExternalJs: false
  };

  private hydrated = false;
  private hydratePromise: Promise<void> | null = null;
  private server: http.Server | null = null;
  private listeningUrl: string | null = null;
  private lastError: string | null = null;
  private totalRequests = 0;
  private sessions = new Set<string>();
  private sseStreams = new Set<ServerResponse>();
  private activity: McpActivityEntry[] = [];

  constructor() {
    super();

    void app.whenReady().then(async () => {
      await this.ensureHydrated();
      if (this.config.enabled) {
        await this.startServer();
      }
    });

    app.on("will-quit", () => {
      void this.stopServer();
    });
  }

  private async ensureHydrated(): Promise<void> {
    if (this.hydrated) return;
    if (this.hydratePromise) return this.hydratePromise;

    this.hydratePromise = (async () => {
      try {
        const stored = await McpDataStore.get<Partial<McpConfig>>(CONFIG_KEY);
        const portNum = Number(stored?.port);
        const validPort = Number.isInteger(portNum) && portNum >= 1024 && portNum <= 65535 ? portNum : DEFAULT_PORT;
        const mode =
          stored?.accessMode === "read-only" || stored?.accessMode === "interactive" || stored?.accessMode === "full"
            ? stored.accessMode
            : "interactive";

        this.config = {
          enabled: Boolean(stored?.enabled),
          port: validPort,
          token: typeof stored?.token === "string" && stored.token.length >= 16 ? stored.token : generateToken(),
          accessMode: mode,
          allowedProfileId:
            typeof stored?.allowedProfileId === "string" && stored.allowedProfileId.trim()
              ? stored.allowedProfileId
              : "all",
          allowExternalJs: Boolean(stored?.allowExternalJs)
        };

        if (!stored?.token) {
          await McpDataStore.set(CONFIG_KEY, this.config);
        }
      } catch (err) {
        debugError("MCP", "Failed to load MCP config:", err);
      } finally {
        this.hydrated = true;
      }
    })();

    return this.hydratePromise;
  }

  private async persistConfig(): Promise<void> {
    await McpDataStore.set(CONFIG_KEY, this.config);
  }

  private writeRuntimeFile(): void {
    try {
      const payload = JSON.stringify({
        url: `http://127.0.0.1:${this.config.port}/mcp`,
        port: this.config.port,
        token: this.config.token,
        pid: process.pid
      });
      fs.writeFileSync(getRuntimeFilePath(), payload, { mode: 0o600 });
    } catch {
      // non-fatal
    }
  }

  private removeRuntimeFile(): void {
    try {
      fs.rmSync(getRuntimeFilePath(), { force: true });
    } catch {
      // ignore
    }
  }

  private buildSnippets(): McpClientConfigSnippets {
    const endpointUrl = `http://127.0.0.1:${this.config.port}/mcp`;
    const bridgeScript = app.isPackaged
      ? path.join(path.dirname(process.execPath), "..", "Resources", "app.asar", "out", "main", "mcp-stdio.js")
      : path.join(__dirname, "mcp-stdio.js");

    const httpJson = JSON.stringify(
      {
        mcpServers: {
          "lumi-browser": {
            url: endpointUrl,
            headers: {
              Authorization: `Bearer ${this.config.token}`
            }
          }
        }
      },
      null,
      2
    );

    const claudeCodeCommand = `claude mcp add --transport http lumi-browser ${endpointUrl} --header "Authorization: Bearer ${this.config.token}"`;

    const claudeDesktopJson = JSON.stringify(
      {
        mcpServers: {
          "lumi-browser": {
            command: process.execPath,
            args: [bridgeScript],
            env: {
              ELECTRON_RUN_AS_NODE: "1",
              LUMI_MCP_URL: endpointUrl,
              LUMI_MCP_TOKEN: this.config.token
            }
          }
        }
      },
      null,
      2
    );

    return {
      endpointUrl,
      httpJson,
      claudeCodeCommand,
      claudeDesktopJson
    };
  }

  public async getStatus(): Promise<McpServerStatus> {
    await this.ensureHydrated();
    return {
      running: Boolean(this.server?.listening),
      listeningUrl: this.listeningUrl,
      error: this.lastError,
      activeSessions: this.sessions.size,
      totalRequests: this.totalRequests,
      config: { ...this.config },
      activity: [...this.activity],
      snippets: this.buildSnippets()
    };
  }

  private emitStatus(): void {
    const status: McpServerStatus = {
      running: Boolean(this.server?.listening),
      listeningUrl: this.listeningUrl,
      error: this.lastError,
      activeSessions: this.sessions.size,
      totalRequests: this.totalRequests,
      config: { ...this.config },
      activity: [...this.activity],
      snippets: this.buildSnippets()
    };
    this.emit("status-changed", status);
    sendMessageToListeners("mcp:on-status-changed", status);
  }

  private notifyToolsChanged(): void {
    const payload = `data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" })}\n\n`;
    for (const stream of this.sseStreams) {
      try {
        stream.write(payload);
      } catch {
        this.sseStreams.delete(stream);
      }
    }
  }

  private recordActivity(entry: Omit<McpActivityEntry, "id" | "timestamp">): void {
    this.activity.unshift({
      id: generateID(),
      timestamp: Date.now(),
      ...entry
    });
    if (this.activity.length > MAX_ACTIVITY_ENTRIES) {
      this.activity.length = MAX_ACTIVITY_ENTRIES;
    }
    this.emitStatus();
  }

  public async setEnabled(enabled: boolean): Promise<McpServerStatus> {
    await this.ensureHydrated();
    this.config.enabled = enabled;
    await this.persistConfig();
    if (enabled) {
      await this.startServer();
    } else {
      await this.stopServer();
    }
    return this.getStatus();
  }

  public async updateConfig(updates: McpConfigUpdate): Promise<McpServerStatus> {
    await this.ensureHydrated();
    let restartNeeded = false;
    let toolsChanged = false;

    if (
      typeof updates.port === "number" &&
      Number.isInteger(updates.port) &&
      updates.port >= 1024 &&
      updates.port <= 65535
    ) {
      if (updates.port !== this.config.port) {
        this.config.port = updates.port;
        restartNeeded = true;
      }
    }
    if (updates.accessMode === "read-only" || updates.accessMode === "interactive" || updates.accessMode === "full") {
      if (updates.accessMode !== this.config.accessMode) {
        this.config.accessMode = updates.accessMode;
        toolsChanged = true;
      }
    }
    if (typeof updates.allowedProfileId === "string" && updates.allowedProfileId.trim()) {
      this.config.allowedProfileId = updates.allowedProfileId.trim();
    }
    if (typeof updates.allowExternalJs === "boolean") {
      if (updates.allowExternalJs !== this.config.allowExternalJs) {
        this.config.allowExternalJs = updates.allowExternalJs;
        toolsChanged = true;
      }
    }
    if (typeof updates.enabled === "boolean") {
      this.config.enabled = updates.enabled;
    }

    await this.persistConfig();

    if (!this.config.enabled) {
      await this.stopServer();
    } else if (restartNeeded || !this.server?.listening) {
      await this.stopServer();
      await this.startServer();
    } else {
      this.writeRuntimeFile();
      if (toolsChanged) this.notifyToolsChanged();
      this.emitStatus();
    }

    return this.getStatus();
  }

  public async rotateToken(): Promise<McpServerStatus> {
    await this.ensureHydrated();
    this.config.token = generateToken();
    this.sessions.clear();
    await this.persistConfig();
    if (this.server?.listening) {
      this.writeRuntimeFile();
    }
    this.emitStatus();
    return this.getStatus();
  }

  public async clearActivity(): Promise<McpServerStatus> {
    this.activity = [];
    this.emitStatus();
    return this.getStatus();
  }

  private async startServer(): Promise<void> {
    if (this.server?.listening) return;

    this.lastError = null;
    const server = http.createServer((req, res) => {
      void this.handleHttpRequest(req, res);
    });

    await new Promise<void>((resolve) => {
      const onError = (err: NodeJS.ErrnoException) => {
        this.lastError =
          err.code === "EADDRINUSE"
            ? `Port ${this.config.port} is already in use.`
            : err.message || "Failed to bind local MCP server.";
        this.listeningUrl = null;
        this.server = null;
        this.removeRuntimeFile();
        debugError("MCP", "Server bind error:", err);
        this.emitStatus();
        resolve();
      };

      server.once("error", onError);
      server.listen(this.config.port, "127.0.0.1", () => {
        server.removeListener("error", onError);
        this.server = server;
        this.listeningUrl = `http://127.0.0.1:${this.config.port}/mcp`;
        this.lastError = null;
        this.writeRuntimeFile();
        debugPrint("MCP", `Lumi MCP server listening at ${this.listeningUrl}`);
        this.emitStatus();
        resolve();
      });
    });
  }

  private async stopServer(): Promise<void> {
    this.removeRuntimeFile();
    for (const stream of this.sseStreams) {
      try {
        stream.end();
      } catch {
        // ignore
      }
    }
    this.sseStreams.clear();
    this.sessions.clear();

    const activeServer = this.server;
    this.server = null;
    this.listeningUrl = null;

    if (activeServer) {
      await new Promise<void>((resolve) => {
        activeServer.close(() => resolve());
      });
    }
    this.emitStatus();
  }

  private validateIncomingSecurity(req: IncomingMessage, res: ServerResponse): boolean {
    // Reject web browser cross-origin / DNS-rebinding attempts immediately
    if (req.headers.origin) {
      writeJson(res, 403, { error: "Origin header forbidden on local MCP endpoint." });
      return false;
    }

    const host = (req.headers.host || "").toLowerCase();
    const expectedLocalhost = `localhost:${this.config.port}`;
    const expectedLoopback = `127.0.0.1:${this.config.port}`;
    if (host !== expectedLoopback && host !== expectedLocalhost) {
      writeJson(res, 403, { error: "Invalid Host header." });
      return false;
    }

    const auth = req.headers.authorization || "";
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match || !constantTimeEquals(match[1].trim(), this.config.token)) {
      writeJson(res, 401, { error: "Missing or invalid Bearer token." }, { "WWW-Authenticate": "Bearer" });
      return false;
    }

    return true;
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.validateIncomingSecurity(req, res)) {
      return;
    }

    const url = new URL(req.url || "/", `http://127.0.0.1:${this.config.port}`);
    if (url.pathname !== "/mcp") {
      writeJson(res, 404, { error: "Not found. Use /mcp endpoint." });
      return;
    }

    if (req.method === "GET") {
      const accept = String(req.headers.accept || "");
      if (!accept.includes("text/event-stream")) {
        writeJson(res, 200, {
          name: "lumi-browser",
          version: app.getVersion(),
          protocolVersion: MCP_PROTOCOL_VERSION,
          running: true
        });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      res.write(": lumi-mcp-ready\n\n");
      this.sseStreams.add(res);
      const heartbeat = setInterval(() => {
        try {
          res.write(": ping\n\n");
        } catch {
          clearInterval(heartbeat);
          this.sseStreams.delete(res);
        }
      }, 20_000);
      req.on("close", () => {
        clearInterval(heartbeat);
        this.sseStreams.delete(res);
      });
      return;
    }

    if (req.method === "DELETE") {
      const sessionId = String(req.headers["mcp-session-id"] || "");
      if (sessionId) {
        this.sessions.delete(sessionId);
        this.emitStatus();
      }
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" }, { Allow: "GET, POST, DELETE" });
      return;
    }

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      writeJson(res, 400, jsonRpcError(null, -32700, error instanceof Error ? error.message : "Parse error"));
      return;
    }

    this.totalRequests += 1;
    const isBatch = Array.isArray(body);
    const messages = (isBatch ? body : [body]) as JsonRpcRequest[];
    const responseHeaders: Record<string, string> = {};

    const results: unknown[] = [];
    for (const msg of messages) {
      if (!msg || typeof msg !== "object" || typeof msg.method !== "string") {
        if (msg && typeof msg === "object" && msg.id !== undefined) {
          results.push(jsonRpcError(msg.id, -32600, "Invalid JSON-RPC request"));
        }
        continue;
      }

      const rpcRes = await this.dispatchJsonRpc(msg, responseHeaders);
      if (rpcRes !== null) {
        results.push(rpcRes);
      }
    }

    if (results.length === 0) {
      res.writeHead(202, responseHeaders);
      res.end();
      return;
    }

    writeJson(res, 200, isBatch ? results : results[0], responseHeaders);
  }

  private async dispatchJsonRpc(req: JsonRpcRequest, responseHeaders: Record<string, string>): Promise<unknown | null> {
    const start = Date.now();
    const method = req.method || "";
    const params = (req.params && typeof req.params === "object" ? req.params : {}) as Record<string, unknown>;
    const isNotification = req.id === undefined || req.id === null;

    if (method === "notifications/initialized" || method.startsWith("notifications/")) {
      return null;
    }

    if (method === "initialize") {
      const sessionId = crypto.randomUUID();
      this.sessions.add(sessionId);
      responseHeaders["Mcp-Session-Id"] = sessionId;

      this.recordActivity({
        method,
        summary: "Client initialized MCP session",
        status: "ok",
        durationMs: Date.now() - start
      });

      return {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: true },
            resources: { listChanged: false }
          },
          serverInfo: {
            name: "lumi-browser",
            title: "Lumi Browser",
            version: app.getVersion()
          },
          instructions:
            "Use Lumi MCP tools to inspect tabs/Spaces, extract clean readable content via Reader Mode, take screenshots, search history/bookmarks, or navigate pages inside the user's permitted Lumi profile."
        }
      };
    }

    if (method === "ping") {
      return { jsonrpc: "2.0", id: req.id ?? null, result: {} };
    }

    if (method === "tools/list") {
      const availableTools = MCP_TOOLS.filter((tool) => {
        if (!isToolPermitted(this.config.accessMode, tool)) return false;
        if (tool.name === "lumi_evaluate_js" && !this.config.allowExternalJs) return false;
        return true;
      }).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));

      return {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: { tools: availableTools }
      };
    }

    if (method === "tools/call") {
      const toolName = typeof params.name === "string" ? params.name : "";
      const toolArgs = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<
        string,
        unknown
      >;
      const tool = MCP_TOOLS.find((t) => t.name === toolName);

      if (!tool) {
        return jsonRpcError(req.id, -32602, `Unknown tool: ${toolName}`);
      }

      if (!isToolPermitted(this.config.accessMode, tool)) {
        this.recordActivity({
          method,
          toolName,
          summary: `Blocked (${this.config.accessMode} mode)`,
          status: "denied",
          durationMs: Date.now() - start
        });
        return {
          jsonrpc: "2.0",
          id: req.id ?? null,
          result: {
            content: [
              {
                type: "text",
                text: `Tool "${toolName}" requires "${tool.scope}" scope, but Lumi MCP is currently set to "${this.config.accessMode}".`
              }
            ],
            isError: true
          }
        };
      }

      try {
        const result = await tool.handler(toolArgs, { config: { ...this.config } });
        const firstText = result.content.find((c) => c.type === "text");
        const errorSummary =
          result.isError && firstText?.type === "text"
            ? firstText.text.split("\n")[0].trim().slice(0, 90) || "Returned error"
            : "Executed";
        this.recordActivity({
          method,
          toolName,
          summary: errorSummary,
          status: result.isError ? "error" : "ok",
          durationMs: Date.now() - start
        });
        return {
          jsonrpc: "2.0",
          id: req.id ?? null,
          result
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.recordActivity({
          method,
          toolName,
          summary: msg.slice(0, 90),
          status: "error",
          durationMs: Date.now() - start
        });
        return {
          jsonrpc: "2.0",
          id: req.id ?? null,
          result: {
            content: [{ type: "text", text: `Tool execution failed: ${msg}` }],
            isError: true
          }
        };
      }
    }

    if (method === "resources/list") {
      return {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: {
          resources: MCP_RESOURCES.map((r) => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType
          }))
        }
      };
    }

    if (method === "resources/read") {
      const uri = typeof params.uri === "string" ? params.uri : "";
      const resource = MCP_RESOURCES.find((r) => r.uri === uri);
      if (!resource) {
        return jsonRpcError(req.id, -32602, `Resource not found: ${uri}`);
      }
      const text = await resource.read({ config: { ...this.config } });
      this.recordActivity({
        method,
        toolName: uri,
        summary: "Read resource",
        status: "ok",
        durationMs: Date.now() - start
      });
      return {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: {
          contents: [{ uri: resource.uri, mimeType: resource.mimeType, text }]
        }
      };
    }

    if (isNotification) return null;
    return jsonRpcError(req.id, -32601, `Method not found: ${method}`);
  }
}

export const mcpController = new McpController();
