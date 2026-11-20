import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, BookmarkCheck, Plus, Trash2, Search, Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { useSpaces } from "@/components/providers/spaces-provider";
import { WebsiteFavicon } from "@/components/main/website-favicon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RecentlyClosedTabData } from "~/types/tabs";
import type { WorkspaceSnapshot } from "~/types/snapshots";
import { toast } from "sonner";

function formatRelativeTime(timestamp: number): string {
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const diffSec = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return "Just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function RecentlyClosedPopover({ compact = false }: { compact?: boolean }) {
  const { currentSpace, isCurrentSpaceLight } = useSpaces();
  const currentSpaceId = currentSpace?.id;
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"closed" | "snapshots">("closed");
  const [recentTabs, setRecentTabs] = useState<RecentlyClosedTabData[]>([]);
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshot[]>([]);
  const [search, setSearch] = useState("");
  const [snapshotName, setSnapshotName] = useState("");
  const [saving, setSaving] = useState(false);

  const spaceInjectedClasses = cn(isCurrentSpaceLight ? "" : "dark");

  const refreshData = useCallback(async () => {
    try {
      const [closedList, snapList] = await Promise.all([
        lumi.tabs.getRecentlyClosed(),
        lumi.snapshots.list(currentSpaceId)
      ]);
      setRecentTabs(closedList);
      setSnapshots(snapList);
    } catch {
      // ignore refresh failures
    }
  }, [currentSpaceId]);

  useEffect(() => {
    if (open) {
      void refreshData();
    }
  }, [open, refreshData]);

  useEffect(() => {
    const onWorkspaceAction = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "recently_closed") {
        setActiveTab("closed");
        setOpen(true);
      } else if (detail === "save_snapshot") {
        setActiveTab("snapshots");
        setOpen(true);
      }
    };
    window.addEventListener("lumi:workspace-action", onWorkspaceAction);
    return () => window.removeEventListener("lumi:workspace-action", onWorkspaceAction);
  }, []);

  const filteredClosed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recentTabs;
    return recentTabs.filter(
      (item) => item.tabData.title.toLowerCase().includes(q) || item.tabData.url.toLowerCase().includes(q)
    );
  }, [recentTabs, search]);

  const handleRestoreClosed = async (uniqueId: string) => {
    const ok = await lumi.tabs.restoreRecentlyClosed(uniqueId);
    if (ok) {
      setRecentTabs((prev) => prev.filter((item) => item.tabData.uniqueId !== uniqueId));
      setOpen(false);
    }
  };

  const handleClearClosed = async () => {
    await lumi.tabs.clearRecentlyClosed();
    setRecentTabs([]);
  };

  const handleSaveSnapshot = async () => {
    if (!currentSpace?.id || saving) return;
    setSaving(true);
    try {
      const saved = await lumi.snapshots.save(currentSpace.id, snapshotName);
      if (saved) {
        setSnapshots((prev) => [saved, ...prev]);
        setSnapshotName("");
        toast.success(`Saved snapshot "${saved.name}"`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreSnapshot = async (snapshot: WorkspaceSnapshot) => {
    const ok = await lumi.snapshots.restore(snapshot.id, false);
    if (ok) {
      toast.success(`Restored ${snapshot.tabs.length} tabs from "${snapshot.name}"`);
      setOpen(false);
    } else {
      toast.error("Could not restore snapshot");
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    const ok = await lumi.snapshots.remove(snapshotId);
    if (ok) {
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        onClick={(e) => e.stopPropagation()}
        title="Recently Closed Tabs & Workspace Snapshots"
        className={cn(
          "flex items-center justify-center rounded-lg text-black/65 transition-colors hover:bg-black/8 hover:text-black/90 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
          compact ? "size-7" : "size-7"
        )}
      >
        <RotateCcw className="size-3.5" />
      </PopoverTrigger>

      <PopoverContent
        variant="translucent"
        className="w-84 space-y-3 p-3.5 font-sans select-none"
        positionerClassName={spaceInjectedClasses}
      >
        <div className="flex items-center gap-1 rounded-xl border border-black/8 bg-black/5 p-1 dark:border-white/10 dark:bg-white/6">
          <button
            type="button"
            onClick={() => setActiveTab("closed")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all",
              activeTab === "closed"
                ? "bg-white text-foreground shadow-xs dark:bg-white/15 dark:text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <RotateCcw className="size-3.5" />
            Recently Closed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("snapshots")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all",
              activeTab === "snapshots"
                ? "bg-white text-foreground shadow-xs dark:bg-white/15 dark:text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BookmarkCheck className="size-3.5" />
            Snapshots
          </button>
        </div>

        {activeTab === "closed" ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter closed tabs..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              {recentTabs.length > 0 && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleClearClosed}>
                  Clear
                </Button>
              )}
            </div>

            {filteredClosed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/10 py-8 text-center text-xs text-muted-foreground dark:border-white/10">
                No recently closed tabs
              </div>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto pr-0.5">
                {filteredClosed.map((item) => (
                  <button
                    key={item.tabData.uniqueId}
                    type="button"
                    onClick={() => void handleRestoreClosed(item.tabData.uniqueId)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-black/6 dark:hover:bg-white/8"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs dark:bg-white/10">
                      {item.tabData.url.startsWith("http") ? (
                        <WebsiteFavicon
                          url={item.tabData.url}
                          favicon={item.tabData.faviconURL ?? undefined}
                          className="size-3.5"
                        />
                      ) : (
                        <Globe className="size-3.5 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-foreground">
                        {item.tabData.title || getHostname(item.tabData.url)}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">{getHostname(item.tabData.url)}</div>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelativeTime(item.closedAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Input
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleSaveSnapshot();
                  }
                }}
                placeholder={currentSpace ? `Save "${currentSpace.name}" tabs...` : "Snapshot name..."}
                className="h-8 flex-1 text-xs"
              />
              <Button
                size="sm"
                className="h-8 gap-1 px-2.5 text-xs"
                onClick={() => void handleSaveSnapshot()}
                disabled={!currentSpace || saving}
              >
                <Plus className="size-3.5" />
                Save
              </Button>
            </div>

            {snapshots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/10 py-8 text-center text-xs text-muted-foreground dark:border-white/10">
                Save a snapshot of your current Space tabs &amp; splits to jump back anytime.
              </div>
            ) : (
              <div className="max-h-60 space-y-1.5 overflow-y-auto pr-0.5">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-black/6 bg-black/3 px-2.5 py-2 dark:border-white/8 dark:bg-white/4"
                  >
                    <button
                      type="button"
                      onClick={() => void handleRestoreSnapshot(snap)}
                      className="min-w-0 flex-1 text-left transition-opacity hover:opacity-80"
                    >
                      <div className="truncate text-xs font-medium text-foreground">{snap.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {snap.tabs.length} tabs · {formatRelativeTime(snap.createdAt)}
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDeleteSnapshot(snap.id)}
                      title="Delete snapshot"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
