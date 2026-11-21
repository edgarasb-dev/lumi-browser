import sharp from "sharp";
import type { WebContents } from "electron";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { profilesController } from "@/controllers/profiles-controller";
import { spacesController } from "@/controllers/spaces-controller";
import { tabsController } from "@/controllers/tabs-controller";
import type { Tab } from "@/controllers/tabs-controller/tab";
import { pinnedTabsController } from "@/controllers/pinned-tabs-controller";
import { setUsingSpace } from "@/ipc/session/spaces";
import { extractReaderArticle, isReaderEligibleUrl } from "@/modules/reader-mode";
import { captureVisibleTabPage } from "@/modules/page-capture";
import { getAllFavourites, addFavourite } from "@/saving/favourites";
import { listBrowsingVisitsPageForProfile } from "@/saving/history/browsing-history";
import type {
  McpExecutionContext,
  McpResourceDefinition,
  McpToolDefinition,
  McpToolResult,
  McpToolScope
} from "./types";

const MAX_TEXT_CHARS = 32_000;
const MAX_SNAPSHOT_ELEMENTS = 160;
const SAFE_EXTERNAL_SCHEMES = new Set(["http:", "https:"]);
const SAFE_LUMI_HOSTS = new Set([
  "new-tab",
  "history",
  "downloads",
  "extensions",
  "bangs",
  "settings",
  "about",
  "games"
]);

const SCOPE_RANK: Record<"read-only" | "interactive" | "full", number> = {
  "read-only": 1,
  interactive: 2,
  full: 3
};

const REQUIRED_RANK: Record<McpToolScope, number> = {
  read: 1,
  interactive: 2,
  full: 3
};

export function isToolPermitted(accessMode: "read-only" | "interactive" | "full", tool: McpToolDefinition): boolean {
  return SCOPE_RANK[accessMode] >= REQUIRED_RANK[tool.scope];
}

function textResult(text: string, isError = false): McpToolResult {
  return { content: [{ type: "text", text }], isError };
}

function jsonResult(payload: unknown, isError = false): McpToolResult {
  return textResult(JSON.stringify(payload, null, 2), isError);
}

function isProfileAllowed(context: McpExecutionContext, profileId: string): boolean {
  if (context.config.allowedProfileId === "all") return true;
  return context.config.allowedProfileId === profileId;
}

function isInternalPageUrl(url: string): boolean {
  return url.startsWith("lumi-internal://") || url.startsWith("chrome://") || url.startsWith("devtools://");
}

function validateNavigationUrl(rawUrl: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { ok: false, error: "URL cannot be empty." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Invalid URL format. Include http://, https://, or lumi:// scheme." };
  }

  if (SAFE_EXTERNAL_SCHEMES.has(parsed.protocol)) {
    return { ok: true, url: parsed.toString() };
  }

  if (parsed.protocol === "lumi:" && SAFE_LUMI_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { ok: true, url: parsed.toString() };
  }

  return {
    ok: false,
    error: `Blocked unsafe URL scheme "${parsed.protocol}". Only http:, https:, and public lumi:// routes are permitted.`
  };
}

function getDefaultBrowserWindow() {
  return browserWindowsController.getFocusedWindow() ?? browserWindowsController.getWindows()[0] ?? null;
}

function resolveTabCandidate(explicitTabId: unknown, context: McpExecutionContext): Tab | null {
  if (typeof explicitTabId === "number" && Number.isFinite(explicitTabId)) {
    const found = tabsController.getTabById(explicitTabId);
    if (!found || found.isDestroyed) return null;
    return isProfileAllowed(context, found.profileId) ? found : null;
  }

  const win = getDefaultBrowserWindow();
  if (!win || !win.currentSpaceId) return null;

  const focused = tabsController.getFocusedTab(win.id, win.currentSpaceId);
  if (focused && !focused.isDestroyed && isProfileAllowed(context, focused.profileId)) {
    return focused;
  }

  const active = tabsController.getActiveTab(win.id, win.currentSpaceId);
  if (active) {
    const candidate = "tabs" in active ? active.tabs[0] : active;
    if (candidate && !candidate.isDestroyed && isProfileAllowed(context, candidate.profileId)) {
      return candidate;
    }
  }
  return null;
}

