import { session, WebContentsView } from "electron";
import { Layer } from "@/controllers/windows-controller/layer-manager";
import { createModalTo, focusPriorities, zIndexes } from "~/layers";
import { sessionsController } from "@/controllers/sessions-controller";
import type { BrowserWindow as LumiBrowserWindow } from "@/controllers/windows-controller/types/browser";
import type { CompanionWebState, SidePanelBounds } from "~/lumi/interfaces/browser/side-panel";

function normalizeCompanionUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/|lumi:\/\/)/i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+/.test(trimmed) && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

export class SidePanelController {
  private parentWindow: LumiBrowserWindow;
  private view: WebContentsView | null = null;
  private layer: Layer | null = null;
  private isDestroyed = false;
  private isVisible = false;
  private currentMode: "scratchpad" | "web" = "scratchpad";
  private currentUrl = "https://duckduckgo.com";
  private lastBounds: SidePanelBounds | null = null;

  constructor(parentWindow: LumiBrowserWindow) {
    this.parentWindow = parentWindow;
  }

  private ensureView(): WebContentsView | null {
    if (this.isDestroyed || this.parentWindow.destroyed) return null;
    if (this.view) return this.view;

    const activeSession = sessionsController.getIfExists("main") ?? session.defaultSession;
    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        session: activeSession
      }
    });
    view.setBorderRadius(10);

    const wc = view.webContents;
    const emitState = () => {
      if (this.isDestroyed || wc.isDestroyed() || this.parentWindow.destroyed) return;
      const state: CompanionWebState = {
        url: wc.getURL() || this.currentUrl,
        title: wc.getTitle() || "Companion Web",
        isLoading: wc.isLoading(),
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward()
      };
      this.parentWindow.sendMessageToCoreWebContents("side-panel:on-state", state);
    };

    wc.on("did-start-loading", emitState);
    wc.on("did-stop-loading", emitState);
    wc.on("did-navigate", emitState);
    wc.on("did-navigate-in-page", emitState);
    wc.on("page-title-updated", emitState);
    wc.setWindowOpenHandler(({ url }) => {
      if (url && /^https?:\/\//i.test(url)) {
        void wc.loadURL(url);
      }
      return { action: "deny" };
    });

    this.view = view;
    this.layer = new Layer(
      this.parentWindow.layerManager,
      view,
      zIndexes.tab,
      focusPriorities.tab,
      createModalTo("tab")
    );
    this.parentWindow.layerManager.push(this.layer);

    void wc.loadURL(this.currentUrl).catch(() => undefined);
    return view;
  }

  private applyVisibilityAndBounds(): void {
    if (!this.view || this.isDestroyed) return;
    const shouldShow = this.isVisible && this.currentMode === "web";
    if (this.layer) {
      this.layer.setVisible(shouldShow);
    } else {
      this.view.setVisible(shouldShow);
    }
    if (shouldShow && this.lastBounds && this.lastBounds.width > 10 && this.lastBounds.height > 10) {
      this.view.setBounds({
        x: Math.round(this.lastBounds.x),
        y: Math.round(this.lastBounds.y),
        width: Math.round(this.lastBounds.width),
        height: Math.round(this.lastBounds.height)
      });
    } else if (!shouldShow) {
      this.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  }

  public async setState(params: {
    visible: boolean;
    mode: "scratchpad" | "web";
    url?: string;
    bounds?: SidePanelBounds;
  }): Promise<boolean> {
    if (this.isDestroyed) return false;
    this.isVisible = params.visible;
    this.currentMode = params.mode;
    if (params.bounds) {
      this.lastBounds = params.bounds;
    }

    if (params.visible && params.mode === "web") {
      const view = this.ensureView();
      if (!view) return false;
      if (params.url && params.url !== this.currentUrl) {
        const normalized = normalizeCompanionUrl(params.url);
        if (normalized) {
          this.currentUrl = normalized;
          void view.webContents.loadURL(normalized).catch(() => undefined);
        }
      }
    }

    this.applyVisibilityAndBounds();
    return true;
  }

  public async navigate(rawUrl: string): Promise<boolean> {
    const normalized = normalizeCompanionUrl(rawUrl);
    if (!normalized) return false;
    this.currentUrl = normalized;
    const view = this.ensureView();
    if (!view) return false;
    await view.webContents.loadURL(normalized).catch(() => undefined);
    return true;
  }

  public async goBack(): Promise<boolean> {
    if (!this.view || this.view.webContents.isDestroyed()) return false;
    if (this.view.webContents.navigationHistory.canGoBack()) {
      this.view.webContents.navigationHistory.goBack();
      return true;
    }
    return false;
  }

  public async goForward(): Promise<boolean> {
    if (!this.view || this.view.webContents.isDestroyed()) return false;
    if (this.view.webContents.navigationHistory.canGoForward()) {
      this.view.webContents.navigationHistory.goForward();
      return true;
    }
    return false;
  }

  public async reload(): Promise<boolean> {
    if (!this.view || this.view.webContents.isDestroyed()) return false;
    this.view.webContents.reload();
    return true;
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.isVisible = false;
    if (this.layer) {
      this.parentWindow.layerManager.pop(this.layer);
      this.layer = null;
    }
    if (this.view) {
      if (!this.view.webContents.isDestroyed()) {
        this.view.webContents.close();
      }
      this.view = null;
    }
  }
}
