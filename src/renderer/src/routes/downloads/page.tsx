import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FolderOpen,
  Pause,
  Play,
  RotateCcw,
  Search,
  Trash2,
  X,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDownloadBytes } from "@/components/browser-ui/browser-sidebar/_components/downloads-button";
import { cn } from "@/lib/utils";
import type { DownloadItemData } from "~/types/downloads";

type FilterTab = "all" | "active" | "completed" | "failed";

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    lumi.downloads
      .list()
      .then((items) => {
        if (mounted) setDownloads(items);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const unsubChanged = lumi.downloads.onChanged((items) => {
      setDownloads(items);
    });
    const unsubEvent = lumi.downloads.onEvent((event) => {
      if (event.type === "completed") {
        toast.success(`Downloaded ${event.item.filename}`);
      } else if (event.type === "failed") {
        toast.error(`Download failed: ${event.item.filename}`);
      }
    });

    return () => {
      mounted = false;
      unsubChanged();
      unsubEvent();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredDownloads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return downloads.filter((item) => {
      if (filter === "active" && item.state !== "progressing" && item.state !== "paused") return false;
      if (filter === "completed" && item.state !== "completed") return false;
      if (filter === "failed" && item.state !== "interrupted" && item.state !== "cancelled") return false;
      if (!q) return true;
      return (
        item.filename.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        item.finalUrl.toLowerCase().includes(q)
      );
    });
  }, [downloads, filter, search]);

  const hasClearable = downloads.some((d) => d.state !== "progressing" && d.state !== "paused");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-elevated bg-background/90 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground tracking-tight shrink-0">Downloads</h1>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search downloads"
              aria-label="Search downloads"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 focus:bg-background"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void lumi.downloads.openDownloadsFolder()}
            className="gap-1.5 border text-muted-foreground hover:text-foreground shrink-0"
          >
            <FolderOpen className="size-4" />
            Open folder
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={!hasClearable}
            onClick={() => {
              void lumi.downloads.clearCompleted().then((count) => {
                if (count > 0) toast.success(`Cleared ${count} download${count === 1 ? "" : "s"}`);
              });
            }}
            className="gap-1.5 border text-muted-foreground hover:text-foreground shrink-0"
          >
            <Trash2 className="size-4" />
            Clear finished
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="max-w-3xl mx-auto px-6 pb-2.5 flex items-center gap-1.5">
          {(
            [
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "completed", label: "Completed" },
              { id: "failed", label: "Interrupted" }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
                filter === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main List */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="max-w-3xl mx-auto w-full px-6 py-6 flex flex-col gap-3"
      >
        {loading ? (
          <div className="py-20 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filteredDownloads.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Download className="size-9 mx-auto text-muted-foreground/40" />
            <p className="text-foreground font-medium">{search ? "No matching downloads" : "No downloads yet"}</p>
            <p className="text-sm text-muted-foreground">
              {search ? "Try another search query." : "Files you download from websites will show up here."}
            </p>
          </div>
        ) : (
          filteredDownloads.map((item) => {
            const isRunning = item.state === "progressing" || item.state === "paused";
            const pct =
              item.totalBytes > 0 ? Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100)) : null;

            return (
              <Card key={item.id} className="overflow-hidden border-border/60">
                <CardContent className="p-4 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.state === "completed" ? (
                          <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                        ) : item.state === "interrupted" || item.state === "cancelled" ? (
                          <AlertCircle className="size-4 text-amber-500 shrink-0" />
                        ) : (
                          <Download className="size-4 text-sky-500 shrink-0" />
                        )}
                        <span className="font-medium text-sm text-foreground truncate">{item.filename}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
                        <span>{formatHost(item.finalUrl || item.url)}</span>
                        <span>•</span>
                        <span>{formatTimestamp(item.startTime)}</span>
                        <span>•</span>
                        {item.state === "progressing" && (
                          <span>
                            {formatDownloadBytes(item.receivedBytes)}
                            {item.totalBytes > 0 ? ` of ${formatDownloadBytes(item.totalBytes)}` : ""}
                            {item.speedBytesPerSec > 0 ? ` (${formatDownloadBytes(item.speedBytesPerSec)}/s)` : ""}
                          </span>
                        )}
                        {item.state === "paused" && (
                          <span>
                            Paused at {formatDownloadBytes(item.receivedBytes)}
                            {item.totalBytes > 0 ? ` of ${formatDownloadBytes(item.totalBytes)}` : ""}
                          </span>
                        )}
                        {item.state === "completed" && (
                          <span>{formatDownloadBytes(item.totalBytes || item.receivedBytes)}</span>
                        )}
                        {item.state === "cancelled" && <span className="text-amber-500/90">Cancelled</span>}
                        {item.state === "interrupted" && <span className="text-destructive">Interrupted</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.state === "progressing" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => void lumi.downloads.pause(item.id)}
                          title="Pause"
                        >
                          <Pause className="size-4" />
                        </Button>
                      )}
                      {item.state === "paused" && item.canResume && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => void lumi.downloads.resume(item.id)}
                          title="Resume"
                        >
                          <Play className="size-4" />
                        </Button>
                      )}
                      {isRunning && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => void lumi.downloads.cancel(item.id)}
                          title="Cancel"
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                      {item.state === "completed" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void lumi.downloads.openFile(item.id).then((ok) => {
                                if (!ok) toast.error("File could not be opened or was moved");
                              });
                            }}
                            className="h-8 gap-1.5"
                          >
                            <ExternalLink className="size-3.5" />
                            Open
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => void lumi.downloads.showInFinder(item.id)}
                            title="Show in Finder"
                          >
                            <FolderOpen className="size-4" />
                          </Button>
                        </>
                      )}
                      {(item.state === "cancelled" || item.state === "interrupted") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void lumi.downloads.retry(item.id)}
                          className="h-8 gap-1.5"
                        >
                          <RotateCcw className="size-3.5" />
                          Retry
                        </Button>
                      )}
                      {!isRunning && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => void lumi.downloads.remove(item.id)}
                          title="Remove from history"
                        >
                          <Trash2 className="size-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isRunning && (
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-150",
                          item.state === "paused" ? "bg-amber-500" : "bg-sky-500"
                        )}
                        style={{ width: pct !== null ? `${pct}%` : "40%" }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </motion.div>
    </div>
  );
}

export default function Page() {
  return <DownloadsPage />;
}
