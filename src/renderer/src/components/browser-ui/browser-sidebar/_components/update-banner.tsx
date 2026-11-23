import { AnimatePresence, motion } from "motion/react";
import { useAppUpdates } from "@/components/providers/app-updates-provider";
import { cn } from "@/lib/utils";
import { Download, RefreshCw, ArrowUpCircle } from "lucide-react";

export function UpdateBanner() {
  const {
    updateStatus,
    isDownloadingUpdate,
    isInstallingUpdate,
    isAutoUpdateSupported,
    downloadUpdate,
    installUpdate,
    openDownloadPage
  } = useAppUpdates();

  const isDownloaded = updateStatus?.updateDownloaded === true;
  const hasUpdate = Boolean(updateStatus?.availableUpdate);
  const hasError = Boolean(updateStatus?.error);

  if (!hasUpdate && !isDownloaded && !isDownloadingUpdate && !isInstallingUpdate) {
    return null;
  }

  const onActionClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (isDownloaded) {
      const success = await installUpdate();
      if (!success) {
        openDownloadPage();
      }
      return;
    }

    if (hasUpdate && !isAutoUpdateSupported) {
      openDownloadPage();
      return;
    }

    if (hasUpdate && !isDownloadingUpdate) {
      const started = await downloadUpdate();
      if (!started) {
        openDownloadPage();
      }
    }
  };

  const progressPct = updateStatus?.downloadProgress?.percent;
  const statusLabel = isInstallingUpdate
    ? "Restarting..."
    : isDownloadingUpdate
      ? typeof progressPct === "number" && progressPct > 0
        ? `Downloading ${Math.round(progressPct)}%`
        : "Downloading..."
      : isDownloaded
        ? "Update ready"
        : hasError
          ? "Update paused"
          : `Update ${updateStatus?.availableUpdate?.version ? `v${updateStatus.availableUpdate.version}` : "ready"}`;

  const ctaLabel = isInstallingUpdate
    ? "..."
    : isDownloadingUpdate
      ? "Wait"
      : isDownloaded
        ? "Restart"
        : !isAutoUpdateSupported
          ? "Manual"
          : hasError
            ? "Retry"
            : "Download";

  return (
    <AnimatePresence>
      <motion.div
        key="update-banner"
        initial={{ opacity: 0, height: 0, marginTop: 0 }}
        animate={{ opacity: 1, height: "auto", marginTop: 6 }}
        exit={{ opacity: 0, height: 0, marginTop: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0 overflow-hidden mb-1.5"
      >
        <div
          className={cn(
            "w-full rounded-xl px-2.5 py-1.5",
            "border border-black/[0.08] dark:border-white/[0.12]",
            "bg-black/[0.06] dark:bg-white/[0.09]",
            "flex items-center justify-between gap-2 min-w-0"
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {isInstallingUpdate || isDownloadingUpdate ? (
              <RefreshCw className="size-3.5 shrink-0 animate-spin text-black/70 dark:text-white/80" />
            ) : isDownloaded ? (
              <ArrowUpCircle className="size-3.5 shrink-0 text-black/70 dark:text-white/85" />
            ) : (
              <Download className="size-3.5 shrink-0 text-black/70 dark:text-white/85" />
            )}
            <span className="truncate text-[12px] font-medium text-black/85 dark:text-white/90">{statusLabel}</span>
          </div>

          <button
            type="button"
            onClick={onActionClick}
            disabled={isInstallingUpdate || isDownloadingUpdate}
            title={updateStatus?.error || statusLabel}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-4",
              "bg-black text-white dark:bg-white dark:text-neutral-900",
              "shadow-xs hover:opacity-90 active:scale-[0.97] transition",
              "disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            )}
          >
            {ctaLabel}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
