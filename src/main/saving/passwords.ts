import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/saving/db";
import {
  passwordNeverSaveSites,
  savedPasswords,
  type PasswordNeverSaveSiteRow,
  type SavedPasswordRow
} from "@/saving/db/schema";
import { decryptPasswordSecret, encryptPasswordSecret } from "@/modules/passwords/crypto";
import { doHostsMatchForAutofill, extractCredentialHost, normalizeCredentialOrigin } from "@/modules/passwords/utils";
import type {
  NeverSaveSiteEntry,
  SavedPasswordSummary,
  SavePasswordInput,
  SiteCredentialMatch
} from "~/types/passwords";

export interface CredentialImportRecord {
  originUrl: string;
  actionUrl?: string | null;
  username: string;
  password: string;
  title?: string | null;
  note?: string | null;
  createdAt?: number;
  lastUsedAt?: number | null;
}

function toSummary(row: SavedPasswordRow): SavedPasswordSummary {
  return {
    id: row.id,
    profileId: row.profileId,
    origin: row.origin,
    host: row.host,
    actionUrl: row.actionUrl,
    username: row.username,
    title: row.title,
    note: row.note,
    timesUsed: row.timesUsed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastUsedAt: row.lastUsedAt
  };
}

function toNeverSaveEntry(row: PasswordNeverSaveSiteRow): NeverSaveSiteEntry {
  return {
    id: row.id,
    profileId: row.profileId,
    host: row.host,
    createdAt: row.createdAt
  };
}

export function listSavedPasswordsForProfile(profileId: string): SavedPasswordSummary[] {
  const db = getDb();
  const rows = db
    .select()
    .from(savedPasswords)
    .where(eq(savedPasswords.profileId, profileId))
    .orderBy(desc(savedPasswords.updatedAt), desc(savedPasswords.createdAt))
    .all();
  return rows.map(toSummary);
}

export function getMatchingCredentialsForUrl(profileId: string, pageUrl: string): SiteCredentialMatch[] {
  const origin = normalizeCredentialOrigin(pageUrl);
  if (!origin) return [];
  const pageHost = extractCredentialHost(origin);
  if (!pageHost) return [];

  const db = getDb();
  const rows = db.select().from(savedPasswords).where(eq(savedPasswords.profileId, profileId)).all();

  const matched = rows.filter((row) => doHostsMatchForAutofill(row.host, pageHost));
  matched.sort((a, b) => {
    const aExactOrigin = a.origin === origin ? 1 : 0;
    const bExactOrigin = b.origin === origin ? 1 : 0;
    if (aExactOrigin !== bExactOrigin) return bExactOrigin - aExactOrigin;

    const aExactHost = a.host === pageHost ? 1 : 0;
    const bExactHost = b.host === pageHost ? 1 : 0;
    if (aExactHost !== bExactHost) return bExactHost - aExactHost;

    if (a.timesUsed !== b.timesUsed) return b.timesUsed - a.timesUsed;
    return (b.lastUsedAt ?? b.updatedAt) - (a.lastUsedAt ?? a.updatedAt);
  });

  return matched.map((row) => ({
    id: row.id,
    origin: row.origin,
    host: row.host,
    username: row.username,
    title: row.title,
    lastUsedAt: row.lastUsedAt
  }));
}

export function getSavedPasswordRowById(profileId: string, id: string): SavedPasswordRow | null {
  const db = getDb();
  return (
    db
      .select()
      .from(savedPasswords)
      .where(and(eq(savedPasswords.profileId, profileId), eq(savedPasswords.id, id)))
      .get() ?? null
  );
}

export function decryptSavedPasswordRow(row: SavedPasswordRow): string {
  return decryptPasswordSecret(row.encryptedPassword);
}

export function findExactCredential(profileId: string, pageUrl: string, username: string): SavedPasswordRow | null {
  const origin = normalizeCredentialOrigin(pageUrl);
  if (!origin) return null;

  const db = getDb();
  return (
    db
      .select()
      .from(savedPasswords)
      .where(
        and(
          eq(savedPasswords.profileId, profileId),
          eq(savedPasswords.origin, origin),
          eq(savedPasswords.username, username)
        )
      )
      .get() ?? null
  );
}

export function touchSavedPasswordUsage(profileId: string, id: string): void {
  const db = getDb();
  const row = getSavedPasswordRowById(profileId, id);
  if (!row) return;
  const now = Date.now();
  db.update(savedPasswords)
    .set({ timesUsed: row.timesUsed + 1, lastUsedAt: now })
    .where(and(eq(savedPasswords.profileId, profileId), eq(savedPasswords.id, id)))
    .run();
}

