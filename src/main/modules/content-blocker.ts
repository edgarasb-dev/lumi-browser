import { debugPrint } from "@/modules/output";
import { LUMI_DATA_DIR } from "@/modules/paths";
import { getSettingValueById, onSettingsCached, settingsEmitter } from "@/saving/settings";
import { getDatastore } from "@/saving/datastore";
import { ElectronBlocker } from "@ghostery/adblocker-electron";
import { ipcMain, Session, webContents, type WebContents } from "electron";
import fs from "fs/promises";
import path from "path";
import { parse as parseTld } from "tldts";
import { loadedProfilesController } from "@/controllers/loaded-profiles-controller";
import { profilesController } from "@/controllers/profiles-controller";
import { unifiedWebRequests } from "@/controllers/sessions-controller";
import { tabsController } from "@/controllers/tabs-controller";
import type { Tab } from "@/controllers/tabs-controller/tab";
import { sendMessageToListeners } from "@/ipc/listeners-manager";
import type { BlockedRequestItem, TabBlockerStats } from "~/lumi/interfaces/browser/content-blocker";

type BlockerInstanceType = "all" | "adsAndTrackers" | "adsOnly";

const SESSION_KEY = "content-blocker";
const FOCUS_SESSION_KEY = "lumi-focus-blocklist";
const ContentBlockerDataStore = getDatastore("content-blocker");
const ADBLOCKER_CACHE_DIR = path.join(LUMI_DATA_DIR, "adblocker-cache");
const STATS_SAVE_DEBOUNCE_MS = 30_000;
const MAX_WHITELIST_URL_CACHE = 256;
const COSMETIC_INJECT_CHANNEL = "@ghostery/adblocker/inject-cosmetic-filters";
const MUTATION_OBSERVER_CHANNEL = "@ghostery/adblocker/is-mutation-observer-enabled";

const DEFAULT_FOCUS_DOMAINS = ["youtube.com", "x.com", "twitter.com", "reddit.com", "instagram.com", "tiktok.com"];

function wrapIsolatedScriptlet(script: string): string {
  return `(function(scriptletGlobals){\n${script}\n})(globalThis.scriptletGlobals ?? (globalThis.scriptletGlobals = {}));`;
}

/**
 * Executes cosmetic scriptlets in isolated function scopes sharing `scriptletGlobals`.
 * Ghostery's default un-isolated `executeJavaScript(script)` runs scriptlets at top-level
 * window scope, where shared identifiers like `JSONPath` throw SyntaxError and repeated
 * `function proxyApplyFn()` declarations overwrite `proxyApplyFn.nativeToString` with an
 * already-proxied `Function.prototype.toString`, triggering infinite stack overflow on sites
 * like YouTube and aborting player initialization.
 */
async function executeIsolatedCosmeticScripts(sender: WebContents, scripts: string[]): Promise<void> {
  if (sender.isDestroyed() || scripts.length === 0) return;

  const bundle = scripts.map((script) => `try{\n${wrapIsolatedScriptlet(script)}\n}catch{}`).join(";\n");
  try {
    await sender.executeJavaScript(bundle, true);
  } catch {
    for (const script of scripts) {
      if (sender.isDestroyed()) return;
      await sender.executeJavaScript(wrapIsolatedScriptlet(script), true).catch(() => {});
    }
  }
}

function clearCosmeticIpcHandlers(): void {
  ipcMain.removeHandler(COSMETIC_INJECT_CHANNEL);
  ipcMain.removeHandler(MUTATION_OBSERVER_CHANNEL);
}

function registerCosmeticIpcHandlers(blocker: ElectronBlocker): void {
  if (blocker.config.loadCosmeticFilters !== true) return;
  clearCosmeticIpcHandlers();
  ipcMain.handle(COSMETIC_INJECT_CHANNEL, blocker.onInjectCosmeticFilters);
  ipcMain.handle(MUTATION_OBSERVER_CHANNEL, blocker.onIsMutationObserverEnabled);
}

