import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/saving/db";
import { historyUrls, historyVisits } from "@/saving/db/schema";
import type {
  BrowsingHistoryEntry,
  BrowsingHistoryVisit,
  HistoryVisitsPage,
  HistoryVisitsPageCursor
} from "~/types/history";

const RETENTION_MS = 10 * 365 * 24 * 60 * 60 * 1000;
const FALLBACK_IMPORT_VISIT_TIME = 946_684_800_000; // 2000-01-01T00:00:00Z deterministic fallback for missing source timestamps

function normalizeImportedVisitTime(rawVisitTime: number | null | undefined, now: number): number {
  if (typeof rawVisitTime !== "number" || !Number.isFinite(rawVisitTime) || rawVisitTime <= 0) {
    return FALLBACK_IMPORT_VISIT_TIME;
  }
  return Math.min(Math.floor(rawVisitTime), now);
}
type HistoryDb = ReturnType<typeof getDb>;
type HistoryTx = Parameters<Parameters<HistoryDb["transaction"]>[0]>[0];
type HistoryDbExecutor = HistoryDb | HistoryTx;

export function isHistoryRecordableUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function recordBrowsingHistoryVisit(args: {
  profileId: string;
  url: string;
  title: string;
  incrementTyped?: boolean;
}): void {
  const db = getDb();
  const now = Date.now();
  let displayTitle = args.title.trim();
  if (!displayTitle) {
    try {
      displayTitle = new URL(args.url).hostname;
    } catch {
      displayTitle = args.url;
    }
  }

  db.transaction((tx) => {
    const existing = tx
      .select()
      .from(historyUrls)
      .where(and(eq(historyUrls.profileId, args.profileId), eq(historyUrls.url, args.url)))
      .limit(1)
      .all();

    let urlId: number;
    if (existing[0]) {
      const row = existing[0];
      urlId = row.id;
      tx.update(historyUrls)
        .set({
          visitCount: row.visitCount + 1,
          lastVisitTime: now,
          title: displayTitle || row.title,
          typedCount: args.incrementTyped ? row.typedCount + 1 : row.typedCount
        })
        .where(eq(historyUrls.id, urlId))
        .run();
    } else {
      const inserted = tx
        .insert(historyUrls)
        .values({
          profileId: args.profileId,
          url: args.url,
          title: displayTitle,
          visitCount: 1,
          typedCount: args.incrementTyped ? 1 : 0,
          lastVisitTime: now
        })
        .returning({ id: historyUrls.id })
        .all();
      urlId = inserted[0]!.id;
    }
    tx.insert(historyVisits)
      .values({ urlId, visitTime: now, typed: args.incrementTyped ?? false })
      .run();
  });
}

/** Update stored title when the live tab title changes (no new visit row). */
export function updateBrowsingHistoryTitleForOpenPage(args: { profileId: string; url: string; title: string }): void {
  const trimmed = args.title.trim();
  if (!trimmed) return;

  getDb()
    .update(historyUrls)
    .set({ title: trimmed })
    .where(and(eq(historyUrls.profileId, args.profileId), eq(historyUrls.url, args.url)))
    .run();
}

export function listBrowsingHistoryForProfile(profileId: string): BrowsingHistoryEntry[] {
  const rows = getDb()
    .select()
    .from(historyUrls)
    .where(eq(historyUrls.profileId, profileId))
    .orderBy(desc(historyUrls.lastVisitTime))
    .limit(200)
    .all();

  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    visitCount: row.visitCount,
    typedCount: row.typedCount,
    lastVisitTime: row.lastVisitTime
  }));
}

const VISIT_LIST_LIMIT = 2500;

export function listBrowsingVisitsForProfile(profileId: string, search?: string): BrowsingHistoryVisit[] {
  const db = getDb();
  const q = search?.trim();
  const profileCond = eq(historyUrls.profileId, profileId);
  const searchCond =
    q && q.length > 0
      ? or(
          sql`instr(lower(${historyUrls.url}), lower(${q})) > 0`,
          sql`instr(lower(${historyUrls.title}), lower(${q})) > 0`
        )
      : undefined;

  const rows = db
    .select({
      visitId: historyVisits.id,
      urlRowId: historyUrls.id,
      url: historyUrls.url,
      title: historyUrls.title,
      visitTime: historyVisits.visitTime
    })
    .from(historyVisits)
    .innerJoin(historyUrls, eq(historyVisits.urlId, historyUrls.id))
    .where(searchCond ? and(profileCond, searchCond) : profileCond)
    .orderBy(desc(historyVisits.visitTime))
    .limit(VISIT_LIST_LIMIT)
    .all();

  return rows.map((row) => ({
    visitId: row.visitId,
    urlRowId: row.urlRowId,
    url: row.url,
    title: row.title,
    visitTime: row.visitTime
  }));
}

