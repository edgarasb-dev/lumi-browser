import { app, BrowserWindow as ElectronBrowserWindow, clipboard, ClipboardItem, dialog } from "electron";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import type { Tab } from "@/controllers/tabs-controller/tab";
import type { CapturedPageResult, CaptureRect, SaveCaptureResult } from "~/lumi/interfaces/browser/capture";

const MAX_FULL_PAGE_HEIGHT = 12_000;

function sanitizeFilenameSegment(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "page"
  );
}

function buildSuggestedFilename(tab: Tab, suffix: string): string {
  let host = "page";
  try {
    host = new URL(tab.url).hostname.replace(/^www\./, "") || "page";
  } catch {
    host = tab.title || "page";
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `lumi-${sanitizeFilenameSegment(host)}-${suffix}-${stamp}.png`;
}

function decodePngDataUrl(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[1], "base64");
}

export async function captureVisibleTabPage(tab: Tab, rect?: CaptureRect): Promise<CapturedPageResult | null> {
  const wc = tab.webContents;
  if (tab.isDestroyed || !wc || wc.isDestroyed()) return null;

  const cleanRect =
    rect && rect.width >= 4 && rect.height >= 4
      ? {
          x: Math.max(0, Math.round(rect.x)),
          y: Math.max(0, Math.round(rect.y)),
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height))
        }
      : undefined;

  const image = await wc.capturePage(cleanRect);
  if (image.isEmpty()) return null;

  const size = image.getSize();
  const pngBuffer = image.toPNG();

  return {
    dataUrl: `data:image/png;base64,${pngBuffer.toString("base64")}`,
    width: size.width,
    height: size.height,
    title: tab.title || tab.url,
    suggestedFilename: buildSuggestedFilename(tab, cleanRect ? "crop" : "visible")
  };
}

export async function captureFullScrollTabPage(tab: Tab): Promise<CapturedPageResult | null> {
  const wc = tab.webContents;
  if (tab.isDestroyed || !wc || wc.isDestroyed()) return null;

  const metrics = (await wc.executeJavaScript(`
    (() => ({
      scrollHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
      clientHeight: window.innerHeight || document.documentElement.clientHeight,
      initialX: window.scrollX || 0,
      initialY: window.scrollY || 0
    }))()
  `)) as { scrollHeight: number; clientHeight: number; initialX: number; initialY: number };

  if (!metrics || metrics.clientHeight <= 0) {
    return captureVisibleTabPage(tab);
  }

  const targetScrollHeight = Math.min(metrics.scrollHeight, MAX_FULL_PAGE_HEIGHT);
  if (targetScrollHeight <= metrics.clientHeight + 8) {
    return captureVisibleTabPage(tab);
  }

  const strips: { buffer: Buffer; topPx: number; heightPx: number; widthPx: number }[] = [];
  let pixelScale = 1;
  let totalWidthPx = 0;
  let totalHeightPx = 0;

  try {
    let scrollY = 0;
    while (scrollY < targetScrollHeight) {
      const clampedY = Math.min(scrollY, Math.max(0, targetScrollHeight - metrics.clientHeight));
      await wc.executeJavaScript(`window.scrollTo(0, ${clampedY});`);
      await new Promise((r) => setTimeout(r, 120));

      const image = await wc.capturePage();
      if (image.isEmpty()) break;

      const { width, height } = image.getSize();
      const pngBuffer = image.toPNG();
      if (strips.length === 0) {
        pixelScale = height / metrics.clientHeight;
        totalWidthPx = width;
      }

      const actualScrollY = (await wc.executeJavaScript("window.scrollY || 0")) as number;
      const topPx = Math.round(actualScrollY * pixelScale);
      const prevEndPx = strips.length > 0 ? strips[strips.length - 1].topPx + strips[strips.length - 1].heightPx : 0;

      if (topPx < prevEndPx && strips.length > 0) {
        // Overlap near bottom of scroll: crop off top pixels already present in previous strip
        const overlapPx = prevEndPx - topPx;
        const extractHeight = height - overlapPx;
        if (extractHeight > 0) {
          const cropped = await sharp(pngBuffer)
            .extract({ left: 0, top: overlapPx, width, height: extractHeight })
            .toBuffer();
          strips.push({ buffer: cropped, topPx: prevEndPx, heightPx: extractHeight, widthPx: width });
          totalHeightPx = prevEndPx + extractHeight;
        }
      } else {
        strips.push({ buffer: pngBuffer, topPx, heightPx: height, widthPx: width });
        totalHeightPx = topPx + height;
      }

      if (clampedY + metrics.clientHeight >= targetScrollHeight) {
        break;
      }
      scrollY += metrics.clientHeight;
    }
  } finally {
    await wc.executeJavaScript(`window.scrollTo(${metrics.initialX}, ${metrics.initialY});`).catch(() => undefined);
  }

  if (strips.length === 0 || totalWidthPx <= 0 || totalHeightPx <= 0) {
    return captureVisibleTabPage(tab);
  }

  if (strips.length === 1) {
    return {
      dataUrl: `data:image/png;base64,${strips[0].buffer.toString("base64")}`,
      width: strips[0].widthPx,
      height: strips[0].heightPx,
      title: tab.title || tab.url,
      suggestedFilename: buildSuggestedFilename(tab, "fullpage")
    };
  }

  const stitched = await sharp({
    create: {
      width: totalWidthPx,
      height: totalHeightPx,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite(
      strips.map((s) => ({
        input: s.buffer,
        left: 0,
        top: s.topPx
      }))
    )
    .png()
    .toBuffer();

  return {
    dataUrl: `data:image/png;base64,${stitched.toString("base64")}`,
    width: totalWidthPx,
    height: totalHeightPx,
    title: tab.title || tab.url,
    suggestedFilename: buildSuggestedFilename(tab, "fullpage")
  };
}

export async function copyCapturedDataUrl(dataUrl: string): Promise<boolean> {
  try {
    const pngBuffer = decodePngDataUrl(dataUrl);
    if (!pngBuffer) return false;
    const item = new ClipboardItem({
      "image/png": new Blob([new Uint8Array(pngBuffer)], { type: "image/png" })
    });
    await clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}

export async function saveCapturedPng(
  ownerWindow: ElectronBrowserWindow | undefined,
  dataUrl: string,
  suggestedFilename?: string
): Promise<SaveCaptureResult> {
  const pngBuffer = decodePngDataUrl(dataUrl);
  if (!pngBuffer) return { saved: false };

  const defaultName = suggestedFilename?.endsWith(".png") ? suggestedFilename : "lumi-capture.png";
  const defaultPath = path.join(app.getPath("downloads"), defaultName);

  const result = ownerWindow
    ? await dialog.showSaveDialog(ownerWindow, {
        defaultPath,
        filters: [{ name: "PNG Image", extensions: ["png"] }]
      })
    : await dialog.showSaveDialog({
        defaultPath,
        filters: [{ name: "PNG Image", extensions: ["png"] }]
      });

  if (result.canceled || !result.filePath) {
    return { saved: false };
  }

  await fs.writeFile(result.filePath, pngBuffer);
  return { saved: true, path: result.filePath };
}
