import { useCallback, useEffect, useState } from "react";
import { useSetting } from "@/components/providers/settings-provider";
import { useSettingsNavigation } from "@/components/settings/settings-layout";
import { SettingsGroup, SettingsRow, SettingsSectionHeader } from "@/components/settings/components/setting-row";
import { ExternalAppsSettings } from "@/components/settings/sections/external-apps/section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldOff, Shield, ShieldAlert, Globe, RotateCcw } from "lucide-react";
import type { ProfileSitePermissionEntry } from "~/types/site-controls";
import { toast } from "sonner";

const BLOCKER_MODES = [
  {
    id: "disabled",
    name: "Off",
    subtitle: "No built-in filtering",
    icon: <ShieldOff className="size-4" />
  },
  {
    id: "adsOnly",
    name: "Ads Only",
    subtitle: "Blocks banner & video ads",
    icon: <Shield className="size-4" />
  },
  {
    id: "adsAndTrackers",
    name: "Standard",
    subtitle: "Blocks ads & analytics trackers",
    icon: <ShieldCheck className="size-4" />
  },
  {
    id: "all",
    name: "Strict Shield",
    subtitle: "Adds cookie notice & annoyance blocking",
    icon: <ShieldAlert className="size-4" />
  }
] as const;

export function PrivacySettings() {
  const { highlightedRowId } = useSettingsNavigation();
  const [contentBlocker = "disabled", setContentBlocker] = useSetting<string>("contentBlocker");
  const [siteEntries, setSiteEntries] = useState<ProfileSitePermissionEntry[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("main");

  const loadSiteEntries = useCallback(async () => {
    try {
      const profiles = await lumi.profiles.getProfiles();
      const firstUserProfile = profiles.find((p) => !p.internal);
      const pid = firstUserProfile?.id ?? "main";
      setActiveProfileId(pid);
      const list = await lumi.siteControls.listProfileSiteSettings(pid);
      setSiteEntries(list);
    } catch {
      setSiteEntries([]);
    }
  }, []);

  useEffect(() => {
    void loadSiteEntries();
  }, [loadSiteEntries]);

  const handleResetOrigin = async (origin: string) => {
    const ok = await lumi.siteControls.resetOriginSettings(activeProfileId, origin);
    if (ok) {
      toast.success(`Reset site customizations for ${origin}`);
      await loadSiteEntries();
    }
  };

  return (
    <div className="space-y-6 remove-app-drag">
      <SettingsSectionHeader
        title="Privacy & External Apps"
        description="Manage Lumi's built-in content blocker shield and allowed external application protocols."
        icon={<ShieldCheck className="size-4" />}
      />

      <SettingsGroup title="Content Blocking Shield">
        <div
          data-setting-id="contentBlocker"
          className={cn("p-4 space-y-3", highlightedRowId === "contentBlocker" && "lumi-highlight-pulse")}
        >
          <div>
            <div className="text-sm font-medium text-foreground">Default Shield Protection</div>
            <p className="text-xs text-muted-foreground">
              Per-site exceptions can also be toggled from the shield icon in the address bar.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {BLOCKER_MODES.map((mode) => {
              const selected = contentBlocker === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => void setContentBlocker(mode.id)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all cursor-pointer",
                    selected
                      ? "border-primary bg-primary/10 dark:bg-primary/15 ring-1 ring-primary/30 shadow-xs"
                      : "border-black/[0.07] dark:border-white/[0.08] bg-black/[0.025] dark:bg-white/[0.03] hover:bg-black/[0.045] dark:hover:bg-white/[0.06]"
                  )}
                >
                  <span className={cn("text-muted-foreground", selected && "text-primary")}>{mode.icon}</span>
                  <div>
                    <div className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>
                      {mode.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{mode.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SettingsGroup>

      <div
        data-setting-id="externalAppProtocols"
        className={cn(highlightedRowId === "externalAppProtocols" && "rounded-2xl lumi-highlight-pulse")}
      >
        <ExternalAppsSettings embedded />
      </div>

      <SettingsGroup
        title="Website Overrides (Zoom, Dark Mode & Permissions)"
        description="Per-origin customizations configured from the Address Bar Site Control Center."
      >
        {siteEntries.length === 0 ? (
          <SettingsRow
            label="No per-site overrides saved yet"
            description="Adjust zoom, Night Shade, camera/mic, notifications, or location from any site's address bar shield."
          />
        ) : (
          siteEntries.map((entry) => {
            const permSummary = Object.entries(entry.settings.permissions)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" • ");
            const parts = [
              entry.settings.zoomFactor !== 1 ? `Zoom ${Math.round(entry.settings.zoomFactor * 100)}%` : null,
              entry.settings.smartDarkMode ? "Night Shade On" : null,
              permSummary || null
            ].filter(Boolean);
            return (
              <SettingsRow
                key={entry.origin}
                icon={<Globe className="size-4" />}
                label={entry.origin.replace(/^https?:\/\//, "")}
                description={parts.join(" • ") || "Customized site rules"}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => void handleResetOrigin(entry.origin)}
                >
                  <RotateCcw className="size-3" />
                  Reset
                </Button>
              </SettingsRow>
            );
          })
        )}
      </SettingsGroup>
    </div>
  );
}
