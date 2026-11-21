import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InternalPageShell } from "@/components/main/internal-page-shell";
import { getBangs, waitForBangsLoad, type BangEntry } from "@/lib/omnibox-new/bangs-initializer";
import { motion } from "motion/react";
import { Search, Sparkles } from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

const INITIAL_BANGS_RENDER_LIMIT = 150;
const BANGS_PAGE_STEP = 200;

function getBangDestination(entry: BangEntry): string {
  if (entry.d.includes(".")) {
    return `https://${entry.d}`;
  }

  try {
    return new URL(entry.u.replace("{{{s}}}", "")).origin;
  } catch {
    return entry.u.replace("{{{s}}}", "");
  }
}

function getBangHost(entry: BangEntry): string {
  try {
    return new URL(entry.u.replace("{{{s}}}", "")).hostname.replace(/^www\./, "");
  } catch {
    return entry.d.replace(/^www\./, "");
  }
}

function getBangSearchTokens(entry: BangEntry): string {
  return [entry.t, entry.s, entry.d, entry.c, entry.sc].filter(Boolean).join("\n").toLowerCase();
}

function getBangSortScore(entry: BangEntry, query: string): number {
  if (!query) return 99;

  const bangText = `!${entry.t}`.toLowerCase();
  const shortName = entry.s.toLowerCase();
  const domain = entry.d.toLowerCase();

  if (bangText === query || entry.t.toLowerCase() === query) return 0;
  if (bangText.startsWith(query) || entry.t.toLowerCase().startsWith(query)) return 1;
  if (shortName.startsWith(query)) return 2;
  if (domain.startsWith(query)) return 3;
  if (bangText.includes(query) || entry.t.toLowerCase().includes(query)) return 4;
  if (shortName.includes(query)) return 5;
  if (domain.includes(query)) return 6;
  return 7;
}

function groupBangsByCategory(entries: BangEntry[], query: string) {
  const groups = new Map<string, BangEntry[]>();

  for (const entry of entries) {
    const category = entry.c ?? "Other";
    const list = groups.get(category) ?? [];
    list.push(entry);
    groups.set(category, list);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => {
        const scoreDelta = getBangSortScore(a, query) - getBangSortScore(b, query);
        if (scoreDelta !== 0) return scoreDelta;
        return a.t.localeCompare(b.t);
      })
    }));
}

function BangsPage() {
  const [bangEntries, setBangEntries] = useState(() => getBangs());
  const [search, setSearch] = useState("");
  const [renderLimit, setRenderLimit] = useState(INITIAL_BANGS_RENDER_LIMIT);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  useEffect(() => {
    setRenderLimit(INITIAL_BANGS_RENDER_LIMIT);
  }, [deferredSearch]);

  useEffect(() => {
    if (bangEntries.length > 0) return;

    let cancelled = false;

    void waitForBangsLoad().then(() => {
      if (cancelled) return;
      startTransition(() => {
        setBangEntries(getBangs());
      });
    });

    return () => {
      cancelled = true;
    };
  }, [bangEntries.length]);

  const { groupedBangs, totalMatching } = useMemo(() => {
    const filteredBangs = deferredSearch
      ? bangEntries.filter((entry) => getBangSearchTokens(entry).includes(deferredSearch))
      : bangEntries;

    return {
      totalMatching: filteredBangs.length,
      groupedBangs: groupBangsByCategory(filteredBangs.slice(0, renderLimit), deferredSearch)
    };
  }, [bangEntries, deferredSearch, renderLimit]);

  const remainingCount = Math.max(0, totalMatching - renderLimit);

  return (
    <InternalPageShell
      title="Search Bangs"
      subtitle={`${totalMatching.toLocaleString()} shortcuts`}
      icon={<Sparkles className="size-4" />}
      searchSlot={
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bangs, sites, or categories (e.g. !gh, youtube, dev)"
            aria-label="Search bangs"
            className="h-9 w-full rounded-xl border border-black/10 bg-black/4 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary/45 focus:bg-background focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/6"
          />
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-col gap-4"
      >
        {bangEntries.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>
        ) : totalMatching === 0 ? (
          <div className="lumi-glass-panel py-16 text-center">
            <p className="font-medium text-foreground">No bangs found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search keyword.</p>
          </div>
        ) : (
          <>
            {groupedBangs.map((group) => (
              <Card key={group.category} className="lumi-glass-panel gap-0 overflow-clip py-0">
                <CardHeader className="sticky top-15 z-5 gap-0 border-b border-black/8 bg-background/85 px-4 py-2.5! backdrop-blur-xl dark:border-white/10">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.category}
                  </span>
                </CardHeader>
                <CardContent className="p-1.5">
                  <ul>
                    {group.items.map((entry) => (
                      <li key={entry.t}>
                        <a
                          href={getBangDestination(entry)}
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-inherit no-underline transition-colors hover:bg-black/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-white/6"
                        >
                          <div className="flex h-8 min-w-14 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-black/4 px-2 dark:border-white/12 dark:bg-white/6">
                            <span className="truncate font-mono text-[11px] font-medium text-primary">!{entry.t}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium leading-snug text-foreground">
                              {entry.s}
                            </span>
                            <span className="block truncate text-[11px] leading-snug text-muted-foreground">
                              {[entry.sc, getBangHost(entry)].filter(Boolean).join(" • ")}
                            </span>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
            {remainingCount > 0 && (
              <div className="flex justify-center py-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRenderLimit((prev) => prev + BANGS_PAGE_STEP)}
                >
                  Load more ({remainingCount.toLocaleString()} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </InternalPageShell>
  );
}

function App() {
  return (
    <>
      <title>Bangs</title>
      <BangsPage />
    </>
  );
}

export default App;
