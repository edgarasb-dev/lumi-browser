import { Button } from "@/components/ui/button";
import { GlobeIcon, HeartIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { SettingsRow } from "@/components/settings/components/setting-row";

export function SetAsDefaultBrowserSetting({ highlighted = false }: { highlighted?: boolean }) {
  const [isDefault, setIsDefault] = useState<boolean | null>(null);

  useEffect(() => {
    const refetchDefaultBrowser = async () => {
      const isDefaultResult = await lumi.app.getDefaultBrowser();
      setIsDefault(isDefaultResult);
    };

    refetchDefaultBrowser();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refetchDefaultBrowser();
      }
    };
    window.addEventListener("focus", refetchDefaultBrowser);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", refetchDefaultBrowser);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const setDefaultBrowser = () => {
    lumi.app.setDefaultBrowser();
  };

  return (
    <SettingsRow
      id="internal_setAsDefaultBrowser"
      highlighted={highlighted}
      icon={<GlobeIcon className="size-4" />}
      label="Default Web Browser"
      description="Open links clicked in other apps directly inside Lumi."
    >
      {isDefault === null && <Loader2Icon className="animate-spin size-4 text-muted-foreground" />}
      {isDefault === false && (
        <Button id="default-browser-button" variant="outline" size="sm" onClick={setDefaultBrowser}>
          Set as Default
        </Button>
      )}
      {isDefault === true && (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          <HeartIcon className="size-3.5" />
          Default Browser
        </span>
      )}
    </SettingsRow>
  );
}
