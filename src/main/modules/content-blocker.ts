import { debugPrint } from "@/modules/output";
import { getSettingValueById, onSettingsCached, settingsEmitter } from "@/saving/settings";
import { getDatastore } from "@/saving/datastore";
import { ElectronBlocker } from "@ghostery/adblocker-electron";
import { Session, webContents } from "electron";
import { loadedProfilesController } from "@/controllers/loaded-profiles-controller";
import { unifiedWebRequests } from "@/controllers/sessions-controller";
import { tabsController } from "@/controllers/tabs-controller";
import type { Tab } from "@/controllers/tabs-controller/tab";
import { sendMessageToListeners } from "@/ipc/listeners-manager";
import type { BlockedRequestItem, TabBlockerStats } from "~/flow/interfaces/browser/content-blocker";

type BlockerInstanceType = "all" | "adsAndTrackers" | "adsOnly";

const SESSION_KEY = "content-blocker";
const ContentBlockerDataStore = getDatastore("content-blocker");

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
  private blockedSessions: Session[] = [];

  private whitelistedDomainsSet: Set<string> = new Set();
  private totalBlockedCount: number = 0;
  private tabStatsMap: Map<number, TabStatsData> = new Map();
  private saveTimeout: NodeJS.Timeout | null = null;
  private isDataLoaded: boolean = false;

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
    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      try {
        await ContentBlockerDataStore.set("totalBlocked", this.totalBlockedCount);
      } catch (err) {
        debugPrint("CONTENT_BLOCKER", "Failed to persist total blocked count:", err);
      }
    }, 2000);
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
    switch (type) {
      case "all":
        this.blockerInstancePromise = ElectronBlocker.fromPrebuiltFull();
        break;
      case "adsAndTrackers":
        this.blockerInstancePromise = ElectronBlocker.fromPrebuiltAdsAndTracking();
        break;
      case "adsOnly":
        this.blockerInstancePromise = ElectronBlocker.fromPrebuiltAdsOnly();
        break;
    }

    this.blockerInstancePromise.then((blocker) => {
      // Wrap onBeforeRequest to bypass blocking for whitelisted domains
      const originalOnBeforeRequest = blocker.onBeforeRequest.bind(blocker);
      blocker.onBeforeRequest = (details, callback) => {
        let pageHost = "";
        if (details.webContentsId) {
          try {
            const wc = webContents.fromId(details.webContentsId);
            if (wc && !wc.isDestroyed()) {
              const url = wc.getURL();
              if (url) {
                pageHost = new URL(url).hostname;
              }
            }
          } catch {
            // ignore
          }
        }
        if (!pageHost && details.referrer) {
          try {
            pageHost = new URL(details.referrer).hostname;
          } catch {
            // ignore
          }
        }

        if (pageHost && this.isDomainWhitelisted(pageHost)) {
          // Whitelisted domain: bypass blocking
          callback({});
          return;
        }

        originalOnBeforeRequest(details, callback);
      };

      // Wrap onInjectCosmeticFilters to bypass cosmetic filters for whitelisted domains
      const originalOnInjectCosmeticFilters = blocker.onInjectCosmeticFilters.bind(blocker);
      blocker.onInjectCosmeticFilters = async (event, url, msg) => {
        try {
          const host = new URL(url).hostname;
          if (host && this.isDomainWhitelisted(host)) {
            return;
          }
        } catch {
          // ignore
        }
        return originalOnInjectCosmeticFilters(event, url, msg);
      };

      blocker.on("request-blocked", (request) => {
        debugPrint("CONTENT_BLOCKER", "Request blocked:", request.url);
        this.recordBlockedRequest(request.tabId, request.url, request.hostname || "", request.type || "other");
      });

      blocker.on("request-redirected", (request) => {
        debugPrint("CONTENT_BLOCKER", "Request redirected:", request.url);
        this.recordBlockedRequest(request.tabId, request.url, request.hostname || "", request.type || "other");
      });
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
    for (const session of this.blockedSessions) {
      blocker.disableBlockingInSession(unifiedWebRequests.createSession(session, SESSION_KEY));
    }

    this.blockedSessions = [];
    this.blockerInstancePromise = undefined;
    this.blockerInstanceType = undefined;
  }

  /**
   * Enables content blocking for a specific session
   */
  private async enableBlockerForSession(blockerType: BlockerInstanceType, session: Session): Promise<void> {
    const blocker = await this.createBlockerInstance(blockerType);
    if (!blocker) return;

    if (this.blockedSessions.includes(session)) return;

    this.blockedSessions.push(session);
    blocker.enableBlockingInSession(unifiedWebRequests.createSession(session, SESSION_KEY));
  }

  /**
   * Updates content blocker configuration based on user settings
   */
  public async updateConfig(): Promise<void> {
    const contentBlockerSetting = getSettingValueById("contentBlocker") as string | undefined;
    const profiles = loadedProfilesController.getAll();

    switch (contentBlockerSetting) {
      case "all":
      case "adsAndTrackers":
      case "adsOnly":
        for (const profile of profiles) {
          this.enableBlockerForSession(contentBlockerSetting as BlockerInstanceType, profile.session);
        }
        break;
      default:
        this.disableBlocker();
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