async function ensureAwakeWebContents(tab: Tab): Promise<WebContents | null> {
  if (tab.isDestroyed) return null;
  if (tab.asleep) {
    tabsController.getTabManagers(tab.id)?.lifecycle.wakeUp();
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  const wc = tab.webContents;
  if (!wc || wc.isDestroyed()) return null;
  return wc;
}

async function requireWebTab(
  args: Record<string, unknown>,
  context: McpExecutionContext
): Promise<{ ok: true; tab: Tab; wc: WebContents } | { ok: false; result: McpToolResult }> {
  const tab = resolveTabCandidate(args.tabId, context);
  if (!tab) {
    return {
      ok: false,
      result: textResult("No matching open tab found (or tab belongs to a profile excluded by MCP scope).", true)
    };
  }
  if (isInternalPageUrl(tab.url)) {
    return {
      ok: false,
      result: textResult(`Refusing inspection/automation on internal page "${tab.url}".`, true)
    };
  }
  const wc = await ensureAwakeWebContents(tab);
  if (!wc) {
    return { ok: false, result: textResult("Target tab WebContents is unavailable or sleeping.", true) };
  }
  return { ok: true, tab, wc };
}

async function waitForTabLoad(wc: WebContents, timeoutMs = 8000): Promise<void> {
  if (!wc.isLoading()) return;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      wc.removeListener("did-finish-load", finish);
      wc.removeListener("did-fail-load", finish);
      wc.removeListener("destroyed", finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    wc.once("did-finish-load", finish);
    wc.once("did-fail-load", finish);
    wc.once("destroyed", finish);
  });
}

