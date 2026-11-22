import { sendMessageToListeners } from "@/ipc/listeners-manager";
import { tabsController } from "@/controllers/tabs-controller";
import { extractReaderArticle, isReaderEligibleUrl } from "@/modules/reader-mode";
import { getDatastore } from "@/saving/datastore";
import {
  DEFAULT_READER_PREFERENCES,
  type ReaderArticle,
  type ReaderPreferences,
  type ReaderTabState
} from "~/types/reader";

const ReaderModeDataStore = getDatastore("reader-mode");
const PREFS_KEY = "preferences";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePreferences(raw: Partial<ReaderPreferences> | undefined | null): ReaderPreferences {
  const base = { ...DEFAULT_READER_PREFERENCES, ...(raw ?? {}) };
  const theme = base.theme === "dark" || base.theme === "sepia" || base.theme === "light" ? base.theme : "light";
  const fontFamily =
    base.fontFamily === "sans" || base.fontFamily === "mono" || base.fontFamily === "serif" ? base.fontFamily : "serif";

  return {
    theme,
    fontFamily,
    fontSize: Math.round(clamp(Number(base.fontSize) || 18, 14, 28)),
    lineHeight: Number(clamp(Number(base.lineHeight) || 1.75, 1.35, 2.2).toFixed(2)),
    maxWidth: Math.round(clamp(Number(base.maxWidth) || 680, 520, 920))
  };
}

class ReaderModeController {
  private articleCache = new Map<number, ReaderArticle>();
  private preferencesCache: ReaderPreferences | null = null;
  private preferencesLoadPromise: Promise<ReaderPreferences> | null = null;

  private emitTabState(state: ReaderTabState): void {
    sendMessageToListeners("reader:on-state-changed", state);
  }

  async getPreferences(): Promise<ReaderPreferences> {
    if (this.preferencesCache) return this.preferencesCache;
    if (this.preferencesLoadPromise) return this.preferencesLoadPromise;

    this.preferencesLoadPromise = (async () => {
      try {
        const stored = await ReaderModeDataStore.get<Partial<ReaderPreferences>>(PREFS_KEY);
        this.preferencesCache = normalizePreferences(stored);
      } catch {
        this.preferencesCache = { ...DEFAULT_READER_PREFERENCES };
      }
      return this.preferencesCache;
    })();

    return this.preferencesLoadPromise;
  }

  async updatePreferences(updates: Partial<ReaderPreferences>): Promise<ReaderPreferences> {
    const current = await this.getPreferences();
    const next = normalizePreferences({ ...current, ...updates });
    this.preferencesCache = next;
    await ReaderModeDataStore.set(PREFS_KEY, next);
    sendMessageToListeners("reader:on-preferences-changed", next);
    return next;
  }

  getArticle(tabId: number): ReaderArticle | null {
    const tab = tabsController.getTabById(tabId);
    const cached = this.articleCache.get(tabId) ?? null;
    if (!tab || !cached) return null;
    if (cached.url !== tab.url) {
      this.articleCache.delete(tabId);
      return null;
    }
    return cached;
  }

  async enable(tabId: number): Promise<ReaderTabState> {
    const tab = tabsController.getTabById(tabId);
    if (!tab || tab.isDestroyed) {
      return { tabId, active: false, article: null, error: "Tab is no longer open" };
    }

    if (tab.asleep || !tab.webContents || tab.webContents.isDestroyed()) {
      return { tabId, active: false, article: null, error: "Tab is sleeping" };
    }

    if (!isReaderEligibleUrl(tab.url)) {
      return { tabId, active: false, article: null, error: "Reader Mode works on web articles" };
    }

    let article = this.getArticle(tabId);
    if (!article) {
      const extracted = await extractReaderArticle(tab.webContents);
      if (!extracted.ok) {
        return { tabId, active: false, article: null, error: extracted.reason };
      }
      article = extracted.article;
      this.articleCache.set(tabId, article);
    }

    if (tab.fullScreen) {
      tabsController.getTabManagers(tabId)?.lifecycle.setFullScreen(false);
    }
    tab.updateStateProperty("readerMode", true);
    tabsController.getTabManagers(tabId)?.layout.updateLayout(true);

    const state: ReaderTabState = { tabId, active: true, article };
    this.emitTabState(state);
    return state;
  }

  disable(tabId: number): boolean {
    const tab = tabsController.getTabById(tabId);
    if (!tab) {
      this.articleCache.delete(tabId);
      return false;
    }

    if (!tab.readerMode) {
      return true;
    }

    tab.updateStateProperty("readerMode", false);
    const layout = tabsController.getTabManagers(tabId)?.layout;
    layout?.updateLayout(true);

    if (tab.visible && tab.webContents && !tab.webContents.isDestroyed()) {
      tab.webContents.focus();
    }

    this.emitTabState({ tabId, active: false, article: this.getArticle(tabId) });
    return true;
  }

  async toggle(tabId: number): Promise<ReaderTabState> {
    const tab = tabsController.getTabById(tabId);
    if (!tab) {
      return { tabId, active: false, article: null, error: "Tab not found" };
    }

    if (tab.readerMode) {
      this.disable(tabId);
      return { tabId, active: false, article: this.getArticle(tabId) };
    }

    return await this.enable(tabId);
  }

  onTabUrlChanged(tabId: number, newUrl: string): void {
    const cached = this.articleCache.get(tabId);
    if (cached && cached.url === newUrl) {
      return;
    }

    this.articleCache.delete(tabId);
    const tab = tabsController.getTabById(tabId);
    if (tab?.readerMode) {
      this.disable(tabId);
    }
  }

  clearTab(tabId: number): void {
    this.articleCache.delete(tabId);
  }
}

export const readerModeController = new ReaderModeController();
