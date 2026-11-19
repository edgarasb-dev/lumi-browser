import { createHash } from "crypto";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";

const WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_FRAME_BYTES = 1024 * 1024; // 1 MB limit

export class SimpleWebSocketClient {
  private buffer = Buffer.alloc(0);
  private fragmentedChunks: Buffer[] = [];
  private closed = false;

  constructor(
    public readonly socket: Duplex,
    private readonly onMessage: (text: string) => void,
    private readonly onClose: () => void
  ) {
    socket.on("data", (chunk: Buffer) => this.handleData(chunk));
    socket.on("close", () => this.cleanup());
    socket.on("error", () => this.cleanup());
  }

  public sendText(text: string): void {
    if (this.closed || this.socket.destroyed) return;
    this.writeFrame(0x1, Buffer.from(text, "utf8"));
  }

  public sendPing(): void {
    if (this.closed || this.socket.destroyed) return;
    this.writeFrame(0x9, Buffer.alloc(0));
  }

  public close(code = 1000, reason = ""): void {
    if (this.closed) return;
    const reasonBuf = Buffer.from(reason, "utf8");
    const payload = Buffer.alloc(2 + reasonBuf.length);
    payload.writeUInt16BE(code, 0);
    reasonBuf.copy(payload, 2);
    if (!this.socket.destroyed) {
      this.writeFrame(0x8, payload);
      this.socket.end();
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.closed) return;
    this.closed = true;
    this.buffer = Buffer.alloc(0);
    this.fragmentedChunks = [];
    this.onClose();
  }

  private writeFrame(opcode: number, payload: Buffer): void {
    const len = payload.length;
    let header: Buffer;

    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode;
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }

    try {
      this.socket.write(Buffer.concat([header, payload]));
    } catch {
      this.cleanup();
    }
  }

  private handleData(chunk: Buffer): void {
    if (this.closed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 2) {
      const firstByte = this.buffer[0]!;
      const secondByte = this.buffer[1]!;

      const fin = (firstByte & 0x80) !== 0;
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (this.buffer.length < offset + 2) return;
        payloadLen = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        if (this.buffer.length < offset + 8) return;
        const bigLen = this.buffer.readBigUInt64BE(offset);
        if (bigLen > BigInt(MAX_FRAME_BYTES)) {
          this.close(1009, "Message too large");
          return;
        }
        payloadLen = Number(bigLen);
        offset += 8;
      }

      if (payloadLen > MAX_FRAME_BYTES) {
        this.close(1009, "Message too large");
        return;
      }

      const maskBytes = masked ? 4 : 0;
      if (this.buffer.length < offset + maskBytes + payloadLen) {
        return;
      }

      let maskKey: Buffer | null = null;
      if (masked) {
        maskKey = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      const payload = Buffer.from(this.buffer.subarray(offset, offset + payloadLen));
      this.buffer = this.buffer.subarray(offset + payloadLen);

      if (maskKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] = payload[i]! ^ maskKey[i % 4]!;
        }
      }

      if (opcode === 0x8) {
        this.close(1000);
        return;
      }

      if (opcode === 0x9) {
        // Ping -> Pong
        this.writeFrame(0x0a, payload);
        continue;
      }

      if (opcode === 0x0a) {
        // Pong ignored
        continue;
      }

      if (opcode === 0x1 || opcode === 0x0) {
        this.fragmentedChunks.push(payload);
        if (fin) {
          const full = Buffer.concat(this.fragmentedChunks).toString("utf8");
          this.fragmentedChunks = [];
          try {
            this.onMessage(full);
          } catch {
            // Ignore handler error
          }
        }
      }
    }
  }
}

export function upgradeToWebSocket(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  onMessage: (client: SimpleWebSocketClient, text: string) => void,
  onClose: (client: SimpleWebSocketClient) => void
): SimpleWebSocketClient | null {
  const key = req.headers["sec-websocket-key"];
  if (!key || typeof key !== "string") {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return null;
  }

  const accept = createHash("sha1")
    .update(key + WS_MAGIC_GUID)
    .digest("base64");

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n"
    ].join("\r\n")
  );

  const clientRef = new SimpleWebSocketClient(
    socket,
    (text) => onMessage(clientRef, text),
    () => onClose(clientRef)
  );

  if (head.length > 0) {
    socket.emit("data", head);
  }

  return clientRef;
}