interface TabStatsData {
  tabId: number;
  blockedCount: number;
  blockedRequests: BlockedRequestItem[];
  hostname: string;
}

/**
 * ContentBlocker class manages ad and tracking content blocking functionality,
 * tracks per-tab blocked requests, maintains domain whitelisting, and reports stats.
 */
class ContentBlocker {
  private blockerInstancePromise: Promise<ElectronBlocker> | undefined = undefined;
  private blockerInstanceType: BlockerInstanceType | undefined = undefined;
  private blockedSessions: Map<string, Session> = new Map();

  private whitelistedDomainsSet: Set<string> = new Set();
  private urlWhitelistDecisionCache: Map<string, boolean> = new Map();
  private totalBlockedCount: number = 0;
  private totalBlockedDirty: boolean = false;
  private tabStatsMap: Map<number, TabStatsData> = new Map();
  private saveTimeout: NodeJS.Timeout | null = null;
  private isDataLoaded: boolean = false;
  private focusBlockActive: boolean = false;
  private focusBlockedDomains: string[] = [...DEFAULT_FOCUS_DOMAINS];
  private focusHookedSessions = new WeakSet<Session>();
  private configQueue: Promise<void> = Promise.resolve();

  /**
   * Load persisted content blocker settings (whitelisted domains and total count)
   */
  public async loadData(): Promise<void> {
    if (this.isDataLoaded) return;
    try {
      const savedWhitelisted = await ContentBlockerDataStore.get<string[]>("whitelistedDomains");
      if (Array.isArray(savedWhitelisted)) {
        this.whitelistedDomainsSet = new Set(savedWhitelisted.map((d) => d.toLowerCase().trim()));
      }

      const savedTotal = await ContentBlockerDataStore.get<number>("totalBlocked");
      if (typeof savedTotal === "number" && !isNaN(savedTotal)) {
        this.totalBlockedCount = savedTotal;
      }

      this.isDataLoaded = true;
    } catch (err) {
      debugPrint("CONTENT_BLOCKER", "Failed to load content blocker datastore:", err);
    }
  }

