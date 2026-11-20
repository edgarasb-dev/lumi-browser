import { useEffect, useState } from "react";
import { Loader2, Cpu, ShieldCheck, Terminal, Layers, Globe } from "lucide-react";
import { getReleaseCodename } from "~/version";
import { SettingsGroup } from "@/components/settings/components/setting-row";

const getAppInfo = lumi.app.getAppInfo;

function SpecChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-black/[0.025] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.07]">
      <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-xs font-semibold text-foreground truncate">{value}</div>
      </div>
    </div>
  );
}

export function BrowserInfoCard() {
  const [appInfo, setAppInfo] = useState<Awaited<ReturnType<typeof getAppInfo>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getAppInfo()
      .then((info) => setAppInfo(info))
      .catch((error) => {
        console.error("Failed to fetch app info:", error);
        setAppInfo(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <SettingsGroup
      title="System & Engine Specifications"
      description="Details regarding this Lumi build and Chromium runtime."
    >
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2 text-primary" />
            <span className="text-xs">Loading specifications...</span>
          </div>
        ) : appInfo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <SpecChip icon={<Globe className="size-4" />} label="Browser Name" value="Lumi Browser" />
            <SpecChip
              icon={<Layers className="size-4" />}
              label="Lumi Version"
              value={
                getReleaseCodename(appInfo.app_version)
                  ? `v${appInfo.app_version} (${getReleaseCodename(appInfo.app_version)})`
                  : `v${appInfo.app_version}`
              }
            />
            <SpecChip icon={<Cpu className="size-4" />} label="Engine" value={`Chromium ${appInfo.chrome_version}`} />
            <SpecChip icon={<Terminal className="size-4" />} label="Platform" value={appInfo.os} />
            <SpecChip
              icon={<ShieldCheck className="size-4" />}
              label="Channel"
              value={appInfo.update_channel || "Stable"}
            />
            <SpecChip icon={<Layers className="size-4" />} label="Build Number" value={`#${appInfo.build_number}`} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 text-xs text-destructive">
            Could not load browser information.
          </div>
        )}
      </div>
    </SettingsGroup>
  );
}
