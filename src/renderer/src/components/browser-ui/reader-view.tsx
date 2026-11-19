import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Check, Copy, Minus, Plus, Type, X, AlignJustify, MoveHorizontal, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabData } from "~/types/tabs";
import {
  DEFAULT_READER_PREFERENCES,
  type ReaderArticle,
  type ReaderFontFamily,
  type ReaderPreferences,
  type ReaderTheme
} from "~/types/reader";

const ALLOWED_RENDERER_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  "ul",
  "ol",
  "li",
  "figure",
  "figcaption",
  "img",
  "a",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "sup",
  "sub",
  "hr",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "dl",
  "dt",
  "dd",
  "section",
  "div"
]);

function isSafeHttpOrImageUrl(value: string, allowDataImage: boolean): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (allowDataImage && trimmed.startsWith("data:image/")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Second-pass client-side sanitizer via DOMParser so no untrusted markup
 * or event handler attributes ever reach the Reader surface.
 */
function sanitizeHtmlForRenderer(rawHtml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");

  const sanitizeElement = (el: Element): void => {
    const children = Array.from(el.children);
    for (const child of children) {
      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_RENDERER_TAGS.has(tag)) {
        const frag = doc.createDocumentFragment();
        while (child.firstChild) {
          frag.appendChild(child.firstChild);
        }
        child.replaceWith(frag);
        continue;
      }

      const attrs = Array.from(child.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        if (tag === "a" && (name === "href" || name === "target" || name === "rel")) {
          if (name === "href" && !isSafeHttpOrImageUrl(attr.value, false)) {
            child.removeAttribute(attr.name);
          }
          continue;
        }
        if (tag === "img" && (name === "src" || name === "alt" || name === "loading")) {
          if (name === "src" && !isSafeHttpOrImageUrl(attr.value, true)) {
            child.remove();
            break;
          }
          continue;
        }
        if ((tag === "td" || tag === "th") && (name === "colspan" || name === "rowspan")) {
          continue;
        }
        child.removeAttribute(attr.name);
      }

      if (tag === "a") {
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener noreferrer");
      }

      if (child.parentNode) {
        sanitizeElement(child);
      }
    }
  };

  sanitizeElement(doc.body);
  return doc.body.innerHTML;
}

const THEME_CLASSES: Record<
  ReaderTheme,
  {
    surface: string;
    toolbar: string;
    muted: string;
    link: string;
    border: string;
    blockquote: string;
    codeBg: string;
  }
> = {
  light: {
    surface: "bg-[#fafaf9] text-[#1c1917]",
    toolbar: "bg-white/90 text-[#1c1917] border-black/10 shadow-sm",
    muted: "text-[#57534e]",
    link: "[&_a]:text-sky-700 [&_a]:underline [&_a]:underline-offset-2",
    border: "border-black/10",
    blockquote: "[&_blockquote]:border-l-stone-300 [&_blockquote]:text-[#44403c]",
    codeBg: "[&_pre]:bg-stone-100 [&_code]:bg-stone-100"
  },
  sepia: {
    surface: "bg-[#f4ecd8] text-[#3d3020]",
    toolbar: "bg-[#ebe0c6]/95 text-[#3d3020] border-[#8c734b]/20 shadow-sm",
    muted: "text-[#6b5638]",
    link: "[&_a]:text-[#8b4513] [&_a]:underline [&_a]:underline-offset-2",
    border: "border-[#8c734b]/20",
    blockquote: "[&_blockquote]:border-l-[#b79a6b] [&_blockquote]:text-[#54422a]",
    codeBg: "[&_pre]:bg-[#e8dcc0] [&_code]:bg-[#e8dcc0]"
  },
  dark: {
    surface: "bg-[#141518] text-[#e7e5e4]",
    toolbar: "bg-[#1f2126]/90 text-[#e7e5e4] border-white/10 shadow-lg",
    muted: "text-[#a8a29e]",
    link: "[&_a]:text-sky-400 [&_a]:underline [&_a]:underline-offset-2",
    border: "border-white/10",
    blockquote: "[&_blockquote]:border-l-white/25 [&_blockquote]:text-[#d6d3d1]",
    codeBg: "[&_pre]:bg-white/10 [&_code]:bg-white/10"
  }
};

const FONT_STACKS: Record<ReaderFontFamily, string> = {
  serif: 'Georgia, "Iowan Old Style", "New York", "Times New Roman", serif',
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif',
  mono: '"SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace'
};

interface ReaderViewProps {
  tab: TabData;
  style?: CSSProperties;
  className?: string;
}