  /**
   * Check if a hostname matches any whitelisted domain (exact or subdomain)
   */
  public isDomainWhitelisted(hostname: string): boolean {
    if (!hostname) return false;
    const clean = hostname.toLowerCase().trim();
    for (const item of this.whitelistedDomainsSet) {
      if (clean === item || clean.endsWith("." + item)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Toggle or set whitelist status for a domain
   */
  public async toggleDomainWhitelist(rawDomain: string, whitelisted?: boolean): Promise<boolean> {
    await this.loadData();
    const cleanDomain = rawDomain.toLowerCase().trim();
    if (!cleanDomain) return false;

    const currentlyWhitelisted = this.isDomainWhitelisted(cleanDomain);
    const targetState = whitelisted !== undefined ? whitelisted : !currentlyWhitelisted;

    if (targetState) {
      this.whitelistedDomainsSet.add(cleanDomain);
    } else {
      for (const item of [...this.whitelistedDomainsSet]) {
        if (item === cleanDomain || cleanDomain.endsWith("." + item)) {
          this.whitelistedDomainsSet.delete(item);
        }
      }
    }

    await ContentBlockerDataStore.set("whitelistedDomains", [...this.whitelistedDomainsSet]);
    this.urlWhitelistDecisionCache.clear();
    sendMessageToListeners("content-blocker:whitelist-changed", [...this.whitelistedDomainsSet]);
    return targetState;
  }

  /**
   * Get all currently whitelisted domains
   */
  public async getWhitelistedDomains(): Promise<string[]> {
    await this.loadData();
    return [...this.whitelistedDomainsSet];
  }

  /**
   * Get lifetime total blocked count
   */
  public async getTotalBlocked(): Promise<number> {
    await this.loadData();
    return this.totalBlockedCount;
  }

  /**
   * Get stats for a specific tab
   */
  public getTabStats(tabId: number): TabBlockerStats {
    const tab = tabsController.getTabById(tabId);
    let hostname = "";
    if (tab?.url) {
      try {
        hostname = new URL(tab.url).hostname;
      } catch {
        hostname = "";
      }
    }

    const stats = this.tabStatsMap.get(tabId) || {
      tabId,
      blockedCount: 0,
      blockedRequests: [],
      hostname
    };

    return {
      tabId,
      blockedCount: stats.blockedCount,
      blockedRequests: [...stats.blockedRequests],
      isWhitelisted: hostname ? this.isDomainWhitelisted(hostname) : false,
      hostname,
      totalBlocked: this.totalBlockedCount
    };
  }

  /**
   * Record a blocked or redirected request for a webContents and its associated tab
   */
  private recordBlockedRequest(
    webContentsId: number | undefined,
    requestUrl: string,
    requestHost: string,
    requestType: string
  ): void {
    let tab: Tab | undefined;
    if (webContentsId) {
      try {
        const wc = webContents.fromId(webContentsId);
        if (wc) {
          tab = tabsController.getTabByWebContents(wc);
        }
      } catch {
        // webContents might already be destroyed
      }
    }

    this.totalBlockedCount++;
    this.totalBlockedDirty = true;
    this.scheduleSaveTotalBlocked();

    if (tab) {
      let stats = this.tabStatsMap.get(tab.id);
      if (!stats) {
        let hostname = "";
        try {
          if (tab.url) hostname = new URL(tab.url).hostname;
        } catch {
          // ignore invalid url
        }
        stats = {
          tabId: tab.id,
          blockedCount: 0,
          blockedRequests: [],
          hostname
        };
        this.tabStatsMap.set(tab.id, stats);
      }

      stats.blockedCount++;
      stats.blockedRequests.unshift({
        url: requestUrl,
        domain: requestHost || "Unknown",
        type: requestType || "other",
        timestamp: Date.now()
      });
      if (stats.blockedRequests.length > 50) {
        stats.blockedRequests.length = 50;
      }

      sendMessageToListeners("content-blocker:stats-updated", {
        tabId: tab.id,
        blockedCount: stats.blockedCount,
        totalBlocked: this.totalBlockedCount
      });
    }
  }

  /**
   * Reset stats when a tab navigates to a new URL
   */
  private handleTabNavigation(tab: Tab): void {
    let hostname = "";
    try {
      if (tab.url) hostname = new URL(tab.url).hostname;
    } catch {
      // ignore invalid url
    }

    const stats = this.tabStatsMap.get(tab.id);
    if (stats) {
      stats.blockedCount = 0;
      stats.blockedRequests = [];
      stats.hostname = hostname;
    } else {
      this.tabStatsMap.set(tab.id, {
        tabId: tab.id,
        blockedCount: 0,
        blockedRequests: [],
        hostname
      });
    }

    sendMessageToListeners("content-blocker:stats-updated", {
      tabId: tab.id,
      blockedCount: 0,
      totalBlocked: this.totalBlockedCount
    });
  }

  /**
   * Debounced save of total blocked counter to DataStore
   */
  private scheduleSaveTotalBlocked(): void {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      void this.flushPendingStats();
    }, STATS_SAVE_DEBOUNCE_MS);
  }

  public async flushPendingStats(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (!this.totalBlockedDirty) return;
    this.totalBlockedDirty = false;
    try {
      await ContentBlockerDataStore.set("totalBlocked", this.totalBlockedCount);
    } catch (err) {
      this.totalBlockedDirty = true;
      debugPrint("CONTENT_BLOCKER", "Failed to persist total blocked count:", err);
    }
  }

  private isPageUrlWhitelisted(pageUrl: string): boolean {
    if (!pageUrl || this.whitelistedDomainsSet.size === 0) return false;
    const cached = this.urlWhitelistDecisionCache.get(pageUrl);
    if (cached !== undefined) return cached;

    let result = false;
    try {
      const host = new URL(pageUrl).hostname;
      if (host) {
        result = this.isDomainWhitelisted(host);
      }
    } catch {
      result = false;
    }

    if (this.urlWhitelistDecisionCache.size >= MAX_WHITELIST_URL_CACHE) {
      const oldestKey = this.urlWhitelistDecisionCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.urlWhitelistDecisionCache.delete(oldestKey);
      }
    }
    this.urlWhitelistDecisionCache.set(pageUrl, result);
    return result;
  }

