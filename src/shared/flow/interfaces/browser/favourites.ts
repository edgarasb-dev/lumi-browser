export interface Favourite {
  id: string;
  title: string;
  url: string;
  faviconURL?: string | null;
  createdAt: number;
}

export interface FlowFavouritesAPI {
  getAllFavourites: () => Promise<Favourite[]>;
  addFavourite: (title: string, url: string, faviconURL?: string | null) => Promise<Favourite>;
  removeFavourite: (idOrUrl: string) => Promise<boolean>;
  isFavourite: (url: string) => Promise<boolean>;
  onFavouritesChanged: (callback: (favourites: Favourite[]) => void) => () => void;
}
