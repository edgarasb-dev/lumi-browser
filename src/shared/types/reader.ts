export type ReaderTheme = "light" | "sepia" | "dark";
export type ReaderFontFamily = "serif" | "sans" | "mono";

export type ReaderPreferences = {
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSize: number; // px, 14–28
  lineHeight: number; // unitless, 1.4–2.1
  maxWidth: number; // px, 560–880
};

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  theme: "light",
  fontFamily: "serif",
  fontSize: 18,
  lineHeight: 1.75,
  maxWidth: 680
};

export type ReaderArticle = {
  url: string;
  title: string;
  byline: string | null;
  siteName: string | null;
  publishedTime: string | null;
  excerpt: string | null;
  contentHtml: string;
  wordCount: number;
  readingTimeMinutes: number;
  extractedAt: number;
};

export type ReaderExtractionResult =
  | {
      ok: true;
      article: ReaderArticle;
    }
  | {
      ok: false;
      reason: string;
    };

export type ReaderTabState = {
  tabId: number;
  active: boolean;
  article: ReaderArticle | null;
  error?: string;
};