  /**
   * Creates or returns existing blocker instance of the specified type
   */
  private async createBlockerInstance(type: BlockerInstanceType): Promise<ElectronBlocker> {
    if (this.blockerInstancePromise && this.blockerInstanceType === type) {
      return this.blockerInstancePromise;
    }

    if (this.blockerInstancePromise) {
      await this.disableBlocker();
    }

    debugPrint("CONTENT_BLOCKER", "Creating blocker instance:", type);
    const cacheFilePath = path.join(ADBLOCKER_CACHE_DIR, `${type}.bin`);
    const caching = {
      path: cacheFilePath,
      read: async (filePath: string) => new Uint8Array(await fs.readFile(filePath)),
      write: async (filePath: string, buffer: Uint8Array) => {
        await fs.mkdir(ADBLOCKER_CACHE_DIR, { recursive: true });
        const tempPath = `${filePath}.${process.pid}.tmp`;
        try {
          await fs.writeFile(tempPath, buffer);
          await fs.rename(tempPath, filePath);
        } catch (err) {
          await fs.rm(tempPath, { force: true }).catch(() => {});
          throw err;
        }
      }
    };

    switch (type) {
      case "all":
        this.blockerInstancePromise = ElectronBlocker.fromPrebuiltFull(fetch, caching);
        break;
      case "adsAndTrackers":
        this.blockerInstancePromise = ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, caching);
        break;
      case "adsOnly":
        this.blockerInstancePromise = ElectronBlocker.fromPrebuiltAdsOnly(fetch, caching);
        break;
    }