const HISTORY_PAGE_DEFAULT_LIMIT = 80;
const HISTORY_PAGE_MAX_LIMIT = 200;

export function listBrowsingVisitsPageForProfile(
  profileId: string,
  args: { search?: string; limit?: number; cursor?: HistoryVisitsPageCursor }
): HistoryVisitsPage {
  const db = getDb();
  const q = args.search?.trim();
  const profileCond = eq(historyUrls.profileId, profileId);
  const searchCond =
    q && q.length > 0
      ? or(
          sql`instr(lower(${historyUrls.url}), lower(${q})) > 0`,
          sql`instr(lower(${historyUrls.title}), lower(${q})) > 0`
        )
      : undefined;

  const cursor = args.cursor;
  const cursorCond =
    cursor != null
      ? or(
          lt(historyVisits.visitTime, cursor.visitTime),
          and(eq(historyVisits.visitTime, cursor.visitTime), lt(historyVisits.id, cursor.visitId))
        )
      : undefined;

  const conditions = [profileCond];
  if (searchCond) conditions.push(searchCond);
  if (cursorCond) conditions.push(cursorCond);

  const rawLimit = args.limit ?? HISTORY_PAGE_DEFAULT_LIMIT;
  const limit = Math.min(Math.max(rawLimit, 1), HISTORY_PAGE_MAX_LIMIT);

  const rows = db
    .select({
      visitId: historyVisits.id,
      urlRowId: historyUrls.id,
      url: historyUrls.url,
      title: historyUrls.title,
      visitTime: historyVisits.visitTime
    })
    .from(historyVisits)
    .innerJoin(historyUrls, eq(historyVisits.urlId, historyUrls.id))
    .where(and(...conditions))
    .orderBy(desc(historyVisits.visitTime), desc(historyVisits.id))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  const nextCursor: HistoryVisitsPageCursor | null =
    hasMore && last != null ? { visitTime: last.visitTime, visitId: last.visitId } : null;

  const visits: BrowsingHistoryVisit[] = slice.map((row) => ({
    visitId: row.visitId,
    urlRowId: row.urlRowId,
    url: row.url,
    title: row.title,
    visitTime: row.visitTime
  }));

  return { visits, nextCursor };
}

/** After deleting one or more visits for a URL, refresh aggregates or drop the URL row. */
function reconcileUrlAggregatesAfterVisitChangeInDb(db: HistoryDbExecutor, urlId: number): void {
  const stats = db
    .select({
      cnt: sql<number>`count(*)`,
      typedCnt: sql<number>`coalesce(sum(${historyVisits.typed}), 0)`,
      maxT: sql<number | null>`max(${historyVisits.visitTime})`
    })
    .from(historyVisits)
    .where(eq(historyVisits.urlId, urlId))
    .get();

  const cnt = Number(stats?.cnt ?? 0);
  if (cnt === 0) {
    db.delete(historyUrls).where(eq(historyUrls.id, urlId)).run();
    return;
  }

  db.update(historyUrls)
    .set({
      visitCount: cnt,
      typedCount: Number(stats!.typedCnt ?? 0),
      lastVisitTime: stats!.maxT ?? Date.now()
    })
    .where(eq(historyUrls.id, urlId))
    .run();
}

export function reconcileUrlAggregatesAfterVisitChange(urlId: number): void {
  reconcileUrlAggregatesAfterVisitChangeInDb(getDb(), urlId);
}

export function deleteBrowsingVisitForProfile(profileId: string, visitId: number): boolean {
  const db = getDb();
  let deleted = false;

  db.transaction((tx) => {
    const hit = tx
      .select({ urlId: historyVisits.urlId })
      .from(historyVisits)
      .innerJoin(historyUrls, eq(historyVisits.urlId, historyUrls.id))
      .where(and(eq(historyVisits.id, visitId), eq(historyUrls.profileId, profileId)))
      .limit(1)
      .get();

    if (!hit) return;

    tx.delete(historyVisits).where(eq(historyVisits.id, visitId)).run();
    reconcileUrlAggregatesAfterVisitChangeInDb(tx, hit.urlId);
    deleted = true;
  });

  if (!deleted) return false;
  return true;
}

