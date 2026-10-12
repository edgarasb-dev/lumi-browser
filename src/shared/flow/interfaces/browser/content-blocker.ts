export interface BlockedRequestItem {
  url: string;
  domain: string;
  type: string;
  timestamp: number;
}

export interface TabBlockerStats {
  tabId: number;
  blockedCount: number;
  blockedRequests: BlockedRequestItem[];
  isWhitelisted: boolean;
  hostname: string;
  totalBlocked: number;
}

export interface FlowContentBlockerAPI {
  getTabStats(tabId: number): Promise<TabBlockerStats>;
  getTotalBlocked(): Promise<number>;
  getWhitelistedDomains(): Promise<string[]>;
  isDomainWhitelisted(domain: string): Promise<boolean>;
  toggleDomainWhitelist(domain: string, whitelisted?: boolean): Promise<boolean>;
  onStatsUpdated(
    callback: (data: { tabId?: number; blockedCount?: number; totalBlocked?: number }) => void
  ): () => void;
  onWhitelistChanged(callback: (domains: string[]) => void): () => void;
}