function htmlToCleanText(html: string): string {
  return html
    .replace(/<(h[1-6])[^>]*>/gi, "\n\n## ")
    .replace(/<(?:p|div|li|blockquote|pre|tr)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function clampString(raw: string, max = MAX_TEXT_CHARS): string {
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}\n\n... [truncated ${raw.length - max} chars]`;
}

function serializeTab(tab: Tab, winFocusedTabId?: number) {
  return {
    tabId: tab.id,
    title: tab.title,
    url: tab.url,
    windowId: tab.getWindow().id,
    spaceId: tab.spaceId,
    profileId: tab.profileId,
    active: tab.id === winFocusedTabId || tab.visible,
    asleep: tab.asleep,
    loading: tab.isLoading,
    audible: tab.audible,
    muted: tab.muted,
    pinned: Boolean(pinnedTabsController.getPinnedIdByTabId(tab.id)),
    groupId: tab.groupId
  };
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "lumi_list_workspaces",
    description:
      "List open Lumi windows, profiles (excluding internal system profiles), spaces, and each window's currently active space.",
    scope: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async (_args, context) => {
      const profiles = (await profilesController.getAll())
        .filter((p) => !p.internal && isProfileAllowed(context, p.id))
        .map((p) => ({ id: p.id, name: p.name, ephemeral: Boolean(p.ephemeral) }));

      const allSpaces = await spacesController.getAll();
      const spaces = allSpaces
        .filter((s) => !profiles.every((p) => p.id !== s.profileId))
        .map((s) => ({
          id: s.id,
          name: s.name,
          profileId: s.profileId,
          icon: s.icon ?? null,
          bgStartColor: s.bgStartColor ?? null,
          bgEndColor: s.bgEndColor ?? null
        }));

      const windows = browserWindowsController.getWindows().map((win) => ({
        windowId: win.id,
        focused: win.browserWindow.isFocused(),
        currentSpaceId: win.currentSpaceId,
        tabCount: tabsController.getTabsInWindow(win.id).length
      }));

      return jsonResult({ profiles, spaces, windows });
    }
  },
  {
    name: "lumi_list_tabs",
    description: "List open tabs and pinned tabs in Lumi, optionally filtered by spaceId or windowId.",
    scope: "read",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "string", description: "Optional space ID to filter tabs." },
        windowId: { type: "number", description: "Optional browser window ID to filter tabs." }
      },
      additionalProperties: false
    },
    handler: async (args, context) => {
      const spaceFilter = typeof args.spaceId === "string" && args.spaceId.trim() ? args.spaceId.trim() : null;
      const winFilter = typeof args.windowId === "number" ? args.windowId : null;

      const tabs: ReturnType<typeof serializeTab>[] = [];
      for (const win of browserWindowsController.getWindows()) {
        if (winFilter !== null && win.id !== winFilter) continue;
        const focusedTab = win.currentSpaceId ? tabsController.getFocusedTab(win.id, win.currentSpaceId) : undefined;
        for (const tab of tabsController.getTabsInWindow(win.id)) {
          if (tab.isDestroyed || !isProfileAllowed(context, tab.profileId)) continue;
          if (spaceFilter && tab.spaceId !== spaceFilter) continue;
          tabs.push(serializeTab(tab, focusedTab?.id));
        }
      }

      const pinnedByProfile = pinnedTabsController.getAllByProfile();
      const pinned = Object.entries(pinnedByProfile)
        .filter(([profileId]) => isProfileAllowed(context, profileId))
        .flatMap(([, items]) =>
          items.map((pt) => ({
            pinnedId: pt.uniqueId,
            profileId: pt.profileId,
            defaultUrl: pt.defaultUrl,
            associatedTabIdsBySpace: pt.associatedTabIdsBySpace ?? {}
          }))
        );

      return jsonResult({ count: tabs.length, tabs, pinnedTabs: pinned });
    }
  },
  {
    name: "lumi_read_page",
    description:
      "Extract clean, token-efficient readable text from a tab using Lumi Reader Mode heuristics (or clean visible text fallback).",
    scope: "read",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Target tab ID. Omit to read the active focused tab." },
        maxChars: { type: "number", description: "Optional max characters to return (default 24000, max 32000)." }
      },
      additionalProperties: false
    },
    handler: async (args, context) => {
      const resolved = await requireWebTab(args, context);
      if (!resolved.ok) return resolved.result;
      const { tab, wc } = resolved;

      const limit = typeof args.maxChars === "number" ? Math.max(500, Math.min(MAX_TEXT_CHARS, args.maxChars)) : 24_000;

      if (isReaderEligibleUrl(wc.getURL())) {
        const reader = await extractReaderArticle(wc);
        if (reader.ok) {
          const text = htmlToCleanText(reader.article.contentHtml);
          return jsonResult({
            tabId: tab.id,
            title: reader.article.title || tab.title,
            url: reader.article.url,
            byline: reader.article.byline,
            siteName: reader.article.siteName,
            readingTimeMinutes: reader.article.readingTimeMinutes,
            extractor: "reader-mode",
            content: clampString(text, limit)
          });
        }
      }

      const plain = (await wc.executeJavaScript(
        `(() => ({
          title: document.title || "",
          url: location.href,
          text: (document.body?.innerText || "").trim()
        }))()`,
        true
      )) as { title: string; url: string; text: string };

      return jsonResult({
        tabId: tab.id,
        title: plain.title || tab.title,
        url: plain.url || tab.url,
        extractor: "innerText",
        content: clampString(plain.text, limit)
      });
    }
  },
  {
    name: "lumi_get_page_snapshot",
    description:
      "Capture a compact index of interactive elements (buttons, links, inputs, selects) on the page with stable selectors and coordinates for reliable clicking or typing.",
    scope: "read",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Target tab ID. Omit for active tab." }
      },
      additionalProperties: false
    },
    handler: async (args, context) => {
      const resolved = await requireWebTab(args, context);
      if (!resolved.ok) return resolved.result;
      const { tab, wc } = resolved;

      const snapshot = await wc.executeJavaScript(
        `(() => {
          const nodes = [];
          const selectorFor = (el) => {
            if (el.id) return "#" + CSS.escape(el.id);
            const testId = el.getAttribute("data-testid") || el.getAttribute("name");
            if (testId) return el.tagName.toLowerCase() + '[data-testid="' + CSS.escape(testId) + '"], ' + el.tagName.toLowerCase() + '[name="' + CSS.escape(testId) + '"]';
            const parts = [];
            let cur = el;
            while (cur && cur.nodeType === 1 && parts.length < 4 && cur.tagName !== "BODY") {
              let seg = cur.tagName.toLowerCase();
              const parent = cur.parentElement;
              if (parent) {
                const same = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
                if (same.length > 1) seg += ":nth-of-type(" + (same.indexOf(cur) + 1) + ")";
              }
              parts.unshift(seg);
              cur = parent;
            }
            return parts.join(" > ");
          };
          const candidates = document.querySelectorAll("a[href], button, input, textarea, select, [role='button'], [role='link'], [role='tab']");
          let ref = 1;
          for (const el of candidates) {
            if (nodes.length >= ${MAX_SNAPSHOT_ELEMENTS}) break;
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            if (rect.width < 2 || rect.height < 2 || style.visibility === "hidden" || style.display === "none") continue;
            const inViewport = rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth;
            const label = (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.innerText || el.value || "").replace(/\\s+/g, " ").trim().slice(0, 90);
            if (!label && el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") continue;
            nodes.push({
              ref: ref++,
              tag: el.tagName.toLowerCase(),
              type: el.getAttribute("type") || undefined,
              label,
              href: el.tagName === "A" ? el.getAttribute("href") || undefined : undefined,
              selector: selectorFor(el),
              inViewport,
              center: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
            });
          }
          return {
            title: document.title,
            url: location.href,
            scrollY: Math.round(window.scrollY),
            scrollHeight: document.documentElement.scrollHeight,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            interactiveCount: nodes.length,
            elements: nodes
          };
        })()`,
        true
      );

      return jsonResult({ tabId: tab.id, ...snapshot });
    }
  },
  {
    name: "lumi_capture_screenshot",
    description: "Capture a screenshot image of a tab's visible viewport (returned as an MCP image content block).",
    scope: "read",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Target tab ID. Omit for active tab." },
        maxWidth: { type: "number", description: "Optional max width in pixels (default 1440)." }
      },
      additionalProperties: false
    },
    handler: async (args, context) => {
      const tab = resolveTabCandidate(args.tabId, context);
      if (!tab) return textResult("Target tab not found or outside permitted profile scope.", true);
      if (isInternalPageUrl(tab.url)) {
        return textResult("Screenshots of internal browser windows are disabled.", true);
      }

      await ensureAwakeWebContents(tab);
      const capture = await captureVisibleTabPage(tab);
      if (!capture) return textResult("Failed to capture tab screenshot.", true);

      const rawB64 = capture.dataUrl.replace(/^data:image\/png;base64,/, "");
      const maxWidth = typeof args.maxWidth === "number" ? Math.max(320, Math.min(2560, args.maxWidth)) : 1440;
      const resized = await sharp(Buffer.from(rawB64, "base64"))
        .resize({ width: maxWidth, withoutEnlargement: true })
        .png({ compressionLevel: 8 })
        .toBuffer();

      return {
        content: [
          { type: "text", text: `Captured ${tab.title} (${tab.url}) — ${capture.width}x${capture.height}` },
          { type: "image", data: resized.toString("base64"), mimeType: "image/png" }
        ]
      };
    }
  },
  {
    name: "lumi_search_history",
    description: "Search Lumi browsing history across allowed profiles.",
    scope: "read",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional substring query matching URL or page title." },
        profileId: { type: "string", description: "Optional profile ID filter." },
        limit: { type: "number", description: "Max entries to return (1-100, default 25)." }
      },
      additionalProperties: false
    },
    handler: async (args, context) => {
      const profiles = (await profilesController.getAll()).filter(
        (p) => !p.internal && isProfileAllowed(context, p.id)
      );
      const profileId = typeof args.profileId === "string" && args.profileId.trim() ? args.profileId.trim() : null;
      const limit = typeof args.limit === "number" ? Math.max(1, Math.min(100, args.limit)) : 25;
      const query = typeof args.query === "string" ? args.query.trim() : undefined;

      const targetProfiles = profileId ? profiles.filter((p) => p.id === profileId) : profiles;
      const items = targetProfiles
        .flatMap((p) =>
          listBrowsingVisitsPageForProfile(p.id, { search: query, limit }).visits.map((v) => ({
            profileId: p.id,
            title: v.title,
            url: v.url,
            visitedAt: new Date(v.visitTime).toISOString()
          }))
        )
        .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
        .slice(0, limit);

      return jsonResult({ count: items.length, visits: items });
    }
  },
  {
    name: "lumi_search_bookmarks",
    description: "Search or list Lumi saved bookmarks / favourites.",
    scope: "read",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional search substring matching title or URL." }
      },
      additionalProperties: false
    },
    handler: async (args) => {
      const all = await getAllFavourites();
      const q = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      const filtered = q
        ? all.filter((f) => f.title.toLowerCase().includes(q) || f.url.toLowerCase().includes(q))
        : all;
      return jsonResult({ count: filtered.length, bookmarks: filtered.slice(0, 100) });
    }
  },
  {
    name: "lumi_open_tab",
    description: "Open a URL in a new Lumi tab inside the active or specified Space.",
    scope: "interactive",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Destination http://, https://, or public lumi:// URL." },
        spaceId: { type: "string", description: "Optional Space ID. Defaults to the focused window's current Space." },
        activate: { type: "boolean", description: "Focus the new tab immediately (default true)." },
        waitForLoad: { type: "boolean", description: "Wait up to 8s for initial load completion (default true)." }
      },
      required: ["url"],
      additionalProperties: false
    },
    handler: async (args, context) => {
      const urlCheck = validateNavigationUrl(String(args.url ?? ""));
      if (!urlCheck.ok) return textResult(urlCheck.error, true);

      const win = getDefaultBrowserWindow();
      if (!win) return textResult("No open Lumi browser window available.", true);

      const targetSpaceId =
        typeof args.spaceId === "string" && args.spaceId.trim() ? args.spaceId.trim() : win.currentSpaceId;
      const space = targetSpaceId ? await spacesController.get(targetSpaceId) : null;
      if (!space) return textResult("Could not resolve destination Lumi Space.", true);
      if (!isProfileAllowed(context, space.profileId)) {
        return textResult(`Profile "${space.profileId}" is outside current MCP profile scope.`, true);
      }

      const activate = args.activate !== false;
      const tab = await tabsController.createTab(win.id, space.profileId, targetSpaceId!, undefined, {
        url: urlCheck.url,
        typedNavigation: true
      });
      if (activate) {
        tabsController.activateTab(tab);
      }

      if (args.waitForLoad !== false && tab.webContents) {
        await waitForTabLoad(tab.webContents, 8000);
      }

      return jsonResult({
        opened: true,
        tabId: tab.id,
        url: tab.url || urlCheck.url,
        title: tab.title,
        spaceId: tab.spaceId,
        profileId: tab.profileId
      });
    }
  },
  {
    name: "lumi_navigate_tab",
    description: "Navigate an existing tab to a URL, or perform back / forward / reload.",
    scope: "interactive",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Target tab ID. Omit for active tab." },
        action: {
          type: "string",
          enum: ["goto", "back", "forward", "reload"],
          description: "Navigation action (default goto)."
        },
        url: { type: "string", description: "Destination URL when action is 'goto'." }
      },
      additionalProperties: false
    },
    handler: async (args, context) => {
      const resolved = await requireWebTab(args, context);
      if (!resolved.ok) return resolved.result;
      const { tab, wc } = resolved;

      const action = typeof args.action === "string" ? args.action : "goto";
      if (action === "back") {
        if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
      } else if (action === "forward") {
        if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
      } else if (action === "reload") {
        wc.reload();
      } else {
        const urlCheck = validateNavigationUrl(String(args.url ?? ""));
        if (!urlCheck.ok) return textResult(urlCheck.error, true);
        tab.loadURL(urlCheck.url);
      }

      await waitForTabLoad(wc, 8000);
      return jsonResult({ tabId: tab.id, url: wc.getURL(), title: wc.getTitle() });
    }
  },
  {
    name: "lumi_activate_tab",
    description: "Focus an existing tab by tabId and switch its window to that tab's Space if needed.",
    scope: "interactive",
    inputSchema: {
      type: "object",
      properties: { tabId: { type: "number", description: "Tab ID to activate." } },
      required: ["tabId"],
      additionalProperties: false
    },
    handler: async (args, context) => {
      const tab = resolveTabCandidate(args.tabId, context);
      if (!tab) return textResult("Tab not found or outside permitted profile scope.", true);

      const win = tab.getWindow();
      if (win && !win.destroyed && win.currentSpaceId !== tab.spaceId) {
        await setUsingSpace(win, tab.profileId, tab.spaceId);
      }
      tabsController.activateTab(tab);
      win?.browserWindow.focus();
      return jsonResult({ activated: true, tabId: tab.id, url: tab.url, title: tab.title, spaceId: tab.spaceId });
    }
  },
  {
    name: "lumi_close_tab",
    description: "Close an open non-pinned tab by tabId.",
    scope: "interactive",
    inputSchema: {
      type: "object",
      properties: { tabId: { type: "number", description: "Tab ID to close." } },
      required: ["tabId"],
      additionalProperties: false
    },
    handler: async (args, context) => {
      const tab = resolveTabCandidate(args.tabId, context);
      if (!tab) return textResult("Tab not found or outside permitted profile scope.", true);
      if (pinnedTabsController.getPinnedIdByTabId(tab.id)) {
        return textResult("Refusing to close a pinned sidebar tab via MCP.", true);
      }
      const info = { closed: true, tabId: tab.id, url: tab.url, title: tab.title };
      tab.destroy();
      return jsonResult(info);
    }
  },
  {
    name: "lumi_switch_space",
    description: "Switch the active Lumi Space in the focused (or specified) browser window.",
    scope: "interactive",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "string", description: "Target Space ID or exact Space name." },
        windowId: { type: "number", description: "Optional window ID." }
      },
      required: ["spaceId"],
      additionalProperties: false
    },
    handler: async (args, context) => {
      const query = String(args.spaceId ?? "").trim();
      const allSpaces = await spacesController.getAll();
      const target =
        allSpaces.find((s) => s.id === query) ?? allSpaces.find((s) => s.name.toLowerCase() === query.toLowerCase());

      if (!target) return textResult(`Space "${query}" not found.`, true);
      if (!isProfileAllowed(context, target.profileId)) {
        return textResult(`Profile "${target.profileId}" is outside current MCP profile scope.`, true);
      }

      const win =
        typeof args.windowId === "number"
          ? browserWindowsController.getWindowById(args.windowId)
          : getDefaultBrowserWindow();
      if (!win) return textResult("No open Lumi window found.", true);

      const ok = await setUsingSpace(win, target.profileId, target.id);
      return jsonResult({ switched: ok, windowId: win.id, spaceId: target.id, spaceName: target.name });
    }
  },
  {
    name: "lumi_open_split_view",
    description: "Open a URL side-by-side next to an existing tab using Lumi's native Split View.",
    scope: "interactive",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Destination URL for the split pane." },
        tabId: { type: "number", description: "Anchor tab ID (defaults to active focused tab)." },
        direction: {
          type: "string",
          enum: ["horizontal", "vertical"],
          description: "Split direction (default horizontal)."
        }
      },
      required: ["url"],
      additionalProperties: false
    },
    handler: async (args, context) => {
      const urlCheck = validateNavigationUrl(String(args.url ?? ""));
      if (!urlCheck.ok) return textResult(urlCheck.error, true);

      const tab = resolveTabCandidate(args.tabId, context);
      if (!tab) return textResult("Anchor tab not found or outside permitted profile scope.", true);

      const dir = args.direction === "vertical" ? "vertical" : "horizontal";
      const group = await tabsController.openUrlInSplit(tab, urlCheck.url, dir);
      if (!group) return textResult("Failed to create Split View.", true);

      const newPane = group.tabs.find((t) => t.id !== tab.id);
      if (newPane?.webContents && args.waitForLoad !== false) {
        await waitForTabLoad(newPane.webContents, 6000);
      }

      return jsonResult({
        groupId: group.groupId,
        direction: dir,
        tabs: group.tabs.map((t) => ({
          tabId: t.id,
          url: t.url || (t.id === newPane?.id ? urlCheck.url : ""),
          title: t.title
        }))
      });
    }
  },
  {
    name: "lumi_interact_page",
    description:
      "Interact with elements inside a live web tab: click selector, fill/type into an input, press Enter/Escape/Tab, or scroll the viewport.",
    scope: "interactive",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Target tab ID. Omit for active tab." },
        action: { type: "string", enum: ["click", "type", "scroll"], description: "Interaction action." },
        selector: { type: "string", description: "CSS selector (from lumi_get_page_snapshot) for click or type." },
        text: { type: "string", description: "Text to enter when action is 'type'." },
        submit: { type: "boolean", description: "Submit form / press Enter after typing (default false)." },
        deltaY: { type: "number", description: "Vertical scroll pixels when action is 'scroll' (default 500)." }
      },
      required: ["action"],
      additionalProperties: false
    },
    handler: async (args, context) => {
      const resolved = await requireWebTab(args, context);
      if (!resolved.ok) return resolved.result;
      const { tab, wc } = resolved;

      const action = String(args.action ?? "");
      const selector = typeof args.selector === "string" ? args.selector : "";
      const text = typeof args.text === "string" ? args.text : "";
      const submit = Boolean(args.submit);
      const deltaY = typeof args.deltaY === "number" ? args.deltaY : 500;

      const outcome = await wc.executeJavaScript(
        `((payload) => {
          const { action, selector, text, submit, deltaY } = payload;
          if (action === "scroll") {
            if (selector) {
              const target = document.querySelector(selector);
              if (!target) return { ok: false, error: "Element not found: " + selector };
              target.scrollIntoView({ behavior: "smooth", block: "center" });
              return { ok: true, scrollY: Math.round(window.scrollY) };
            }
            window.scrollBy({ top: deltaY, behavior: "smooth" });
            return { ok: true, scrollY: Math.round(window.scrollY + deltaY) };
          }
          const el = selector ? document.querySelector(selector) : document.activeElement;
          if (!el) return { ok: false, error: "Element not found: " + selector };
          if (action === "click") {
            el.scrollIntoView({ block: "center" });
            el.focus?.();
            el.click();
            return { ok: true, tag: el.tagName.toLowerCase(), url: location.href };
          }
          if (action === "type") {
            el.scrollIntoView({ block: "center" });
            el.focus();
            if ("value" in el) {
              const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
              if (setter) setter.call(el, text);
              else el.value = text;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            } else if (el.isContentEditable) {
              el.textContent = text;
              el.dispatchEvent(new Event("input", { bubbles: true }));
            } else {
              return { ok: false, error: "Target element is not text-editable" };
            }
            if (submit) {
              el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
              el.form?.requestSubmit?.();
            }
            return { ok: true, length: text.length, submitted: submit };
          }
          return { ok: false, error: "Unsupported action: " + action };
        })(${JSON.stringify({ action, selector, text, submit, deltaY })})`,
        true
      );

      if (outcome && !outcome.ok) {
        return textResult(String(outcome.error || "Interaction failed"), true);
      }
      return jsonResult({ tabId: tab.id, ...outcome });
    }
  },
  {
    name: "lumi_add_bookmark",
    description: "Save a URL to Lumi Bookmarks / Favourites.",
    scope: "interactive",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Bookmark title." },
        url: { type: "string", description: "Bookmark URL." }
      },
      required: ["url"],
      additionalProperties: false
    },
    handler: async (args) => {
      const check = validateNavigationUrl(String(args.url ?? ""));
      if (!check.ok) return textResult(check.error, true);
      const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : check.url;
      const saved = await addFavourite(title, check.url);
      return jsonResult(saved);
    }
  },
  {
    name: "lumi_evaluate_js",
    description:
      "Execute arbitrary JavaScript inside a web tab's page context and return the JSON-serialized value. Requires MCP Access Mode = Full and Allow Script Execution enabled.",
    scope: "full",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Target tab ID. Omit for active tab." },
        expression: { type: "string", description: "JavaScript expression or IIFE to evaluate." }
      },
      required: ["expression"],
      additionalProperties: false
    },
    handler: async (args, context) => {
      if (!context.config.allowExternalJs) {
        return textResult(
          "lumi_evaluate_js is disabled. Enable 'Allow Arbitrary Script Execution' in Lumi Settings -> MCP Server.",
          true
        );
      }
      const resolved = await requireWebTab(args, context);
      if (!resolved.ok) return resolved.result;
      const expression = String(args.expression ?? "").trim();
      if (!expression) return textResult("Expression cannot be empty.", true);

      const value = await resolved.wc.executeJavaScript(expression, true);
      return jsonResult({ tabId: resolved.tab.id, result: value ?? null });
    }
  }
];

export const MCP_RESOURCES: McpResourceDefinition[] = [
  {
    uri: "lumi://active-tab",
    name: "Active Tab",
    description: "Current focused Lumi tab metadata and clean extracted readable text.",
    mimeType: "application/json",
    read: async (context) => {
      const tool = MCP_TOOLS.find((t) => t.name === "lumi_read_page")!;
      const res = await tool.handler({}, context);
      return res.content[0]?.type === "text" ? res.content[0].text : "{}";
    }
  },
  {
    uri: "lumi://tabs",
    name: "Open Tabs & Pinned Tabs",
    description: "Live JSON list of open tabs and pinned tabs across allowed profiles.",
    mimeType: "application/json",
    read: async (context) => {
      const tool = MCP_TOOLS.find((t) => t.name === "lumi_list_tabs")!;
      const res = await tool.handler({}, context);
      return res.content[0]?.type === "text" ? res.content[0].text : "{}";
    }
  },
  {
    uri: "lumi://bookmarks",
    name: "Lumi Bookmarks",
    description: "Saved Lumi favourites / bookmarks.",
    mimeType: "application/json",
    read: async (context) => {
      const tool = MCP_TOOLS.find((t) => t.name === "lumi_search_bookmarks")!;
      const res = await tool.handler({}, context);
      return res.content[0]?.type === "text" ? res.content[0].text : "{}";
    }
  }
];
