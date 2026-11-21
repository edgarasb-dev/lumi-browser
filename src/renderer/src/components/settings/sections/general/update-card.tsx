import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpCircle,
  CheckCircle2,
  ExternalLink,
  InfoIcon,
  RefreshCw,
  XCircle
} from "lucide-react";
import { useAppUpdates } from "@/components/providers/app-updates-provider";
import { SettingsRow } from "@/components/settings/components/setting-row";

export function UpdateCard({ highlighted = false }: { highlighted?: boolean }) {
  const {
    updateStatus,
    isCheckingForUpdates,
    isDownloadingUpdate,
    isInstallingUpdate,
    isAutoUpdateSupported,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    openDownloadPage
  } = useAppUpdates();

  const [currentVersion, setCurrentVersion] = useState("-");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    lumi.app
      .getAppInfo()
      .then((info) => setCurrentVersion(info.app_version))
      .catch(() => setCurrentVersion("N/A"));
  }, []);

  useEffect(() => {
    if (!updateStatus && isAutoUpdateSupported) {
      checkForUpdates();
    }
  }, [checkForUpdates, updateStatus, isAutoUpdateSupported]);

  const handleInstallUpdate = async () => {
    const success = await installUpdate();
    setDialogOpen(false);
    if (!success) {
      openDownloadPage();
    }
  };

  const isDownloaded = updateStatus?.updateDownloaded === true;
  const updateProgress = updateStatus?.downloadProgress?.percent || 0;
  const hasChecked =
    updateStatus !== null && Boolean(updateStatus.lastChecked || updateStatus.availableUpdate || updateStatus.error);
  const hasUpdate = Boolean(updateStatus?.availableUpdate);
  const availableVersion = updateStatus?.availableUpdate?.version || "";
  const downloadFailed = updateStatus?.downloadProgress?.percent === -1;
  const hasError = Boolean(updateStatus?.error);
  const isUpToDate = hasChecked && !hasUpdate && !hasError && !isCheckingForUpdates && !isDownloadingUpdate;

  const getStatusMeta = () => {
    if (isCheckingForUpdates) {
      return {
        icon: <RefreshCw className="size-4 animate-spin text-primary" />,
        label: "Checking for Updates...",
        description: `Installed version: v${currentVersion}`
      };
    }
    if (downloadFailed) {
      return {
        icon: <XCircle className="size-4 text-destructive" />,
        label: `Download failed for v${availableVersion}`,
        description: `Installed version: v${currentVersion}`
      };
    }
    if (isDownloadingUpdate) {
      return {
        icon: <ArrowDownToLine className="size-4 text-primary" />,
        label: `Downloading Lumi v${availableVersion} (${Math.round(updateProgress)}%)`,
        description: `Installed version: v${currentVersion}`
      };
    }
    if (isDownloaded) {
      return {
        icon: <CheckCircle2 className="size-4 text-emerald-500" />,
        label: `Lumi v${availableVersion} Ready to Install`,
        description: `Currently running v${currentVersion}`
      };
    }
    if (hasUpdate) {
      return {
        icon: <InfoIcon className="size-4 text-primary" />,
        label: `Lumi v${availableVersion} Available`,
        description: `Currently running v${currentVersion}`
      };
    }
    if (hasError) {
      return {
        icon: <AlertCircle className="size-4 text-amber-500" />,
        label: `Update Check Failed (v${currentVersion})`,
        description: updateStatus?.error || "Network error"
      };
    }
    if (isUpToDate) {
      return {
        icon: <CheckCircle2 className="size-4 text-emerald-500" />,
        label: `Lumi v${currentVersion} is Up to Date`,
        description: "You have the latest stable release."
      };
    }
    return {
      icon: <InfoIcon className="size-4 text-muted-foreground" />,
      label: `Software Update (v${currentVersion})`,
      description: "Check GitHub Releases for newer builds."
    };
  };

  const renderAction = () => {
    if (isCheckingForUpdates || isDownloadingUpdate || isInstallingUpdate) {
      return (
        <Button variant="outline" size="sm" disabled>
          <RefreshCw className="size-3.5 animate-spin" />
          {isInstallingUpdate ? "Installing..." : isDownloadingUpdate ? "Downloading..." : "Checking..."}
        </Button>
      );
    }

    if (downloadFailed) {
      return (
        <Button variant="default" size="sm" onClick={downloadUpdate}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      );
    }

    if (hasError) {
      return (
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={openDownloadPage}>
            <ExternalLink className="size-3.5" /> Releases
          </Button>
          <Button variant="default" size="sm" onClick={checkForUpdates}>
            <RefreshCw className="size-3.5" /> Retry
          </Button>
        </div>
      );
    }

    if (isDownloaded) {
      return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm">
              <ArrowUpCircle className="size-3.5" /> Restart &amp; Install
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Install Lumi v{availableVersion}?</DialogTitle>
              <DialogDescription>
                Lumi will quit cleanly, replace the app bundle, and relaunch v{availableVersion}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Later
              </Button>
              <Button onClick={handleInstallUpdate} disabled={isInstallingUpdate}>
                {isInstallingUpdate ? "Installing..." : `Install v${availableVersion}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }

    if (hasUpdate && !isAutoUpdateSupported) {
      return (
        <Button variant="default" size="sm" onClick={openDownloadPage}>
          <ExternalLink className="size-3.5" /> Download Manually
        </Button>
      );
    }

    if (hasUpdate && isAutoUpdateSupported) {
      return (
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={openDownloadPage} title="View Release on GitHub">
            <ExternalLink className="size-3.5" />
          </Button>
          <Button variant="default" size="sm" onClick={downloadUpdate}>
            <ArrowDownToLine className="size-3.5" /> Download v{availableVersion}
          </Button>
        </div>
      );
    }

    return (
      <Button variant="outline" size="sm" onClick={checkForUpdates}>
        <RefreshCw className="size-3.5" /> {isUpToDate ? "Check Again" : "Check Now"}
      </Button>
    );
  };

  const statusMeta = getStatusMeta();

  return (
    <div>
      <SettingsRow
        id="internal_updateCheck"
        highlighted={highlighted}
        icon={statusMeta.icon}
        label={statusMeta.label}
        description={statusMeta.description}
      >
        {renderAction()}
      </SettingsRow>

      {isDownloadingUpdate && !downloadFailed && (
        <div className="px-4 pb-3.5 pt-0.5 space-y-1">
          <Progress value={updateProgress} className="w-full h-1.5" />
          <div className="flex justify-end text-[11px] text-muted-foreground">{Math.round(updateProgress)}%</div>
        </div>
      )}

      {hasChecked && hasUpdate && !isAutoUpdateSupported && (
        <div className="mx-4 mb-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-2">
          <span>Move Lumi.app into Applications on macOS to enable one-click auto-updates.</span>
          <button type="button" onClick={openDownloadPage} className="font-medium underline shrink-0 cursor-pointer">
            GitHub Releases
          </button>
        </div>
      )}
    </div>
  );
}
