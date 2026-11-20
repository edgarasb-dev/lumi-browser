export interface StudioWallpaper {
  id: string;
  name: string;
  description: string;
  swatch: string;
  lightBackground: string;
  darkBackground: string;
}

export interface NewTabWidgetPrefs {
  clock: boolean;
  quickLinks: boolean;
  recentlyClosed: boolean;
  scratchpad: boolean;
}

export const DEFAULT_WIDGET_PREFS: NewTabWidgetPrefs = {
  clock: true,
  quickLinks: true,
  recentlyClosed: true,
  scratchpad: true
};

export const WALLPAPER_STORAGE_KEY = "lumi.newTab.wallpaper";
export const WIDGETS_STORAGE_KEY = "lumi.newTab.widgets";

export const STUDIO_WALLPAPERS: StudioWallpaper[] = [
  {
    id: "space-adaptive",
    name: "Space Ambient",
    description: "Mirrors your active Space colors",
    swatch: "linear-gradient(135deg, #3b82f6 0%, #818cf8 100%)",
    lightBackground:
      "radial-gradient(1100px 620px at 15% 0%, rgba(59, 130, 246, 0.18), transparent 62%), radial-gradient(900px 580px at 88% 100%, rgba(99, 102, 241, 0.14), transparent 60%), linear-gradient(180deg, #f6f8fc 0%, #eef2f9 100%)",
    darkBackground:
      "radial-gradient(1100px 620px at 15% 0%, rgba(59, 130, 246, 0.24), transparent 62%), radial-gradient(900px 580px at 88% 100%, rgba(99, 102, 241, 0.2), transparent 60%), linear-gradient(180deg, #0b101b 0%, #101624 100%)"
  },
  {
    id: "sapphire-mist",
    name: "Sapphire Mist",
    description: "Signature Lumi Sapphire studio gradient",
    swatch: "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)",
    lightBackground:
      "radial-gradient(950px 540px at 20% 10%, rgba(37, 99, 235, 0.16), transparent 60%), radial-gradient(780px 520px at 80% 85%, rgba(14, 165, 233, 0.14), transparent 60%), linear-gradient(180deg, #f5f9ff 0%, #eaf1fb 100%)",
    darkBackground:
      "radial-gradient(950px 540px at 20% 10%, rgba(37, 99, 235, 0.28), transparent 60%), radial-gradient(780px 520px at 80% 85%, rgba(14, 165, 233, 0.18), transparent 60%), linear-gradient(180deg, #090e1a 0%, #0f172a 100%)"
  },
  {
    id: "aurora-glass",
    name: "Northern Aurora",
    description: "Cool teal and emerald atmospheric wash",
    swatch: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
    lightBackground:
      "radial-gradient(900px 520px at 18% 12%, rgba(16, 185, 129, 0.15), transparent 60%), radial-gradient(850px 540px at 82% 88%, rgba(6, 182, 212, 0.16), transparent 60%), linear-gradient(180deg, #f4fbf9 0%, #e9f5f5 100%)",
    darkBackground:
      "radial-gradient(900px 520px at 18% 12%, rgba(16, 185, 129, 0.22), transparent 60%), radial-gradient(850px 540px at 82% 88%, rgba(6, 182, 212, 0.2), transparent 60%), linear-gradient(180deg, #081318 0%, #0c1b22 100%)"
  },
  {
    id: "warm-sand",
    name: "Studio Paper",
    description: "Warm stone and soft alabaster surface",
    swatch: "linear-gradient(135deg, #d6cfc7 0%, #a8a29e 100%)",
    lightBackground:
      "radial-gradient(950px 540px at 50% 0%, rgba(245, 158, 11, 0.08), transparent 62%), linear-gradient(180deg, #faf8f5 0%, #f1ede7 100%)",
    darkBackground:
      "radial-gradient(950px 540px at 50% 0%, rgba(214, 211, 209, 0.08), transparent 62%), linear-gradient(180deg, #151413 0%, #1c1a18 100%)"
  },
  {
    id: "midnight-ink",
    name: "Obsidian Focus",
    description: "Ultra-quiet monochrome backdrop",
    swatch: "linear-gradient(135deg, #1f2937 0%, #09090b 100%)",
    lightBackground: "linear-gradient(180deg, #f7f8fa 0%, #eceef2 100%)",
    darkBackground: "linear-gradient(180deg, #0b0c10 0%, #12141a 100%)"
  }
];

export function loadWallpaperId(): string {
  try {
    const saved = localStorage.getItem(WALLPAPER_STORAGE_KEY);
    if (saved && STUDIO_WALLPAPERS.some((w) => w.id === saved)) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return STUDIO_WALLPAPERS[0].id;
}

export function loadWidgetPrefs(): NewTabWidgetPrefs {
  try {
    const raw = localStorage.getItem(WIDGETS_STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGET_PREFS;
    const parsed = JSON.parse(raw) as Partial<NewTabWidgetPrefs>;
    return {
      clock: typeof parsed.clock === "boolean" ? parsed.clock : DEFAULT_WIDGET_PREFS.clock,
      quickLinks: typeof parsed.quickLinks === "boolean" ? parsed.quickLinks : DEFAULT_WIDGET_PREFS.quickLinks,
      recentlyClosed:
        typeof parsed.recentlyClosed === "boolean" ? parsed.recentlyClosed : DEFAULT_WIDGET_PREFS.recentlyClosed,
      scratchpad: typeof parsed.scratchpad === "boolean" ? parsed.scratchpad : DEFAULT_WIDGET_PREFS.scratchpad
    };
  } catch {
    return DEFAULT_WIDGET_PREFS;
  }
}

export function buildWallpaperStyle(
  wallpaperId: string,
  resolvedTheme: string | undefined,
  spaceColors?: { bgStartColor?: string; bgEndColor?: string }
): string {
  const isDark = resolvedTheme === "dark";
  if (wallpaperId === "space-adaptive" && spaceColors?.bgStartColor && spaceColors?.bgEndColor) {
    const c1 = spaceColors.bgStartColor;
    const c2 = spaceColors.bgEndColor;
    if (isDark) {
      return `radial-gradient(1100px 640px at 18% 4%, ${c1}40, transparent 60%), radial-gradient(960px 600px at 84% 94%, ${c2}35, transparent 60%), linear-gradient(180deg, #0b101b 0%, #101624 100%)`;
    }
    return `radial-gradient(1100px 640px at 18% 4%, ${c1}2b, transparent 60%), radial-gradient(960px 600px at 84% 94%, ${c2}22, transparent 60%), linear-gradient(180deg, #f7f9fc 0%, #edf2fa 100%)`;
  }

  const preset = STUDIO_WALLPAPERS.find((w) => w.id === wallpaperId) ?? STUDIO_WALLPAPERS[0];
  return isDark ? preset.darkBackground : preset.lightBackground;
}
