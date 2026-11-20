import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { WebsiteFavicon } from "@/components/main/website-favicon";
import { InternalPageShell } from "@/components/main/internal-page-shell";
import { simplifyUrl } from "@/lib/url";
import type { BrowsingHistoryVisit, HistoryVisitsPageCursor } from "~/types/history";
import { Clock, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

const HISTORY_PAGE_SIZE = 150;

function historyVisitsQueryKey(search: string) {
  return ["history", "visits", search] as const;
}

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daySectionLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t1 = t0 - 86400000;
  const fullDate = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  if (ts >= t0) return `Today - ${fullDate}`;
  if (ts >= t1) return `Yesterday - ${fullDate}`;
  return fullDate;
}

function groupVisitsByDay(
  visits: BrowsingHistoryVisit[]
): { dayStart: number; label: string; items: BrowsingHistoryVisit[] }[] {
  const map = new Map<number, BrowsingHistoryVisit[]>();
  for (const v of visits) {
    const key = startOfLocalDay(v.visitTime);
    const list = map.get(key) ?? [];
    list.push(v);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([dayStart, items]) => ({
      dayStart,
      label: daySectionLabel(dayStart),
      items: items.sort((a, b) => b.visitTime - a.visitTime)
    }));
}

function HistoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clearDialogOpen, setClearDialogOpen] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("clear") === "1"
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isPending, refetch } = useInfiniteQuery({
    queryKey: historyVisitsQueryKey(debouncedSearch),
    queryFn: async ({ pageParam }: { pageParam: HistoryVisitsPageCursor | undefined }) => {
      return lumi.history.listVisitsPage({
        search: debouncedSearch || undefined,
        limit: HISTORY_PAGE_SIZE,
        cursor: pageParam
      });
    },
    initialPageParam: undefined as HistoryVisitsPageCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });

  useEffect(() => {
    if (isError) toast.error("Could not load history");
  }, [isError]);

  const visits = useMemo(() => data?.pages.flatMap((p) => p.visits) ?? [], [data]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && !isFetchingNextPage) void fetchNextPage();
      },
      { root: null, rootMargin: "240px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const invalidateHistory = () => {
    void queryClient.invalidateQueries({ queryKey: ["history", "visits"] });
  };

  const grouped = useMemo(() => groupVisitsByDay(visits), [visits]);

  const openInNewTab = (url: string) => {
    void lumi.tabs.newTab(url, true);
  };

  const copyLinkAddress = (url: string) => {
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy link")
    );
  };

  const removeVisit = async (visitId: number) => {
    const ok = await lumi.history.deleteVisit(visitId);
    if (ok) {
      toast.success("Removed from history");
      invalidateHistory();
    } else {
      toast.error("Could not remove visit");
    }
  };

  const removeAllForSite = async (urlRowId: number) => {
    const ok = await lumi.history.deleteAllForUrl(urlRowId);
    if (ok) {
      toast.success("Removed visits for this site");
      invalidateHistory();
    } else {
      toast.error("Could not remove site history");
    }
  };

  const clearAll = async () => {
    await lumi.history.clearAll();
    toast.success("History cleared");
    invalidateHistory();
  };

  return (
    <InternalPageShell
      title="History"
      icon={<Clock className="size-4" />}
      searchSlot={
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search browsing history..."
            aria-label="Search history"
            className="h-9 w-full rounded-xl border border-black/10 bg-black/4 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary/45 focus:bg-background focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/6"
          />
        </div>
      }
      headerActions={
        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={!debouncedSearch && visits.length === 0 && !isPending}
            >
              <Trash2 className="size-3.5" />
              Clear data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all history?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes every visit in this profile from Lumi. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void clearAll()}>Clear history</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-col gap-4"
      >
        {isPending ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="lumi-glass-panel space-y-3 py-16 text-center">
            <p className="font-medium text-foreground">Could not load history</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : visits.length === 0 ? (
          <div className="lumi-glass-panel py-16 text-center">
            <Clock className="mx-auto mb-3 size-10 text-muted-foreground opacity-40" />
            <p className="font-medium text-foreground">No history found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {debouncedSearch ? "Try a different search." : "Pages you open appear here."}
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <Card key={group.dayStart} className="lumi-glass-panel gap-0 overflow-clip py-0">
              <CardHeader className="sticky top-15 z-5 gap-0 border-b border-black/8 bg-background/85 px-4 py-2.5! backdrop-blur-xl dark:border-white/10">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </span>
              </CardHeader>
              <CardContent className="p-1.5">
                <ul>
                  {group.items.map((v) => (
                    <ContextMenu key={v.visitId}>
                      <ContextMenuTrigger asChild>
                        <li className="group flex cursor-default items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-black/4 dark:hover:bg-white/6">
                          <a
                            href={v.url}
                            rel="noopener noreferrer"
                            className="flex min-w-0 flex-1 items-center gap-3 rounded text-left text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            <WebsiteFavicon url={v.url} className="size-5 shrink-0 rounded-sm bg-muted object-cover" />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium leading-snug text-foreground">
                                {v.title || simplifyUrl(v.url)}
                              </span>
                              <span className="block truncate text-[11px] leading-snug text-muted-foreground">
                                {simplifyUrl(v.url)}
                              </span>
                            </div>
                            <time
                              className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:block"
                              dateTime={new Date(v.visitTime).toISOString()}
                            >
                              {new Date(v.visitTime).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit"
                              })}
                            </time>
                          </a>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0 opacity-0 transition-opacity group-focus-within:opacity-60 group-hover:opacity-60 hover:opacity-100! focus-visible:opacity-100!"
                                aria-label="More actions"
                              >
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => void removeVisit(v.visitId)}>Delete</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void removeAllForSite(v.urlRowId)}>
                                Delete all from this site
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </li>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-52">
                        <ContextMenuItem onSelect={() => window.location.assign(v.url)}>Open link</ContextMenuItem>
                        <ContextMenuItem onSelect={() => openInNewTab(v.url)}>Open in new tab</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => copyLinkAddress(v.url)}>Copy link address</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem variant="destructive" onSelect={() => void removeVisit(v.visitId)}>
                          Delete
                        </ContextMenuItem>
                        <ContextMenuItem variant="destructive" onSelect={() => void removeAllForSite(v.urlRowId)}>
                          Delete all from this site
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
        {visits.length > 0 && (
          <div
            ref={loadMoreRef}
            className="flex min-h-8 flex-col items-center justify-center gap-1 py-4 text-sm text-muted-foreground"
          >
            {isFetchingNextPage ? <span>Loading more…</span> : null}
            {!hasNextPage && !isFetchingNextPage ? <span>End of history</span> : null}
          </div>
        )}
      </motion.div>
    </InternalPageShell>
  );
}

function App() {
  return (
    <>
      <title>History</title>
      <HistoryPage />
    </>
  );
}

export default App;