export function getBrowsingVisitUrlForProfile(profileId: string, visitId: number): string | null {
  const row = getDb()
    .select({ url: historyUrls.url })
    .from(historyVisits)
    .innerJoin(historyUrls, eq(historyVisits.urlId, historyUrls.id))
    .where(and(eq(historyVisits.id, visitId), eq(historyUrls.profileId, profileId)))
    .limit(1)
    .get();

  return row?.url ?? null;
}

export function getBrowsingUrlValueForProfile(profileId: string, urlRowId: number): string | null {
  const row = getDb()
    .select({ url: historyUrls.url })
    .from(historyUrls)
    .where(and(eq(historyUrls.id, urlRowId), eq(historyUrls.profileId, profileId)))
    .limit(1)
    .get();

  return row?.url ?? null;
}

export function deleteBrowsingUrlRowForProfile(profileId: string, urlRowId: number): boolean {
  const db = getDb();
  const exists = db
    .select({ id: historyUrls.id })
    .from(historyUrls)
    .where(and(eq(historyUrls.id, urlRowId), eq(historyUrls.profileId, profileId)))
    .limit(1)
    .all();
  if (!exists[0]) return false;

  db.delete(historyUrls).where(eq(historyUrls.id, urlRowId)).run();
  return true;
}

export function clearBrowsingHistoryForProfile(profileId: string): void {
  const db = getDb();
  db.delete(historyUrls).where(eq(historyUrls.profileId, profileId)).run();
}

/** Drop visits older than configured retention period, deduplicate mass-clamped import visits, and reconcile URL aggregates. */
export function pruneBrowsingHistory(): void {
  const db = getDb();
  const cutoff = Date.now() - RETENTION_MS;
  db.transaction((tx) => {
    // Clean up duplicate visits per url_id that were inserted by legacy clamped batch imports (>100 rows sharing 1ms timestamp)
    tx.run(sql`
      DELETE FROM ${historyVisits}
      WHERE ${historyVisits.visitTime} IN (
        SELECT ${historyVisits.visitTime}
        FROM ${historyVisits}
        GROUP BY ${historyVisits.visitTime}
        HAVING COUNT(*) > 100
      )
      AND ${historyVisits.id} NOT IN (
        SELECT MAX(${historyVisits.id})
        FROM ${historyVisits}
        GROUP BY ${historyVisits.urlId}
      )
    `);

    const affectedUrlRows = tx
      .selectDistinct({ urlId: historyVisits.urlId })
      .from(historyVisits)
      .where(lt(historyVisits.visitTime, cutoff))
      .all();

    if (affectedUrlRows.length === 0) {
      return;
    }

    tx.delete(historyVisits).where(lt(historyVisits.visitTime, cutoff)).run();

    for (const { urlId } of affectedUrlRows) {
      reconcileUrlAggregatesAfterVisitChangeInDb(tx, urlId);
    }
  });
}

/**
 * Batch-import external browsing history items (e.g. from Safari or synced devices)
 * idempotently into the target profile's history tables.
 */
