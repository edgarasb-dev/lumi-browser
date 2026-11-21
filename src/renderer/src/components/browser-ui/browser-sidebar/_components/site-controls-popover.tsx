import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useBrowserSidebar } from "@/components/browser-ui/browser-sidebar/provider";
import { useAddressUrl, useFocusedTab } from "@/components/providers/tabs-provider";
import { useSpaces } from "@/components/providers/spaces-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  RefreshCw,
  Globe,
  Lock,
  LockOpen,
  Minus,
  Plus,
  Moon,
  Trash2,
  Camera,
  MapPin,
  Bell,
  Clipboard,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import type { SitePermissionDecision, SitePermissionKey, TabSiteControlsState } from "~/types/site-controls";
import { toast } from "sonner";

const PERMISSION_CONTROLS: { key: SitePermissionKey; label: string; icon: React.ReactNode }[] = [
  { key: "media", label: "Camera & Microphone", icon: <Camera className="size-3.5" /> },
  { key: "geolocation", label: "Location", icon: <MapPin className="size-3.5" /> },
  { key: "notifications", label: "Notifications", icon: <Bell className="size-3.5" /> },
  { key: "clipboard-read", label: "Clipboard Read", icon: <Clipboard className="size-3.5" /> }
];

export const SiteControlsButton = memo(function SiteControlsButton() {
  const addressUrl = useAddressUrl();
  const focusedTab = useFocusedTab();
  const { hasSidebar } = useBrowserSidebar();
  const { isCurrentSpaceLight } = useSpaces();

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TabSiteControlsState | null>(null);
  const [showBlockedList, setShowBlockedList] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  const spaceInjectedClasses = cn(isCurrentSpaceLight ? "" : "dark");
  const tabId = focusedTab?.id;

  const isWebUrl = useMemo(() => {
    if (!addressUrl) return false;
    return addressUrl.startsWith("http://") || addressUrl.startsWith("https://");
  }, [addressUrl]);

  const refreshState = useCallback(async () => {
    if (!tabId || !isWebUrl) {
      setState(null);
      return;
    }
    const next = await lumi.siteControls.getForTab(tabId).catch(() => null);
    setState(next);
  }, [tabId, isWebUrl]);

  useEffect(() => {
    setNeedsReload(false);
    setShowBlockedList(false);
    void refreshState();

    if (!tabId || !isWebUrl) return;
    const unsubStats = lumi.contentBlocker.onStatsUpdated((update) => {
      if (update.tabId !== tabId) return;
      setState((prev) => {
        if (!prev || !prev.blockerStats) return prev;
        return {
          ...prev,
          blockerStats: {
            ...prev.blockerStats,
            blockedCount: update.blockedCount ?? prev.blockerStats.blockedCount,
            totalBlocked: update.totalBlocked ?? prev.blockerStats.totalBlocked
          }
        };
      });
    });

    const unsubWhitelist = lumi.contentBlocker.onWhitelistChanged(() => {
      void refreshState();
    });

    return () => {
      unsubStats();
      unsubWhitelist();
    };
  }, [tabId, isWebUrl, refreshState]);

  useEffect(() => {
    if (open) {
      void refreshState();
    }
  }, [open, refreshState]);

  if (!tabId || !isWebUrl || !state?.hostname) return null;

  const isWhitelisted = state.blockerStats?.isWhitelisted ?? false;
  const blockedCount = state.blockerStats?.blockedCount ?? 0;
  const blockedRequests = state.blockerStats?.blockedRequests ?? [];
  const zoomFactor = state.settings.zoomFactor ?? 1;
  const smartDark = state.settings.smartDarkMode ?? false;
  const isHttps = state.protocol === "https:";
  const cleanDomain = state.hostname.replace(/^www\./, "");

  const handleToggleShield = async (checked: boolean) => {
    const targetWhitelisted = !checked;
    await lumi.contentBlocker.toggleDomainWhitelist(cleanDomain, targetWhitelisted);
    setNeedsReload(true);
    await refreshState();
  };

  const handleAdjustZoom = async (nextZoom: number) => {
    const applied = await lumi.siteControls.setZoom(tabId, nextZoom);
    setState((prev) => (prev ? { ...prev, settings: { ...prev.settings, zoomFactor: applied } } : prev));
  };

  const handleToggleDark = async (enabled: boolean) => {
    await lumi.siteControls.setSmartDarkMode(tabId, enabled);
    setState((prev) => (prev ? { ...prev, settings: { ...prev.settings, smartDarkMode: enabled } } : prev));
  };

  const handlePermissionChange = async (permission: SitePermissionKey, decision: SitePermissionDecision) => {
    const updated = await lumi.siteControls.setPermission(tabId, permission, decision);
    if (updated) {
      setState((prev) => (prev ? { ...prev, settings: updated } : prev));
    }
  };

  const handleClearSiteData = async () => {
    const ok = await lumi.siteControls.clearSiteData(tabId);
    if (ok) {
      toast.success(`Cleared storage and cookies for ${cleanDomain}`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          hasSidebar ? "size-6 justify-center" : "h-6 px-1.5 gap-1",
          "flex items-center rounded-md text-[11px] font-medium transition-colors relative shrink-0 select-none cursor-pointer",
          isWhitelisted
            ? "text-amber-600 dark:text-amber-400 bg-amber-500/12 hover:bg-amber-500/20"
            : blockedCount > 0
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/12 hover:bg-emerald-500/20"
              : "text-black/65 dark:text-white/65 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/12"
        )}
        onClick={(e) => e.stopPropagation()}
        title={
          blockedCount > 0 && !isWhitelisted
            ? `Site Controls & Shield (${blockedCount} trackers/ads blocked)`
            : "Site Controls, Shield & Permissions"
        }
      >
        {isWhitelisted ? (
          <ShieldAlert className="size-3.5" />
        ) : blockedCount > 0 ? (
          <ShieldCheck className="size-3.5" />
        ) : (
          <Shield className="size-3.5" />
        )}
        {!hasSidebar && blockedCount > 0 && !isWhitelisted && (
          <span className="tabular-nums font-semibold leading-none">{blockedCount > 99 ? "99+" : blockedCount}</span>
        )}
      </PopoverTrigger>

      <PopoverContent
        variant="translucent"
        className="w-84 p-3.5 select-none font-sans space-y-3"
        positionerClassName={spaceInjectedClasses}
      >
        {/* Header: Host + HTTPS */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-black/[0.08] dark:border-white/[0.1]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-7 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
              {focusedTab?.faviconURL ? (
                <img src={focusedTab.faviconURL} alt="" className="size-4 rounded-xs object-contain" />
              ) : (
                <Globe className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{cleanDomain}</div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {isHttps ? (
                  <>
                    <Lock className="size-2.5 text-emerald-500" />
                    <span>Secure Connection (HTTPS)</span>
                  </>
                ) : (
                  <>
                    <LockOpen className="size-2.5 text-amber-500" />
                    <span>Not Encrypted (HTTP)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <Switch checked={!isWhitelisted} onCheckedChange={handleToggleShield} title="Toggle Lumi Shield" />
        </div>

        {/* Shield telemetry */}
        <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] p-2.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">
              {isWhitelisted ? "Shield paused on this site" : "Lumi Shield active"}
            </span>
            <span className="text-muted-foreground tabular-nums">{blockedCount} blocked</span>
          </div>

          {blockedRequests.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBlockedList((prev) => !prev)}
              className="w-full flex items-center justify-between text-[11px] text-primary hover:underline cursor-pointer"
            >
              <span>{showBlockedList ? "Hide blocked requests" : "Inspect blocked requests"}</span>
              {showBlockedList ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          )}

          {showBlockedList && blockedRequests.length > 0 && (
            <div className="max-h-28 overflow-y-auto space-y-1 pt-1 custom-scrollbar">
              {blockedRequests.slice(0, 12).map((req, idx) => (
                <div key={`${req.url}-${idx}`} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="truncate text-muted-foreground font-mono">{req.url}</span>
                  <span className="px-1 py-0.2 rounded bg-black/[0.06] dark:bg-white/[0.08] text-foreground/80 uppercase shrink-0">
                    {req.type}
                  </span>
                </div>
              ))}
            </div>
          )}

          {needsReload && (
            <Button
              size="sm"
              variant="default"
              className="w-full h-7 text-xs gap-1.5"
              onClick={() => {
                lumi.navigation.reloadTab(tabId);
                setNeedsReload(false);
              }}
            >
              <RefreshCw className="size-3" /> Reload to Apply Shield Changes
            </Button>
          )}
        </div>

        {/* Zoom + Night Shade */}
        <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.06] dark:divide-white/[0.07]">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-foreground">Page Zoom</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-6 rounded-md"
                onClick={() => void handleAdjustZoom(zoomFactor - 0.1)}
                title="Zoom Out"
              >
                <Minus className="size-3" />
              </Button>
              <button
                type="button"
                onClick={() => void handleAdjustZoom(1)}
                className="min-w-11 text-center text-xs font-semibold tabular-nums hover:text-primary cursor-pointer"
                title="Click to reset zoom to 100%"
              >
                {Math.round(zoomFactor * 100)}%
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 rounded-md"
                onClick={() => void handleAdjustZoom(zoomFactor + 0.1)}
                title="Zoom In"
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Moon className="size-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground">Night Shade (Smart Dark)</span>
            </div>
            <Switch checked={smartDark} onCheckedChange={(checked) => void handleToggleDark(checked)} />
          </div>
        </div>

        {/* Permissions */}
        <div className="rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.06] dark:divide-white/[0.07]">
          {PERMISSION_CONTROLS.map((perm) => {
            const currentDecision = state.settings.permissions[perm.key] ?? "ask";
            return (
              <div key={perm.key} className="flex items-center justify-between px-3 py-1.5">
                <div className="flex items-center gap-2 text-xs text-foreground">
                  <span className="text-muted-foreground">{perm.icon}</span>
                  <span>{perm.label}</span>
                </div>
                <Select
                  value={currentDecision}
                  onValueChange={(val) => void handlePermissionChange(perm.key, val as SitePermissionDecision)}
                >
                  <SelectTrigger className="h-6 w-20 text-[11px] px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ask" className="text-xs">
                      Ask
                    </SelectItem>
                    <SelectItem value="allow" className="text-xs">
                      Allow
                    </SelectItem>
                    <SelectItem value="block" className="text-xs">
                      Block
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        {/* Storage action */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/25"
          onClick={() => void handleClearSiteData()}
        >
          <Trash2 className="size-3.5" />
          Clear Cookies &amp; Site Data
        </Button>
      </PopoverContent>
    </Popover>
  );
});
