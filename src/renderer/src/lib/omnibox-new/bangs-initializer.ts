export type BangEntry = {
  /** category */
  c?: string;
  /** subcategory */
  sc?: string;
  /** domain */
  d: string;
  /** relevance */
  r: number;
  /** display name / site name */
  s: string;
  /** bang trigger text */
  t: string;
  /** search url template, with {{{s}}} replaced with the search query */
  u: string;
};

let bangs: BangEntry[] | undefined;
let bangByTrigger: Map<string, BangEntry> | undefined;
let bangsPromise: Promise<BangEntry[]> | undefined;

async function preloadBangs(): Promise<BangEntry[]> {
  if (bangs) return bangs;
  const bangsModule = (await import("./bangs")) as unknown as { bangs: BangEntry[] };
  bangs = bangsModule.bangs;
  const map = new Map<string, BangEntry>();
  for (const entry of bangs) {
    const key = entry.t.toLowerCase();
    if (!map.has(key)) {
      map.set(key, entry);
    }
  }
  bangByTrigger = map;
  return bangs;
}

export function isBangsLoaded(): boolean {
  return bangs !== undefined;
}

export async function waitForBangsLoad(): Promise<BangEntry[]> {
  if (bangs) return bangs;
  if (!bangsPromise) {
    bangsPromise = preloadBangs().finally(() => {
      bangsPromise = undefined;
    });
  }
  return await bangsPromise;
}

export function getBangs(): BangEntry[] {
  return bangs ?? [];
}

/** O(1) lookup for a loaded bang trigger; returns null until bangs are loaded on demand. */
export function getBangByTrigger(trigger: string): BangEntry | null {
  if (!bangByTrigger) return null;
  return bangByTrigger.get(trigger.toLowerCase()) ?? null;
}