    this.blockerInstancePromise = this.blockerInstancePromise.then((blocker) => {
      // Ghostery's blanket `$ping,3p` rule catches Chromium/Electron `fetch(..., { keepalive: true })`
      // requests (which Electron classifies as `resourceType: "ping"`), breaking backends like
      // Firebase Firestore WebChannel (`firestore.googleapis.com`). Remove that catch-all rule and
      // fall back to evaluating unmatched `ping` requests as `xhr` so tracker URL/$xhr rules still apply.
      blocker.updateFromDiff({ removed: ["$ping,3p"] });

      // Wrap onBeforeRequest to bypass blocking for whitelisted domains
      const originalOnBeforeRequest = blocker.onBeforeRequest.bind(blocker);
      blocker.onBeforeRequest = (details, callback) => {
        if (this.whitelistedDomainsSet.size > 0) {
          let pageUrl = "";
          if (details.webContentsId) {
            try {
              const wc = webContents.fromId(details.webContentsId);
              if (wc && !wc.isDestroyed()) {
                pageUrl = wc.getURL();
              }
            } catch {
              // ignore
            }
          }
          if (!pageUrl && details.referrer) {
            pageUrl = details.referrer;
          }

          if (pageUrl && this.isPageUrlWhitelisted(pageUrl)) {
            // Whitelisted domain: bypass blocking
            callback({});
            return;
          }
        }

        if (details.resourceType === "ping") {
          originalOnBeforeRequest(details, (response) => {
            if (response.cancel || response.redirectURL) {
              callback(response);
              return;
            }
            originalOnBeforeRequest({ ...details, resourceType: "xhr" }, callback);
          });
          return;
        }

        originalOnBeforeRequest(details, callback);
      };

      // Override cosmetic filter injection to bypass whitelisted domains and run scriptlets
      // inside isolated lexical scopes so multi-scriptlet injections never collide globally.
      blocker.onInjectCosmeticFilters = async (event, url, msg) => {
        if (!url || event.sender.isDestroyed()) {
          return;
        }
        if (this.whitelistedDomainsSet.size > 0 && this.isPageUrlWhitelisted(url)) {
          return;
        }

        const parsed = parseTld(url);
        const hostname = parsed.hostname || "";
        const domain = parsed.domain || "";
        const isFirstRun = msg === undefined;

        const { active, styles, scripts } = blocker.getCosmeticsFilters({
          domain,
          hostname,
          url,
          classes: msg?.classes,
          hrefs: msg?.hrefs,
          ids: msg?.ids,
          getBaseRules: isFirstRun,
          getInjectionRules: isFirstRun,
          getExtendedRules: false,
          getRulesFromHostname: isFirstRun,
          getRulesFromDOM: !isFirstRun,
          callerContext: {
            frameId: event.frameId,
            processId: event.processId,
            lifecycle: msg?.lifecycle
          }
        });

        if (active === false || event.sender.isDestroyed()) {
          return;
        }

        if (styles.length > 0) {
          void event.sender.insertCSS(styles, { cssOrigin: "user" }).catch(() => {});
        }

        if (scripts.length > 0) {
          await executeIsolatedCosmeticScripts(event.sender, scripts);
        }
      };

      blocker.on("request-blocked", (request) => {
        debugPrint("CONTENT_BLOCKER", "Request blocked:", request.url);
        this.recordBlockedRequest(request.tabId, request.url, request.hostname || "", request.type || "other");
      });

      blocker.on("request-redirected", (request) => {
        debugPrint("CONTENT_BLOCKER", "Request redirected:", request.url);
        this.recordBlockedRequest(request.tabId, request.url, request.hostname || "", request.type || "other");
      });

      return blocker;
    });

