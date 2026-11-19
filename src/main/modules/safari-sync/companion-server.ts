import { spawn, type ChildProcess } from "child_process";
import { timingSafeEqual } from "crypto";
import http, { type IncomingMessage, type ServerResponse } from "http";
import os from "os";
import { debugError, debugPrint } from "@/modules/output";
import { renderCompanionHtml } from "@/modules/safari-sync/companion-html";
import { isHttpOrHttpsUrl } from "@/modules/safari-sync/safari-bridge";
import { buildSyncSnapshot } from "@/modules/safari-sync/snapshot";
import { upgradeToWebSocket, type SimpleWebSocketClient } from "@/modules/safari-sync/websocket";
import { loadSafariSyncData } from "@/saving/safari-sync";

const BONJOUR_SERVICE_TYPE = "_lumi-sync._tcp";
const MAX_BODY_BYTES = 64 * 1024;
const PAIR_RATE_LIMIT_WINDOW_MS = 60_000;
const PAIR_RATE_LIMIT_MAX_ATTEMPTS = 10;

export interface CompanionIncomingLink {
  url: string;
  title: string;
  spaceId?: string;
  mode: "open" | "inbox" | "favourite";
  deviceName: string;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function getLanIpv4Addresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const iface of entries) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      if (iface.address.startsWith("169.254.")) continue;
      addresses.push(iface.address);
    }
  }

  return addresses;
}

function getLocalMdnsHostname(): string | null {
  const host = os.hostname().trim();
  if (!host) return null;
  return host.endsWith(".local") ? host : `${host}.local`;
}

export class CompanionServer {
  private server: http.Server | null = null;
  private bonjourProcess: ChildProcess | null = null;
  private wsClients: Set<SimpleWebSocketClient> = new Set();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pairAttemptsByIp: Map<string, { count: number; resetAt: number }> = new Map();

  private actualPort: number | null = null;
  private bonjourActive = false;
  private lastClientSeenAt: number | undefined;
  private lastError: string | undefined;

  constructor(
    private readonly onIncomingLink: (link: CompanionIncomingLink) => Promise<void>,
    private readonly onStateChanged: () => void
  ) {}

  public getStatusSnapshot() {
    return {
      running: this.server !== null && this.actualPort !== null,
      actualPort: this.actualPort,
      bonjourActive: this.bonjourActive,
      bonjourServiceType: BONJOUR_SERVICE_TYPE,
      connectedClients: this.wsClients.size,
      lastClientSeenAt: this.lastClientSeenAt,
      lastError: this.lastError
    };
  }

  public async getUrls(pairingToken: string): Promise<{
    urls: string[];
    bonjourUrl: string | null;
    primaryPairUrl: string | null;
  }> {
    if (!this.actualPort) {
      return { urls: [], bonjourUrl: null, primaryPairUrl: null };
    }

    const lanIps = getLanIpv4Addresses();
    const urls = lanIps.map((ip) => `http://${ip}:${this.actualPort}`);
    if (urls.length === 0) {
      urls.push(`http://127.0.0.1:${this.actualPort}`);
    }

    const mdnsHost = getLocalMdnsHostname();
    const bonjourUrl = this.bonjourActive && mdnsHost ? `http://${mdnsHost}:${this.actualPort}` : null;
    const baseForQr = urls[0] || bonjourUrl;
    const primaryPairUrl = baseForQr ? `${baseForQr}/?token=${encodeURIComponent(pairingToken)}` : null;

    return { urls, bonjourUrl, primaryPairUrl };
  }

