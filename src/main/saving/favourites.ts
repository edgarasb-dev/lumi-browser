import { getDatastore } from "@/saving/datastore";
import { TypedEventEmitter } from "@/modules/typed-event-emitter";
import { generateID } from "@/modules/utils";

export interface Favourite {
  id: string;
  title: string;
  url: string;
  faviconURL?: string | null;
  createdAt: number;
}

type FavouritesEvents = {
  "favourites-changed": [Favourite[]];
};

export const favouritesEmitter = new TypedEventEmitter<FavouritesEvents>();
const FavouritesDataStore = getDatastore("favourites");

let cachedFavourites: Favourite[] | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

export async function onFavouritesLoaded(): Promise<void> {
  if (cachedFavourites !== null) return;
  if (isLoading && loadPromise) return loadPromise;

  isLoading = true;
  loadPromise = (async () => {
    try {
      const data = await FavouritesDataStore.get<Favourite[]>("list");
      if (Array.isArray(data)) {
        cachedFavourites = data;
      } else {
        cachedFavourites = [];
      }
    } catch {
      cachedFavourites = [];
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

export async function getAllFavourites(): Promise<Favourite[]> {
  await onFavouritesLoaded();
  return cachedFavourites ? [...cachedFavourites] : [];
}

export async function isFavourite(url: string): Promise<boolean> {
  if (!url) return false;
  await onFavouritesLoaded();
  const normalized = normalizeUrl(url);
  return cachedFavourites?.some((f) => normalizeUrl(f.url) === normalized) ?? false;
}

export async function addFavourite(title: string, url: string, faviconURL?: string | null): Promise<Favourite> {
  await onFavouritesLoaded();
  if (!cachedFavourites) cachedFavourites = [];

  const normalized = normalizeUrl(url);
  const existingIndex = cachedFavourites.findIndex((f) => normalizeUrl(f.url) === normalized);

  const fav: Favourite = {
    id: existingIndex >= 0 ? cachedFavourites[existingIndex].id : generateID(),
    title: title.trim() || url,
    url,
    faviconURL: faviconURL || null,
    createdAt: Date.now()
  };

  if (existingIndex >= 0) {
    cachedFavourites[existingIndex] = fav;
  } else {
    cachedFavourites.unshift(fav);
  }

  await FavouritesDataStore.set("list", cachedFavourites);
  favouritesEmitter.emit("favourites-changed", [...cachedFavourites]);
  return fav;
}

export async function removeFavourite(idOrUrl: string): Promise<boolean> {
  await onFavouritesLoaded();
  if (!cachedFavourites) return false;

  const normalized = normalizeUrl(idOrUrl);
  const initialLength = cachedFavourites.length;
  cachedFavourites = cachedFavourites.filter((f) => f.id !== idOrUrl && normalizeUrl(f.url) !== normalized);

  if (cachedFavourites.length !== initialLength) {
    await FavouritesDataStore.set("list", cachedFavourites);
    favouritesEmitter.emit("favourites-changed", [...cachedFavourites]);
    return true;
  }

  return false;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.replace(/\/$/, "").toLowerCase();
  }
}