    this.blockerInstanceType = type;
    return this.blockerInstancePromise as Promise<ElectronBlocker>;
  }

  /**
   * Disables content blocking on all sessions
   */
  private async disableBlocker(): Promise<void> {
    if (!this.blockerInstancePromise) return;

    const blocker = await this.blockerInstancePromise;
    for (const session of this.blockedSessions.values()) {
      const wrappedSession = unifiedWebRequests.createSession(session, SESSION_KEY);
      if (blocker.isBlockingEnabled(wrappedSession)) {
        blocker.disableBlockingInSession(wrappedSession);
      }
    }

    this.blockedSessions.clear();
    this.blockerInstancePromise = undefined;
    this.blockerInstanceType = undefined;
  }

  /**
   * Enables content blocking for a specific profile session
   */
  private async enableBlockerForProfile(
    blockerType: BlockerInstanceType,
    profileId: string,
    session: Session
  ): Promise<void> {
    const blocker = await this.createBlockerInstance(blockerType);
    if (!blocker) return;

    if (this.blockedSessions.get(profileId) === session) return;

    const wrappedSession = unifiedWebRequests.createSession(session, SESSION_KEY);
    if (!blocker.isBlockingEnabled(wrappedSession)) {
      // Ghostery's BlockingContext registers global ipcMain handlers per session;
      // clear prior handlers first so multi-profile sessions do not throw duplicate-handler errors.
      clearCosmeticIpcHandlers();
      blocker.enableBlockingInSession(wrappedSession);
    }

    this.blockedSessions.set(profileId, session);
  }

  private removeProfileSession(profileId: string): void {
    const session = this.blockedSessions.get(profileId);
    if (!session) return;

    this.blockedSessions.delete(profileId);
    if (this.blockerInstancePromise) {
      void this.blockerInstancePromise.then((blocker) => {
        const wrappedSession = unifiedWebRequests.createSession(session, SESSION_KEY);
        if (blocker.isBlockingEnabled(wrappedSession)) {
          blocker.disableBlockingInSession(wrappedSession);
        }
        if (this.blockedSessions.size > 0) {
          registerCosmeticIpcHandlers(blocker);
        }
      });
    }
  }

  private isUrlFocusBlocked(rawUrl: string): boolean {
    if (!this.focusBlockActive || !rawUrl) return false;
    try {
      const host = new URL(rawUrl).hostname.toLowerCase();
      return this.focusBlockedDomains.some((d) => host === d || host.endsWith("." + d));
    } catch {
      return false;
    }
  }

  private attachFocusHook(session: Session): void {
    if (this.focusHookedSessions.has(session)) return;
    this.focusHookedSessions.add(session);
    const wrapped = unifiedWebRequests.createSession(session, FOCUS_SESSION_KEY);
    wrapped.webRequest.onBeforeRequest((details, callback) => {
      if (this.focusBlockActive && details.resourceType === "mainFrame" && this.isUrlFocusBlocked(details.url)) {
        callback({ cancel: true });
        return;
      }
      callback({});
    });
  }

  public setFocusBlocklist(active: boolean, domains?: string[]): { active: boolean; domains: string[] } {
    this.focusBlockActive = active;
    if (Array.isArray(domains) && domains.length > 0) {
      this.focusBlockedDomains = domains.map((d) => d.toLowerCase().trim()).filter(Boolean);
    }
    if (active) {
      for (const profile of loadedProfilesController.getAll()) {
        this.attachFocusHook(profile.session);
      }
    }
    return this.getFocusBlocklist();
  }

  public getFocusBlocklist(): { active: boolean; domains: string[] } {
    return {
      active: this.focusBlockActive,
      domains: [...this.focusBlockedDomains]
    };
  }

  /**
   * Updates content blocker configuration based on user settings
   */
  public updateConfig(): Promise<void> {
    this.configQueue = this.configQueue.catch(() => {}).then(() => this.applyConfig());
    return this.configQueue;
  }

  private async applyConfig(): Promise<void> {
    const contentBlockerSetting = getSettingValueById("contentBlocker") as string | undefined;
    const profiles = loadedProfilesController.getAll();

    for (const profile of profiles) {
      this.attachFocusHook(profile.session);
    }

    switch (contentBlockerSetting) {
      case "all":
      case "adsAndTrackers":
      case "adsOnly":
        for (const profile of profiles) {
          await this.enableBlockerForProfile(
            contentBlockerSetting as BlockerInstanceType,
            profile.profileId,
            profile.session
          );
        }
        break;
      default:
        await this.disableBlocker();
    }

    debugPrint("CONTENT_BLOCKER", "Content blocker configuration updated:", contentBlockerSetting);
  }

  /**
   * Initializes content blocker, loads data, and sets up event listeners
   */
  public async initialize(): Promise<void> {
    await this.loadData();
    await this.updateConfig();

    settingsEmitter.on("settings-changed", () => {
      this.updateConfig();
    });

    loadedProfilesController.on("profile-loaded", () => {
      this.updateConfig();
    });

    loadedProfilesController.on("profile-unloaded", (profileId) => {
      this.removeProfileSession(profileId);
    });

    profilesController.on("profile-deleted", (profileId) => {
      this.removeProfileSession(profileId);
    });

    const setupTabListeners = (tab: Tab) => {
      tab.on("updated", (keys) => {
        if (keys.includes("url")) {
          this.handleTabNavigation(tab);
        }
      });
      tab.on("destroyed", () => {
        this.tabStatsMap.delete(tab.id);
      });
    };

    tabsController.on("tab-created", (tab) => {
      setupTabListeners(tab);
    });

    for (const tab of tabsController.tabs.values()) {
      setupTabListeners(tab);
    }
  }
}

export const contentBlocker = new ContentBlocker();

onSettingsCached().then(() => {
  debugPrint("CONTENT_BLOCKER", "Initializing content blocker");
  contentBlocker.initialize();
});
