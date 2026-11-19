import { useCallback, useState } from "react";
import { CheckCircle2, DownloadIcon, ExternalLink, FolderOpen, Pause, Play, RotateCcw, Trash2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { Button } from "@/components/ui/button";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useDownloads } from "@/components/providers/downloads-provider";
import { cn } from "@/lib/utils";
import type { DownloadItemData } from "~/types/downloads";

export function formatDownloadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 100 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

function ProgressRing({ progress }: { progress: number | null }) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const pct = progress !== null ? progress : 0.35;
  const offset = circumference * (1 - pct);

  return (
    <svg
      viewBox="0 0 28 28"
      className={cn("absolute inset-0 size-full -rotate-90 pointer-events-none", progress === null && "animate-spin")}
    >
      <circle cx="14" cy="14" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-sky-500 transition-[stroke-dashoffset] duration-150"
      />
    </svg>
  );
}

function DownloadPopoverRow({ item }: { item: DownloadItemData }) {
  const isRunning = item.state === "progressing" || item.state === "paused";
  const pct = item.totalBytes > 0 ? Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100)) : null;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg p-2 bg-black/5 dark:bg-white/5 hover:bg-black/8 dark:hover:bg-white/8 transition-colors">
      <div className="flex items-start gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-black/90 dark:text-white/90 truncate">{item.filename}</p>
          <p className="text-[11px] text-black/55 dark:text-white/55 truncate tabular-nums">
            {item.state === "progressing" && (
              <>
                {formatDownloadBytes(item.receivedBytes)}
                {item.totalBytes > 0 ? ` / ${formatDownloadBytes(item.totalBytes)}` : ""}
                {item.speedBytesPerSec > 0 ? ` • ${formatDownloadBytes(item.speedBytesPerSec)}/s` : ""}
              </>
            )}
            {item.state === "paused" &&
              `Paused • ${formatDownloadBytes(item.receivedBytes)}${item.totalBytes > 0 ? ` / ${formatDownloadBytes(item.totalBytes)}` : ""}`}
            {item.state === "completed" && (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-500" />
                {formatDownloadBytes(item.totalBytes || item.receivedBytes)}
              </span>
            )}
            {item.state === "cancelled" && "Cancelled"}
            {item.state === "interrupted" && "Interrupted"}
          </p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {item.state === "progressing" && (
            <button
              type="button"
              onClick={() => void lumi.downloads.pause(item.id)}
              title="Pause"
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 text-black/70 dark:text-white/75 cursor-pointer"
            >
              <Pause className="size-3.5" />
            </button>
          )}
          {item.state === "paused" && item.canResume && (
            <button
              type="button"
              onClick={() => void lumi.downloads.resume(item.id)}
              title="Resume"
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 text-black/70 dark:text-white/75 cursor-pointer"
            >
              <Play className="size-3.5" />
            </button>
          )}
          {isRunning && (
            <button
              type="button"
              onClick={() => void lumi.downloads.cancel(item.id)}
              title="Cancel"
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 text-black/70 dark:text-white/75 cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
          {item.state === "completed" && (
            <>
              <button
                type="button"
                onClick={() => void lumi.downloads.openFile(item.id)}
                title="Open File"
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 text-black/70 dark:text-white/75 cursor-pointer"
              >
                <ExternalLink className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void lumi.downloads.showInFinder(item.id)}
                title="Show in Finder"
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 text-black/70 dark:text-white/75 cursor-pointer"
              >
                <FolderOpen className="size-3.5" />
              </button>
            </>
          )}
          {(item.state === "cancelled" || item.state === "interrupted") && (
            <button
              type="button"
              onClick={() => void lumi.downloads.retry(item.id)}
              title="Retry"
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 text-black/70 dark:text-white/75 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
          {!isRunning && (
            <button
              type="button"
              onClick={() => void lumi.downloads.remove(item.id)}
              title="Remove from list"
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/15 text-black/50 dark:text-white/50 cursor-pointer"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {isRunning && (
        <div className="h-1 w-full rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-150",
              item.state === "paused" ? "bg-amber-500" : "bg-sky-500"
            )}
            style={{ width: pct !== null ? `${pct}%` : "40%" }}
          />
        </div>
      )}
    </div>
  );
}

export function DownloadsButton() {
  const [open, setOpen] = useState(false);
  const { downloads, hasActiveDownloads, overallProgress } = useDownloads();
  const { isCurrentSpaceLight } = useSpaces();
  const spaceInjectedClasses = cn(isCurrentSpaceLight ? "" : "dark");

  const openAllDownloads = useCallback(() => {
    lumi.tabs.newTab("lumi://downloads", true);
    setOpen(false);
  }, []);

  const recentDownloads = downloads.slice(0, 8);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Button
        size="icon"
        className="relative size-8 bg-transparent hover:bg-black/10 dark:hover:bg-white/10"
        title={hasActiveDownloads ? "Downloads (in progress)" : "Downloads"}
        asChild
      >
        <PopoverTrigger nativeButton={true}>
          <div className="relative flex items-center justify-center size-7">
            {hasActiveDownloads && <ProgressRing progress={overallProgress} />}
            <DownloadIcon
              strokeWidth={2}
              className={cn(
                "w-4 h-4 transition-colors",
                hasActiveDownloads ? "text-sky-500" : "text-black/80 dark:text-white/80"
              )}
            />
          </div>
        </PopoverTrigger>
      </Button>

      <PopoverContent className="w-80 p-2.5 select-none" positionerClassName={spaceInjectedClasses}>
        <div className="flex items-center justify-between px-1 pb-2 border-b border-black/10 dark:border-white/10">
          <span className="text-xs font-semibold text-black/85 dark:text-white/85">Downloads</span>
          <div className="flex items-center gap-1">
            {downloads.some((d) => d.state !== "progressing" && d.state !== "paused") && (
              <button
                type="button"
                onClick={() => void lumi.downloads.clearCompleted()}
                className="text-[11px] px-1.5 py-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-black/60 dark:text-white/60 cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => void lumi.downloads.openDownloadsFolder()}
              title="Open Downloads folder"
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-black/65 dark:text-white/70 cursor-pointer"
            >
              <FolderOpen className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto py-2">
          {recentDownloads.length === 0 ? (
            <p className="py-6 text-center text-xs text-black/50 dark:text-white/50">No recent downloads</p>
          ) : (
            recentDownloads.map((item) => <DownloadPopoverRow key={item.id} item={item} />)
          )}
        </div>

        <button
          type="button"
          onClick={openAllDownloads}
          className="w-full py-1.5 rounded-md text-xs font-medium text-center text-black/75 dark:text-white/80 bg-black/5 dark:bg-white/8 hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
        >
          View All Downloads
        </button>
      </PopoverContent>
    </Popover>
  );
}