export function saveOrUpdatePassword(profileId: string, input: SavePasswordInput): SavedPasswordSummary {
  const origin = normalizeCredentialOrigin(input.origin);
  if (!origin) {
    throw new Error("Invalid site URL. Expected an http:// or https:// address.");
  }

  const host = extractCredentialHost(origin);
  const username = input.username.trim();
  const now = Date.now();
  const encryptedPassword = encryptPasswordSecret(input.password);
  const db = getDb();

  if (input.id) {
    const existingById = getSavedPasswordRowById(profileId, input.id);
    if (existingById) {
      const updated = db
        .update(savedPasswords)
        .set({
          origin,
          host,
          actionUrl: input.actionUrl ?? existingById.actionUrl,
          username,
          encryptedPassword,
          title: input.title !== undefined ? input.title : existingById.title,
          note: input.note !== undefined ? input.note : existingById.note,
          updatedAt: now
        })
        .where(and(eq(savedPasswords.profileId, profileId), eq(savedPasswords.id, input.id)))
        .returning()
        .get();
      if (updated) return toSummary(updated);
    }
  }

  const existing = db
    .select()
    .from(savedPasswords)
    .where(
      and(
        eq(savedPasswords.profileId, profileId),
        eq(savedPasswords.origin, origin),
        eq(savedPasswords.username, username)
      )
    )
    .get();

  if (existing) {
    const updated = db
      .update(savedPasswords)
      .set({
        encryptedPassword,
        actionUrl: input.actionUrl ?? existing.actionUrl,
        title: input.title !== undefined ? input.title : existing.title,
        note: input.note !== undefined ? input.note : existing.note,
        updatedAt: now
      })
      .where(eq(savedPasswords.id, existing.id))
      .returning()
      .get();
    return toSummary(updated!);
  }

  const inserted = db
    .insert(savedPasswords)
    .values({
      id: crypto.randomUUID(),
      profileId,
      origin,
      host,
      actionUrl: input.actionUrl ?? null,
      username,
      encryptedPassword,
      title: input.title ?? null,
      note: input.note ?? null,
      timesUsed: 0,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null
    })
    .returning()
    .get();

  return toSummary(inserted!);
}

export function deleteSavedPassword(profileId: string, id: string): boolean {
  const db = getDb();
  const info = db
    .delete(savedPasswords)
    .where(and(eq(savedPasswords.profileId, profileId), eq(savedPasswords.id, id)))
    .run();
  return info.changes > 0;
}

export function importCredentialsBatch(
  profileId: string,
  records: CredentialImportRecord[],
  options: { overwriteExisting?: boolean } = {}
): { imported: number; updated: number; skipped: number } {
  const db = getDb();
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const now = Date.now();

  db.transaction(() => {
    for (const rec of records) {
      const origin = normalizeCredentialOrigin(rec.originUrl);
      if (!origin || !rec.password) {
        skipped++;
        continue;
      }
      const host = extractCredentialHost(origin);
      const username = rec.username.trim();
      if (!host) {
        skipped++;
        continue;
      }

      const existing = db
        .select()
        .from(savedPasswords)
        .where(
          and(
            eq(savedPasswords.profileId, profileId),
            eq(savedPasswords.origin, origin),
            eq(savedPasswords.username, username)
          )
        )
        .get();

      if (existing) {
        if (!options.overwriteExisting) {
          skipped++;
          continue;
        }
        db.update(savedPasswords)
          .set({
            encryptedPassword: encryptPasswordSecret(rec.password),
            title: rec.title ?? existing.title,
            note: rec.note ?? existing.note,
            actionUrl: rec.actionUrl ?? existing.actionUrl,
            updatedAt: now
          })
          .where(eq(savedPasswords.id, existing.id))
          .run();
        updated++;
        continue;
      }

      db.insert(savedPasswords)
        .values({
          id: crypto.randomUUID(),
          profileId,
          origin,
          host,
          actionUrl: rec.actionUrl ?? null,
          username,
          encryptedPassword: encryptPasswordSecret(rec.password),
          title: rec.title ?? null,
          note: rec.note ?? null,
          timesUsed: 0,
          createdAt: rec.createdAt && rec.createdAt > 0 ? rec.createdAt : now,
          updatedAt: now,
          lastUsedAt: rec.lastUsedAt ?? null
        })
        .run();
      imported++;
    }
  });

  return { imported, updated, skipped };
}

export function exportDecryptedCredentialsForProfile(profileId: string) {
  const db = getDb();
  const rows = db
    .select()
    .from(savedPasswords)
    .where(eq(savedPasswords.profileId, profileId))
    .orderBy(desc(savedPasswords.updatedAt))
    .all();

  return rows.map((row) => ({
    title: row.title || row.host,
    url: row.origin,
    username: row.username,
    password: decryptPasswordSecret(row.encryptedPassword),
    note: row.note
  }));
}

// --- Never-Save Sites ---

export function isSiteNeverSaved(profileId: string, pageUrl: string): boolean {
  const host = extractCredentialHost(pageUrl);
  if (!host) return false;

  const db = getDb();
  const row = db
    .select({ id: passwordNeverSaveSites.id })
    .from(passwordNeverSaveSites)
    .where(and(eq(passwordNeverSaveSites.profileId, profileId), eq(passwordNeverSaveSites.host, host)))
    .get();
  return Boolean(row);
}

export function addNeverSaveSite(profileId: string, pageUrl: string): void {
  const host = extractCredentialHost(pageUrl);
  if (!host) return;

  const db = getDb();
  db.insert(passwordNeverSaveSites)
    .values({
      id: crypto.randomUUID(),
      profileId,
      host,
      createdAt: Date.now()
    })
    .onConflictDoNothing()
    .run();
}

export function listNeverSaveSites(profileId: string): NeverSaveSiteEntry[] {
  const db = getDb();
  const rows = db
    .select()
    .from(passwordNeverSaveSites)
    .where(eq(passwordNeverSaveSites.profileId, profileId))
    .orderBy(desc(passwordNeverSaveSites.createdAt))
    .all();
  return rows.map(toNeverSaveEntry);
}

export function removeNeverSaveSite(profileId: string, id: string): boolean {
  const db = getDb();
  const info = db
    .delete(passwordNeverSaveSites)
    .where(and(eq(passwordNeverSaveSites.profileId, profileId), eq(passwordNeverSaveSites.id, id)))
    .run();
  return info.changes > 0;
}
