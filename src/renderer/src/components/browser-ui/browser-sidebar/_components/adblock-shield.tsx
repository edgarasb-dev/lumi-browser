import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useAddressUrl, useFocusedTab } from "@/components/providers/tabs-provider";
import { useSpaces } from "@/components/providers/spaces-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, Shield, RefreshCw, ChevronDown, ChevronUp, Globe, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { TabBlockerStats } from "~/lumi/interfaces/browser/content-blocker";

function getTypeBadgeColor(type: string) {
  switch (type.toLowerCase()) {
    case "script":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "image":
    case "imageset":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "xhr":
    case "fetch":
    case "xmlhttprequest":
      return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
    case "subframe":
    case "sub_frame":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20";
    default:
      return "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
  }
}

export const AdblockShield = memo(function AdblockShield() {
  const addressUrl = useAddressUrl();
  const focusedTab = useFocusedTab();
  const { isCurrentSpaceLight } = useSpaces();

  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<TabBlockerStats | null>(null);
  const [showList, setShowList] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  const spaceInjectedClasses = cn(isCurrentSpaceLight ? "" : "dark");

  const hostname = useMemo(() => {
    if (!addressUrl) return "";
    if (
      addressUrl.startsWith("lumi:") ||
      addressUrl.startsWith("lumi-internal:") ||
      addressUrl.startsWith("about:") ||
      addressUrl.startsWith("chrome:")
    ) {
      return "";
    }
    try {
      return new URL(addressUrl).hostname;
    } catch {
      return "";
    }
  }, [addressUrl]);

  const cleanDomain = useMemo(() => {
    if (!hostname) return "";
    return hostname.replace(/^www\./, "");
  }, [hostname]);

  const tabId = focusedTab?.id;

  // Fetch initial stats and setup listeners
  useEffect(() => {
    if (!tabId || !hostname) {
      setStats(null);
      setNeedsReload(false);
      return;
    }

    setNeedsReload(false);

    lumi.contentBlocker.getTabStats(tabId).then((data) => {
      setStats(data);
    });

    const unsubStats = lumi.contentBlocker.onStatsUpdated((update) => {
      if (update.tabId === tabId) {
        setStats((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            blockedCount: update.blockedCount ?? prev.blockedCount,
            totalBlocked: update.totalBlocked ?? prev.totalBlocked
          };
        });
      }
    });

    const unsubWhitelist = lumi.contentBlocker.onWhitelistChanged((domains) => {
      const cleanHost = hostname.toLowerCase().trim();
      const isWhitelisted = domains.some((d) => {
        const cd = d.toLowerCase().trim();
        return cleanHost === cd || cleanHost.endsWith("." + cd);
      });
      setStats((prev) => (prev ? { ...prev, isWhitelisted } : null));
    });

    return () => {
      unsubStats();
      unsubWhitelist();
    };
  }, [tabId, hostname]);

  // When popover opens, refresh full stats (to get latest blockedRequests list)
  useEffect(() => {
    if (open && tabId) {
      lumi.contentBlocker.getTabStats(tabId).then((data) => {
        setStats(data);
      });
    }
  }, [open, tabId]);

  const handleToggleShields = useCallback(
    async (checked: boolean) => {
      if (!hostname) return;
      // checked === true -> shields UP (blocking enabled, not whitelisted)
      // checked === false -> shields DOWN (whitelisted)
      const targetWhitelisted = !checked;
      await lumi.contentBlocker.toggleDomainWhitelist(cleanDomain, targetWhitelisted);
      setStats((prev) => (prev ? { ...prev, isWhitelisted: targetWhitelisted } : null));
      setNeedsReload(true);
    },
    [hostname, cleanDomain]
  );

  const handleReload = useCallback(() => {
    if (tabId) {
      lumi.navigation.reloadTab(tabId);
      setNeedsReload(false);
    }
  }, [tabId]);

  if (!hostname || !tabId) return null;

  const isWhitelisted = stats?.isWhitelisted ?? false;
  const blockedCount = stats?.blockedCount ?? 0;
  const totalBlocked = stats?.totalBlocked ?? 0;
  const blockedRequests = stats?.blockedRequests ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "h-6 px-1.5 flex items-center gap-1 rounded-md text-xs font-medium",
          "transition-all duration-150 relative shrink-0 select-none",
          isWhitelisted
            ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
            : blockedCount > 0
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10"
        )}
        onClick={(event) => {
          event.stopPropagation();
        }}
        title={
          isWhitelisted
            ? `Shields DOWN for ${cleanDomain}`
            : blockedCount > 0
              ? `${blockedCount} trackers and ads blocked`
              : "Lumi Privacy Shield active"
        }
      >
        {isWhitelisted ? (
          <ShieldAlert className="size-3.5" />
        ) : blockedCount > 0 ? (
          <ShieldCheck className="size-3.5" />
        ) : (
          <Shield className="size-3.5" />
        )}

        {isWhitelisted ? (
          <span className="text-[10px] font-semibold tracking-tight">PAUSED</span>
        ) : blockedCount > 0 ? (
          <span className="text-[10px] font-semibold tabular-nums">{blockedCount}</span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        variant="translucent"
        className={cn(
          "w-80 select-none p-3.5 flex flex-col gap-3 font-sans",
          "rounded-2xl shadow-2xl backdrop-blur-xl"
        )}
        positionerClassName={spaceInjectedClasses}
      >
        {/* Status Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "size-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                isWhitelisted
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-500 dark:text-amber-400"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-500 dark:text-emerald-400"
              )}
            >
              {isWhitelisted ? <ShieldAlert className="size-5" /> : <ShieldCheck className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-black dark:text-white truncate">{cleanDomain}</span>
                <Lock className="size-3 text-black/40 dark:text-white/40 shrink-0" />
              </div>
              <p className="text-[11px] font-medium text-black/60 dark:text-white/60">
                {isWhitelisted ? "Shields are DOWN" : "Shields are UP"}
              </p>
            </div>
          </div>

          <div className="flex items-center pt-1 shrink-0">
            <Switch
              checked={!isWhitelisted}
              onCheckedChange={handleToggleShields}
              aria-label="Toggle Shields"
              className={cn(!isWhitelisted && "data-[state=checked]:bg-emerald-600")}
            />
          </div>
        </div>

        {/* Reload Notice */}
        <AnimatePresence>
          {needsReload && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -4 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
                <span className="font-medium text-[11px]">Reload page to apply changes</span>
                <Button
                  size="sm"
                  onClick={handleReload}
                  className="h-6 px-2 text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1"
                >
                  <RefreshCw className="size-3" />
                  Reload
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-black/50 dark:text-white/50">
              On this page
            </span>
            <span className="text-lg font-bold text-black/90 dark:text-white/90 tabular-nums">{blockedCount}</span>
            <span className="text-[10px] text-black/40 dark:text-white/40">Trackers & Ads</span>
          </div>

          <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-black/50 dark:text-white/50">
              Total blocked
            </span>
            <span className="text-lg font-bold text-black/90 dark:text-white/90 tabular-nums">
              {totalBlocked.toLocaleString()}
            </span>
            <span className="text-[10px] text-black/40 dark:text-white/40">All-time across Lumi</span>
          </div>
        </div>

        {/* Collapsible Blocked Items List */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-black/5 dark:border-white/10">
          <button
            type="button"
            onClick={() => setShowList((prev) => !prev)}
            className="flex items-center justify-between py-1 text-xs font-medium text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Globe className="size-3 text-black/40 dark:text-white/40" />
              <span>Blocked trackers ({blockedRequests.length})</span>
            </span>
            {showList ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>

          <AnimatePresence>
            {showList && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="max-h-36 overflow-y-auto flex flex-col gap-1 pr-0.5 pt-1">
                  {blockedRequests.length === 0 ? (
                    <div className="text-center py-3 text-[11px] text-black/40 dark:text-white/40">
                      {isWhitelisted ? "Shields are paused for this site." : "No trackers or ads detected."}
                    </div>
                  ) : (
                    blockedRequests.map((item, idx) => (
                      <div
                        key={`${item.url}-${idx}`}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-[11px]"
                      >
                        <span
                          className="font-mono text-[10px] text-black/80 dark:text-white/80 truncate flex-1"
                          title={item.url}
                        >
                          {item.domain}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-semibold border shrink-0",
                            getTypeBadgeColor(item.type)
                          )}
                        >
                          {item.type}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  );
});