  public async start(): Promise<void> {
    await this.stop();
    this.lastError = undefined;

    const data = await loadSafariSyncData();
    const requestedPort = Number(data.companionConfig.port) || 48123;

    const server = http.createServer((req, res) => {
      void this.handleHttpRequest(req, res);
    });

    server.on("upgrade", (req, socket, head) => {
      void this.handleWsUpgrade(req, socket, head);
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            // Fallback to OS-assigned ephemeral port if preferred port is taken
            server.removeListener("error", onError);
            server.once("error", reject);
            server.listen(0, "0.0.0.0", () => resolve());
            return;
          }
          reject(err);
        };
        server.once("error", onError);
        server.listen(requestedPort, "0.0.0.0", () => {
          server.removeListener("error", onError);
          resolve();
        });
      });

      const addr = server.address();
      if (!addr || typeof addr === "string") {
        throw new Error("Could not determine companion server port.");
      }

      this.server = server;
      this.actualPort = addr.port;

      this.heartbeatTimer = setInterval(() => {
        for (const client of this.wsClients) {
          client.sendPing();
        }
      }, 25_000);

      if (data.companionConfig.advertiseBonjour) {
        this.startBonjourAdvertisement(data.companionConfig.bonjourName || data.deviceName, addr.port);
      }

      debugPrint("SAFARI_SYNC", `Companion server listening on port ${addr.port}`);
      this.onStateChanged();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      debugError("SAFARI_SYNC", "Companion server failed to start:", this.lastError);
      try {
        server.close();
      } catch {
        // Ignore
      }
      this.server = null;
      this.actualPort = null;
      this.onStateChanged();
    }
  }

  public async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.stopBonjourAdvertisement();

    for (const client of [...this.wsClients]) {
      client.close(1001, "Server stopping");
    }
    this.wsClients.clear();

    if (this.server) {
      const s = this.server;
      this.server = null;
      this.actualPort = null;
      await new Promise<void>((resolve) => {
        s.close(() => resolve());
      });
    } else {
      this.actualPort = null;
    }

    this.onStateChanged();
  }

  public async broadcastState(): Promise<void> {
    if (this.wsClients.size === 0) return;
    try {
      const snapshot = await buildSyncSnapshot();
      const message = JSON.stringify({ type: "state", payload: snapshot });
      for (const client of this.wsClients) {
        client.sendText(message);
      }
    } catch (error) {
      debugError("SAFARI_SYNC", "Failed broadcasting companion WS state:", error);
    }
  }

  private startBonjourAdvertisement(serviceName: string, port: number): void {
    this.stopBonjourAdvertisement();
    if (process.platform !== "darwin") {
      this.bonjourActive = false;
      return;
    }

    try {
      const child = spawn(
        "/usr/bin/dns-sd",
        ["-R", serviceName, BONJOUR_SERVICE_TYPE, "local", String(port), "path=/"],
        {
          stdio: "ignore"
        }
      );
      child.on("error", (err) => {
        debugError("SAFARI_SYNC", "dns-sd Bonjour error:", err.message);
        this.bonjourActive = false;
        this.bonjourProcess = null;
        this.onStateChanged();
      });
      child.on("exit", () => {
        this.bonjourActive = false;
        this.bonjourProcess = null;
        this.onStateChanged();
      });
      this.bonjourProcess = child;
      this.bonjourActive = true;
    } catch (error) {
      debugError("SAFARI_SYNC", "Failed spawning dns-sd:", error);
      this.bonjourActive = false;
    }
  }

  private stopBonjourAdvertisement(): void {
    if (this.bonjourProcess) {
      try {
        this.bonjourProcess.kill("SIGTERM");
      } catch {
        // Ignore
      }
      this.bonjourProcess = null;
    }
    this.bonjourActive = false;
  }

  private async isAuthorized(req: IncomingMessage): Promise<boolean> {
    const data = await loadSafariSyncData();
    const expected = data.companionPairingToken;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const provided = authHeader.slice("Bearer ".length).trim();
      if (constantTimeEquals(provided, expected)) return true;
    }

    const url = new URL(req.url || "/", "http://localhost");
    const queryToken = url.searchParams.get("token");
    if (queryToken && constantTimeEquals(queryToken, expected)) {
      return true;
    }

    return false;
  }

  private checkPairRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = this.pairAttemptsByIp.get(ip);
    if (!record || now > record.resetAt) {
      this.pairAttemptsByIp.set(ip, { count: 1, resetAt: now + PAIR_RATE_LIMIT_WINDOW_MS });
      return true;
    }
    record.count += 1;
    return record.count <= PAIR_RATE_LIMIT_MAX_ATTEMPTS;
  }

  private async readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > MAX_BODY_BYTES) {
        throw new Error("Request body too large.");
      }
      chunks.push(buf);
    }
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  }

  private sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(JSON.stringify(body));
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method || "GET";
    const parsedUrl = new URL(req.url || "/", "http://localhost");
    const pathname = parsedUrl.pathname;

    if (method === "GET" && pathname === "/api/ping") {
      this.sendJson(res, 200, { ok: true, service: "lumi-companion" });
      return;
    }

    if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      const data = await loadSafariSyncData();
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(renderCompanionHtml(data.deviceName));
      return;
    }

    if (method === "POST" && pathname === "/api/pair") {
      const ip = req.socket.remoteAddress || "unknown";
      if (!this.checkPairRateLimit(ip)) {
        this.sendJson(res, 429, { error: "Too many pairing attempts. Wait a minute and try again." });
        return;
      }

      try {
        const body = await this.readJsonBody(req);
        const code = typeof body.code === "string" ? body.code.trim() : "";
        const data = await loadSafariSyncData();
        if (!code || !constantTimeEquals(code, data.companionPairingCode)) {
          this.sendJson(res, 401, { error: "Invalid pairing code." });
          return;
        }
        this.lastClientSeenAt = Date.now();
        this.onStateChanged();
        this.sendJson(res, 200, { token: data.companionPairingToken });
      } catch (error) {
        this.sendJson(res, 400, { error: error instanceof Error ? error.message : "Bad request" });
      }
      return;
    }

    if (!(await this.isAuthorized(req))) {
      this.sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    this.lastClientSeenAt = Date.now();

    if (method === "GET" && pathname === "/api/state") {
      const snapshot = await buildSyncSnapshot();
      this.sendJson(res, 200, snapshot);
      return;
    }

    if (method === "POST" && pathname === "/api/send-link") {
      try {
        const body = await this.readJsonBody(req);
        const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
        if (!isHttpOrHttpsUrl(rawUrl)) {
          this.sendJson(res, 400, { error: "URL must start with http:// or https://" });
          return;
        }
        const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : rawUrl;
        const spaceId = typeof body.spaceId === "string" && body.spaceId.trim() ? body.spaceId.trim() : undefined;
        const modeRaw = body.mode;
        const mode: "open" | "inbox" | "favourite" = modeRaw === "open" || modeRaw === "favourite" ? modeRaw : "inbox";
        const deviceName =
          typeof body.deviceName === "string" && body.deviceName.trim() ? body.deviceName.trim() : "Mobile Companion";

        await this.onIncomingLink({ url: rawUrl, title, spaceId, mode, deviceName });
        this.sendJson(res, 200, { ok: true });
      } catch (error) {
        this.sendJson(res, 400, { error: error instanceof Error ? error.message : "Failed processing link" });
      }
      return;
    }

    this.sendJson(res, 404, { error: "Not found" });
  }

  private async handleWsUpgrade(req: IncomingMessage, socket: import("stream").Duplex, head: Buffer): Promise<void> {
    const parsedUrl = new URL(req.url || "/", "http://localhost");
    if (parsedUrl.pathname !== "/ws") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    if (!(await this.isAuthorized(req))) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const client = upgradeToWebSocket(
      req,
      socket,
      head,
      (_c, text) => {
        // Optional WS command handling
        try {
          const msg = JSON.parse(text) as { type?: string };
          if (msg.type === "ping") {
            client?.sendText(JSON.stringify({ type: "pong" }));
          }
        } catch {
          // Ignore malformed WS message
        }
      },
      (closedClient) => {
        this.wsClients.delete(closedClient);
        this.onStateChanged();
      }
    );

    if (client) {
      this.wsClients.add(client);
      this.lastClientSeenAt = Date.now();
      this.onStateChanged();
      const snapshot = await buildSyncSnapshot();
      client.sendText(JSON.stringify({ type: "state", payload: snapshot }));
    }
  }
}