export function importBrowsingHistoryEntries(
  profileId: string,
  entries: Array<{ url: string; title: string; visitTime: number; visitCount?: number }>
): number {
  if (entries.length === 0) return 0;

  const db = getDb();
  const now = Date.now();
  let importedCount = 0;

  db.transaction((tx) => {
    const existingRows = tx
      .select({
        id: historyUrls.id,
        url: historyUrls.url,
        title: historyUrls.title,
        visitCount: historyUrls.visitCount,
        lastVisitTime: historyUrls.lastVisitTime
      })
      .from(historyUrls)
      .where(eq(historyUrls.profileId, profileId))
      .all();

    const urlState = new Map<string, { id: number; title: string; visitCount: number; lastVisitTime: number }>();
    for (const r of existingRows) {
      urlState.set(r.url, {
        id: r.id,
        title: r.title,
        visitCount: r.visitCount,
        lastVisitTime: r.lastVisitTime
      });
    }

    const seenInBatch = new Set<string>();

    for (const entry of entries) {
      if (!isHistoryRecordableUrl(entry.url)) continue;
      const visitTime = normalizeImportedVisitTime(entry.visitTime, now);
      const batchKey = `${entry.url}\u0000${Math.floor(visitTime / 1000)}`;
      if (seenInBatch.has(batchKey)) continue;
      seenInBatch.add(batchKey);

      let displayTitle = entry.title.trim();
      if (!displayTitle) {
        try {
          displayTitle = new URL(entry.url).hostname;
        } catch {
          displayTitle = entry.url;
        }
      }

      const existing = urlState.get(entry.url);
      if (existing) {
        if (existing.lastVisitTime >= visitTime - 1000) {
          continue;
        }
        const nearbyVisit = tx
          .select({ id: historyVisits.id })
          .from(historyVisits)
          .where(and(eq(historyVisits.urlId, existing.id), sql`abs(${historyVisits.visitTime} - ${visitTime}) < 1000`))
          .limit(1)
          .get();
        if (nearbyVisit) continue;

        const nextVisitCount = existing.visitCount + 1;
        const nextLastVisitTime = Math.max(existing.lastVisitTime, visitTime);
        const nextTitle = existing.title || displayTitle;

        tx.insert(historyVisits).values({ urlId: existing.id, visitTime, typed: false }).run();
        tx.update(historyUrls)
          .set({
            visitCount: nextVisitCount,
            lastVisitTime: nextLastVisitTime,
            title: nextTitle
          })
          .where(eq(historyUrls.id, existing.id))
          .run();

        existing.visitCount = nextVisitCount;
        existing.lastVisitTime = nextLastVisitTime;
        existing.title = nextTitle;
        importedCount++;
      } else {
        const initialVisitCount = Math.max(1, entry.visitCount ?? 1);
        const inserted = tx
          .insert(historyUrls)
          .values({
            profileId,
            url: entry.url,
            title: displayTitle,
            visitCount: initialVisitCount,
            typedCount: 0,
            lastVisitTime: visitTime
          })
          .returning({ id: historyUrls.id })
          .all();
        const urlId = inserted[0]!.id;
        tx.insert(historyVisits).values({ urlId, visitTime, typed: false }).run();
        urlState.set(entry.url, {
          id: urlId,
          title: displayTitle,
          visitCount: initialVisitCount,
          lastVisitTime: visitTime
        });
        importedCount++;
      }
    }
  });

  return importedCount;
}

/**
 * Counts how many external browsing history entries would be newly inserted vs skipped as already
 * present in `profileId`, using the exact same URL + visit timestamp deduplication rule
 * as `importBrowsingHistoryEntries`.
 */
export function countNewBrowsingHistoryEntries(
  profileId: string,
  entries: Array<{ url: string; title: string; visitTime: number; visitCount?: number }>
): { newCount: number; alreadyImportedCount: number } {
  if (entries.length === 0) return { newCount: 0, alreadyImportedCount: 0 };

  const db = getDb();
  const now = Date.now();

  const existingRows = db
    .select({ id: historyUrls.id, url: historyUrls.url, lastVisitTime: historyUrls.lastVisitTime })
    .from(historyUrls)
    .where(eq(historyUrls.profileId, profileId))
    .all();
  const urlState = new Map<string, { id: number | null; lastVisitTime: number }>();
  for (const r of existingRows) {
    urlState.set(r.url, { id: r.id, lastVisitTime: r.lastVisitTime });
  }

  const seenInBatch = new Set<string>();
  let newCount = 0;
  let alreadyImportedCount = 0;

  for (const entry of entries) {
    if (!isHistoryRecordableUrl(entry.url)) continue;
    const visitTime = normalizeImportedVisitTime(entry.visitTime, now);
    const batchKey = `${entry.url}\u0000${Math.floor(visitTime / 1000)}`;
    if (seenInBatch.has(batchKey)) continue;
    seenInBatch.add(batchKey);

    const existing = urlState.get(entry.url);
    if (existing) {
      if (existing.lastVisitTime >= visitTime - 1000) {
        alreadyImportedCount++;
        continue;
      }
      if (existing.id !== null) {
        const nearbyVisit = db
          .select({ id: historyVisits.id })
          .from(historyVisits)
          .where(and(eq(historyVisits.urlId, existing.id), sql`abs(${historyVisits.visitTime} - ${visitTime}) < 1000`))
          .limit(1)
          .get();
        if (nearbyVisit) {
          alreadyImportedCount++;
          continue;
        }
      }
      existing.lastVisitTime = Math.max(existing.lastVisitTime, visitTime);
      newCount++;
    } else {
      urlState.set(entry.url, { id: null, lastVisitTime: visitTime });
      newCount++;
    }
  }

  return { newCount, alreadyImportedCount };
}