export function ReaderView({ tab, style, className }: ReaderViewProps) {
  const [article, setArticle] = useState<ReaderArticle | null>(null);
  const [preferences, setPreferences] = useState<ReaderPreferences>(DEFAULT_READER_PREFERENCES);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    lumi.reader.getArticle(tab.id).then((loaded) => {
      if (active && loaded) setArticle(loaded);
    });
    lumi.reader.getPreferences().then((prefs) => {
      if (active) setPreferences(prefs);
    });

    const unsubState = lumi.reader.onStateChanged((state) => {
      if (state.tabId === tab.id && state.article) {
        setArticle(state.article);
      }
    });
    const unsubPrefs = lumi.reader.onPreferencesChanged((prefs) => {
      setPreferences(prefs);
    });

    return () => {
      active = false;
      unsubState();
      unsubPrefs();
    };
  }, [tab.id, tab.url]);

  const rawContentHtml = article?.contentHtml;
  const sanitizedHtml = useMemo(() => {
    if (!rawContentHtml) return "";
    return sanitizeHtmlForRenderer(rawContentHtml);
  }, [rawContentHtml]);

  const updatePref = useCallback((updates: Partial<ReaderPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
    void lumi.reader.updatePreferences(updates);
  }, []);

  const cycleLineHeight = useCallback(() => {
    const next = preferences.lineHeight < 1.6 ? 1.75 : preferences.lineHeight < 1.9 ? 2.0 : 1.5;
    updatePref({ lineHeight: next });
  }, [preferences.lineHeight, updatePref]);

  const cycleMaxWidth = useCallback(() => {
    const next = preferences.maxWidth < 640 ? 680 : preferences.maxWidth < 760 ? 800 : 580;
    updatePref({ maxWidth: next });
  }, [preferences.maxWidth, updatePref]);

  const handleCopyText = useCallback(async () => {
    if (!article) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = sanitizedHtml;
    const text = `${article.title}\n\n${(tmp.textContent || "").trim()}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [article, sanitizedHtml]);

  const themeStyle = THEME_CLASSES[preferences.theme];

  return (
    <div
      style={style}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          void lumi.reader.disable(tab.id);
        }
      }}
      tabIndex={-1}
      className={cn(
        "rounded-md overflow-hidden flex flex-col outline-none select-text z-elevated",
        themeStyle.surface,
        className
      )}
    >
      {/* Floating Reader Controls Header */}
      <div className="shrink-0 flex justify-center px-4 pt-3 pb-2">
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md text-xs select-none",
            themeStyle.toolbar
          )}
        >
          {/* Themes */}
          <div className="flex items-center gap-1 pr-1.5 border-r border-current/15">
            {(
              [
                { id: "light", bg: "bg-[#fafaf9] border-stone-300", label: "Light" },
                { id: "sepia", bg: "bg-[#f4ecd8] border-[#c2ad88]", label: "Sepia" },
                { id: "dark", bg: "bg-[#141518] border-white/30", label: "Dark" }
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => updatePref({ theme: t.id })}
                title={`${t.label} theme`}
                className={cn(
                  "size-4.5 rounded-full border transition-transform cursor-pointer",
                  t.bg,
                  preferences.theme === t.id ? "ring-2 ring-sky-500 scale-110" : "opacity-80 hover:opacity-100"
                )}
              />
            ))}
          </div>

          {/* Font family */}
          <div className="flex items-center gap-0.5 pr-1.5 border-r border-current/15">
            <Type className="size-3.5 opacity-60 mr-1" />
            {(["serif", "sans", "mono"] as const).map((font) => (
              <button
                key={font}
                type="button"
                onClick={() => updatePref({ fontFamily: font })}
                className={cn(
                  "px-2 py-0.5 rounded-full capitalize cursor-pointer transition-colors",
                  preferences.fontFamily === font
                    ? "bg-sky-500/20 text-sky-600 dark:text-sky-300 font-medium"
                    : "hover:bg-current/10 opacity-75"
                )}
              >
                {font}
              </button>
            ))}
          </div>

          {/* Font size */}
          <div className="flex items-center gap-0.5 pr-1.5 border-r border-current/15">
            <button
              type="button"
              onClick={() => updatePref({ fontSize: Math.max(14, preferences.fontSize - 1) })}
              title="Decrease font size"
              className="p-1 rounded-full hover:bg-current/10 cursor-pointer"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-7 text-center tabular-nums font-medium">{preferences.fontSize}</span>
            <button
              type="button"
              onClick={() => updatePref({ fontSize: Math.min(28, preferences.fontSize + 1) })}
              title="Increase font size"
              className="p-1 rounded-full hover:bg-current/10 cursor-pointer"
            >
              <Plus className="size-3" />
            </button>
          </div>

          {/* Line height & column width */}
          <button
            type="button"
            onClick={cycleLineHeight}
            title={`Line spacing (${preferences.lineHeight}x)`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full hover:bg-current/10 cursor-pointer opacity-80 hover:opacity-100"
          >
            <AlignJustify className="size-3" />
            <span className="tabular-nums">{preferences.lineHeight.toFixed(1)}</span>
          </button>

          <button
            type="button"
            onClick={cycleMaxWidth}
            title={`Column width (${preferences.maxWidth}px)`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full hover:bg-current/10 cursor-pointer opacity-80 hover:opacity-100"
          >
            <MoveHorizontal className="size-3" />
            <span className="tabular-nums">{preferences.maxWidth}px</span>
          </button>

          {/* Copy text */}
          <button
            type="button"
            onClick={() => void handleCopyText()}
            title="Copy article text"
            className="p-1 rounded-full hover:bg-current/10 cursor-pointer opacity-80 hover:opacity-100"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          </button>

          {/* Exit */}
          <button
            type="button"
            onClick={() => void lumi.reader.disable(tab.id)}
            title="Exit Reader Mode (Cmd+Option+R)"
            className="flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full bg-current/10 hover:bg-current/20 font-medium cursor-pointer"
          >
            <X className="size-3" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Article Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-16 pt-4">
        {!article ? (
          <div className={cn("h-full flex flex-col items-center justify-center gap-2 text-sm", themeStyle.muted)}>
            <BookOpen className="size-7 opacity-40" />
            <p>Preparing clean reading view…</p>
          </div>
        ) : (
          <article
            style={{
              maxWidth: `${preferences.maxWidth}px`,
              fontFamily: FONT_STACKS[preferences.fontFamily],
              fontSize: `${preferences.fontSize}px`,
              lineHeight: preferences.lineHeight
            }}
            className="mx-auto"
          >
            {/* Header metadata */}
            <header className={cn("mb-7 pb-5 border-b", themeStyle.border)}>
              {(article.siteName || article.readingTimeMinutes > 0) && (
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider mb-2.5",
                    themeStyle.muted
                  )}
                >
                  {article.siteName && <span className="font-semibold">{article.siteName}</span>}
                  {article.siteName && <span>•</span>}
                  <span>{article.readingTimeMinutes} min read</span>
                  <span>•</span>
                  <span>{article.wordCount.toLocaleString()} words</span>
                </div>
              )}

              <h1 className="text-[1.85em] font-bold leading-[1.2] tracking-tight mb-3">{article.title}</h1>

              {(article.byline || article.publishedTime) && (
                <div className={cn("flex flex-wrap items-center gap-2 text-sm", themeStyle.muted)}>
                  {article.byline && <span>By {article.byline}</span>}
                  {article.byline && article.publishedTime && <span>•</span>}
                  {article.publishedTime && <span>{article.publishedTime}</span>}
                </div>
              )}
            </header>

            {/* Distilled Body */}
            <div
              className={cn(
                "reader-prose space-y-4",
                "[&_h1]:text-[1.5em] [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-3",
                "[&_h2]:text-[1.35em] [&_h2]:font-bold [&_h2]:mt-7 [&_h2]:mb-2.5",
                "[&_h3]:text-[1.15em] [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2",
                "[&_p]:leading-[inherit]",
                "[&_blockquote]:border-l-3 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-5",
                "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5",
                "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1.5",
                "[&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-[0.85em] [&_pre]:my-5",
                "[&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_pre_code]:p-0 [&_pre_code]:bg-transparent",
                "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-5 [&_img]:mx-auto",
                "[&_figure]:my-6 [&_figcaption]:text-center [&_figcaption]:text-[0.85em] [&_figcaption]:opacity-75 [&_figcaption]:mt-2",
                "[&_hr]:my-7 [&_hr]:border-current/15",
                "[&_table]:w-full [&_table]:border-collapse [&_table]:my-5 [&_th]:text-left [&_th]:p-2 [&_td]:p-2 [&_th]:border-b [&_td]:border-b [&_th]:border-current/20 [&_td]:border-current/10",
                themeStyle.link,
                themeStyle.blockquote,
                themeStyle.codeBg
              )}
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          </article>
        )}
      </div>
    </div>
  );
}
