import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

interface RuntimeDiscovery {
  url: string;
  token: string;
}

function resolveDefaultUserDataDir(): string {
  const appName = "Lumi";
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appName);
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), appName);
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), appName);
}

function resolveEndpoint(): RuntimeDiscovery {
  const envUrl = process.env.LUMI_MCP_URL?.trim();
  const envToken = process.env.LUMI_MCP_TOKEN?.trim();
  if (envUrl && envToken) {
    return { url: envUrl, token: envToken };
  }

  const candidateDirs = [
    process.env.LUMI_USER_DATA_DIR,
    resolveDefaultUserDataDir(),
    resolveDefaultUserDataDir().replace(/Lumi$/, "Electron")
  ].filter((d): d is string => Boolean(d));

  for (const dir of candidateDirs) {
    const file = path.join(dir, "mcp-runtime.json");
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<RuntimeDiscovery>;
      if (raw.url && raw.token) {
        return { url: raw.url, token: raw.token };
      }
    } catch {
      // keep scanning
    }
  }

  return {
    url: envUrl || "http://127.0.0.1:47321/mcp",
    token: envToken || ""
  };
}

let sessionId: string | null = null;

async function forwardRpc(line: string): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;

  let parsedId: string | number | null | undefined;
  try {
    const parsed = JSON.parse(trimmed) as { id?: string | number | null };
    parsedId = parsed?.id;
  } catch {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`
    );
    return;
  }

  const { url, token } = resolveEndpoint();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    };
    if (sessionId) {
      headers["Mcp-Session-Id"] = sessionId;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: trimmed
    });

    const newSession = res.headers.get("mcp-session-id");
    if (newSession) sessionId = newSession;

    if (res.status === 202) {
      return;
    }

    const text = await res.text();
    if (!res.ok) {
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: parsedId ?? null,
          error: {
            code: -32000,
            message: `Lumi MCP bridge HTTP ${res.status}: ${text || "Ensure Lumi is running with MCP Server enabled."}`
          }
        })}\n`
      );
      return;
    }

    if (text.trim()) {
      process.stdout.write(`${text.trim()}\n`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (parsedId !== undefined) {
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: parsedId,
          error: {
            code: -32001,
            message: `Cannot reach Lumi Browser MCP server at ${url} (${msg}). Launch Lumi and enable Settings -> MCP Server.`
          }
        })}\n`
      );
    }
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let pendingQueue = Promise.resolve();

rl.on("line", (line) => {
  pendingQueue = pendingQueue.then(() => forwardRpc(line));
});
rl.on("close", () => {
  void pendingQueue.finally(() => process.exit(0));
});
