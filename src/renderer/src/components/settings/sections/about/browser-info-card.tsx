import { useEffect, useState } from "react";
import { Loader2, Cpu, ShieldCheck, Terminal, Layers, Globe } from "lucide-react";

const getAppInfo = flow.app.getAppInfo;

interface SpecChipProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function SpecChip({ icon, label, value }: SpecChipProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors">
      <div className="size-8 rounded-lg bg-background flex items-center justify-center text-primary shrink-0 border border-border/40">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
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
      .then((info) => {
        setAppInfo(info);
      })
      .catch((error) => {
        console.error("Failed to fetch app info:", error);
        setAppInfo(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md text-card-foreground p-6 shadow-xs">
      <div className="mb-4">
        <h3 className="text-base font-semibold tracking-tight">System & Engine Specifications</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Details regarding this Lumi build and runtime environment.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-28 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-xs">Loading specifications...</span>
        </div>
      ) : appInfo ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          <SpecChip icon={<Globe className="size-4" />} label="Browser Name" value="Lumi Browser" />
          <SpecChip icon={<Layers className="size-4" />} label="Lumi Version" value={`v${appInfo.app_version}`} />
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
        <div className="flex items-center justify-center h-24 text-xs text-destructive">
          Could not load browser information.
        </div>
      )}
    </div>
  );
}
