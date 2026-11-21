import path from "path";
import fsPromises from "fs/promises";
import { app } from "electron";
import { bufferToArrayBuffer } from "@/modules/utils";
import type { Context } from "hono";
import type { Hono } from "hono/tiny";

const SAFE_ICON_NAME_RE = /^[a-z0-9-]+$/;
const svgCache = new Map<string, ArrayBuffer>();
let cachedDuotoneDir: string | null = null;

function resolveDuotoneDir(): string {
  if (cachedDuotoneDir) return cachedDuotoneDir;

  try {
    cachedDuotoneDir = path.join(require.resolve("@phosphor-icons/core"), "..", "..", "assets", "duotone");
  } catch {
    cachedDuotoneDir = path.join(app.getAppPath(), "node_modules", "@phosphor-icons", "core", "assets", "duotone");
  }

  return cachedDuotoneDir;
}

/**
 * Serves Phosphor duotone SVGs on demand (`lumi://phosphor/<kebab-name>` or `lumi-internal://phosphor/<kebab-name>`)
 * so renderer bundles do not need to statically bundle all 1,500+ Phosphor React components.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerPhosphorRoutes(appInstance: Hono<any, any, any>) {
  appInstance.get("/phosphor/:name", async (c: Context) => {
    const rawName = (c.req.param("name") ?? "").replace(/\.svg$/i, "").toLowerCase();
    if (!SAFE_ICON_NAME_RE.test(rawName)) {
      return c.text("Invalid icon name", 400);
    }

    const cached = svgCache.get(rawName);
    if (cached) {
      return c.body(cached, 200, {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*"
      });
    }

    const dir = resolveDuotoneDir();
    const filePath = path.join(dir, `${rawName}-duotone.svg`);

    try {
      const buffer = await fsPromises.readFile(filePath);
      const arrayBuffer = bufferToArrayBuffer(buffer);
      svgCache.set(rawName, arrayBuffer);
      return c.body(arrayBuffer, 200, {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*"
      });
    } catch {
      return c.text("Icon not found", 404);
    }
  });
}
