import type { WebContents } from "electron";
import type { ReaderArticle, ReaderExtractionResult } from "~/types/reader";

/**
 * Self-contained DOM extractor executed inside the target page's WebContents
 * without mutating the live page DOM. Scores candidate containers using
 * Readability-style paragraph density and link-density heuristics, then
 * serializes an allowlisted, sanitized HTML subtree with absolute URLs.
 */
const READER_EXTRACT_SCRIPT = `
(() => {
  try {
    if (!document || !document.body) {
      return { ok: false, reason: "Document is empty" };
    }

    const EXCLUDE_PATTERN = /comment|meta|footer|footnote|sidebar|sidenav|nav|menu|breadcrumb|related|recommend|share|social|newsletter|subscribe|promo|advert|ad-|ads-|banner|cookie|popup|modal|widget|toolbar|pager|pagination/i;
    const POSITIVE_PATTERN = /article|body|content|entry|main|page|post|text|blog|story|prose|markdown/i;

    const ALLOWED_TAGS = new Set([
      "P", "H1", "H2", "H3", "H4", "H5", "H6",
      "BLOCKQUOTE", "PRE", "CODE", "UL", "OL", "LI",
      "FIGURE", "FIGCAPTION", "IMG", "PICTURE", "A",
      "STRONG", "B", "EM", "I", "U", "S", "DEL", "MARK",
      "SUP", "SUB", "HR", "BR",
      "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
      "DL", "DT", "DD", "SECTION", "DIV"
    ]);

    const STRIP_SUBTREE_TAGS = new Set([
      "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "OBJECT", "EMBED",
      "FORM", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SVG", "CANVAS",
      "NAV", "ASIDE", "FOOTER"
    ]);

    const getTextLen = (el) => ((el.textContent || "").replace(/\\s+/g, " ").trim()).length;

    const getLinkDensity = (el) => {
      const totalLen = getTextLen(el);
      if (totalLen === 0) return 0;
      let linkLen = 0;
      const links = el.querySelectorAll("a");
      for (let i = 0; i < links.length; i++) {
        linkLen += getTextLen(links[i]);
      }
      return linkLen / totalLen;
    };

    const isLikelyUnwanted = (el) => {
      if (!el || el.nodeType !== 1) return false;
      const tag = el.tagName;
      if (STRIP_SUBTREE_TAGS.has(tag)) return true;
      if (el.getAttribute("aria-hidden") === "true") return true;
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (role === "navigation" || role === "complementary" || role === "banner" || role === "dialog" || role === "contentinfo") {
        return true;
      }
      const clsId = (typeof el.className === "string" ? el.className : "") + " " + (el.id || "");
      if (EXCLUDE_PATTERN.test(clsId) && !POSITIVE_PATTERN.test(clsId)) {
        // Avoid accidentally stripping the outer root if it holds most of the page
        if (tag !== "BODY" && tag !== "MAIN" && tag !== "ARTICLE") {
          return true;
        }
      }
      return false;
    };

    const scoreElement = (el) => {
      let score = 0;
      const tag = el.tagName;
      if (tag === "ARTICLE") score += 45;
      else if (tag === "MAIN") score += 35;
      else if (el.getAttribute("role") === "main") score += 32;
      else if (tag === "SECTION") score += 8;

      const clsId = (typeof el.className === "string" ? el.className : "") + " " + (el.id || "");
      if (POSITIVE_PATTERN.test(clsId)) score += 25;
      if (EXCLUDE_PATTERN.test(clsId)) score -= 30;

      const paragraphs = el.querySelectorAll("p, pre, blockquote");
      let textScore = 0;
      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        if (isLikelyUnwanted(p.parentElement)) continue;
        const len = getTextLen(p);
        if (len < 25) continue;
        const commas = ((p.textContent || "").match(/[,.;:]/g) || []).length;
        textScore += Math.min(len / 40, 8) + Math.min(commas, 6);
      }

      if (textScore === 0) {
        textScore = Math.min(getTextLen(el) / 100, 12);
      }

      score += textScore;
      const linkDensity = getLinkDensity(el);
      score *= Math.max(0.1, 1 - Math.min(linkDensity, 0.85));
      return score;
    };

    const candidateSet = new Set();
    const preferred = document.querySelectorAll("article, main, [role='main'], .post-content, .article-body, .article-content, .entry-content, .story-body, .prose, section");
    for (let i = 0; i < preferred.length; i++) {
      candidateSet.add(preferred[i]);
    }
    const paragraphs = document.querySelectorAll("p");
    for (let i = 0; i < paragraphs.length; i++) {
      const parent = paragraphs[i].parentElement;
      if (parent && parent.tagName !== "BODY" && parent.tagName !== "HTML") {
        candidateSet.add(parent);
        if (parent.parentElement && parent.parentElement.tagName !== "BODY" && parent.parentElement.tagName !== "HTML") {
          candidateSet.add(parent.parentElement);
        }
      }
    }

    let bestEl = document.body;
    let bestScore = -1;

    candidateSet.forEach((el) => {
      if (isLikelyUnwanted(el)) return;
      if (getTextLen(el) < 120) return;
      const s = scoreElement(el);
      if (s > bestScore) {
        bestScore = s;
        bestEl = el;
      }
    });

    const resolveUrl = (raw) => {
      if (!raw) return null;
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("vbscript:")) return null;
      if (trimmed.startsWith("data:image/")) return trimmed;
      try {
        const resolved = new URL(trimmed, document.baseURI);
        if (resolved.protocol === "http:" || resolved.protocol === "https:") {
          return resolved.href;
        }
      } catch {
        return null;
      }
      return null;
    };

    const escapeAttr = (val) =>
      String(val)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const escapeText = (val) =>
      String(val)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const sanitizeNode = (node) => {
      if (node.nodeType === 3) {
        return escapeText(node.textContent || "");
      }
      if (node.nodeType !== 1) return "";
      const el = node;
      if (isLikelyUnwanted(el)) return "";

      const tag = el.tagName;
      if (tag === "HEADER" && el.querySelectorAll("nav, input, form").length > 0) {
        return "";
      }

      let childrenHtml = "";
      for (let i = 0; i < el.childNodes.length; i++) {
        childrenHtml += sanitizeNode(el.childNodes[i]);
      }

      if (!ALLOWED_TAGS.has(tag)) {
        return childrenHtml;
      }

      const lower = tag.toLowerCase();
      if (lower === "br" || lower === "hr") {
        return "<" + lower + ">";
      }

      if (lower === "img") {
        const src = resolveUrl(
          el.getAttribute("src") ||
          el.getAttribute("data-src") ||
          el.getAttribute("data-lazy-src") ||
          el.getAttribute("data-original")
        );
        if (!src) return "";
        const alt = escapeAttr((el.getAttribute("alt") || "").trim());
        const widthAttr = Number(el.getAttribute("width") || 0);
        const heightAttr = Number(el.getAttribute("height") || 0);
        if ((widthAttr > 0 && widthAttr < 32) || (heightAttr > 0 && heightAttr < 32)) {
          return "";
        }
        return '<img src="' + escapeAttr(src) + '" alt="' + alt + '" loading="lazy">';
      }

      if (lower === "picture") {
        const innerImg = el.querySelector("img");
        if (innerImg) return sanitizeNode(innerImg);
        return childrenHtml;
      }

      if (lower === "a") {
        const rawHref = el.getAttribute("href") || "";
        if (rawHref.startsWith("#")) {
          return childrenHtml;
        }
        const href = resolveUrl(rawHref);
        if (!href) return childrenHtml;
        return '<a href="' + escapeAttr(href) + '" target="_blank" rel="noopener noreferrer">' + childrenHtml + "</a>";
      }

      if (!childrenHtml.trim() && lower !== "td" && lower !== "th") {
        return "";
      }

      if (lower === "th" || lower === "td") {
        const attrs = [];
        const colspan = parseInt(el.getAttribute("colspan") || "", 10);
        const rowspan = parseInt(el.getAttribute("rowspan") || "", 10);
        if (colspan > 1 && colspan <= 12) attrs.push('colspan="' + colspan + '"');
        if (rowspan > 1 && rowspan <= 12) attrs.push('rowspan="' + rowspan + '"');
        const attrStr = attrs.length ? " " + attrs.join(" ") : "";
        return "<" + lower + attrStr + ">" + childrenHtml + "</" + lower + ">";
      }

      // Drop redundant wrappers when they duplicate simple divs
      if (lower === "div" || lower === "section") {
        return "<" + lower + ">" + childrenHtml + "</" + lower + ">";
      }

      return "<" + lower + ">" + childrenHtml + "</" + lower + ">";
    };

    const metaContent = (selectors) => {
      for (let i = 0; i < selectors.length; i++) {
        const m = document.querySelector(selectors[i]);
        if (m) {
          const val = (m.getAttribute("content") || m.textContent || "").trim();
          if (val) return val;
        }
      }
      return null;
    };

    const titleEl = bestEl.querySelector("h1") || document.querySelector("h1");
    const rawTitle =
      metaContent(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
      (titleEl ? (titleEl.textContent || "").trim() : "") ||
      document.title ||
      location.hostname;

    const byline = metaContent([
      'meta[name="author"]',
      'meta[property="article:author"]',
      '[rel="author"]',
      ".byline",
      ".author-name",
      ".post-author"
    ]);

    const siteName =
      metaContent(['meta[property="og:site_name"]', 'meta[name="application-name"]']) ||
      location.hostname.replace(/^www\\./, "");

    const timeEl = bestEl.querySelector("time[datetime]") || document.querySelector("time[datetime]");
    const publishedTime =
      metaContent(['meta[property="article:published_time"]', 'meta[name="pubdate"]']) ||
      (timeEl ? (timeEl.textContent || timeEl.getAttribute("datetime") || "").trim() : null);

    const excerpt = metaContent([
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]'
    ]);

    const contentHtml = sanitizeNode(bestEl);

    const tmpDiv = document.createElement("div");
    tmpDiv.innerHTML = contentHtml;
    const plainText = (tmpDiv.textContent || "").replace(/\\s+/g, " ").trim();

    if (plainText.length < 80) {
      return { ok: false, reason: "Not enough readable article text on this page" };
    }

    const words = plainText.split(/\\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.round(words / 225));

    return {
      ok: true,
      article: {
        url: location.href,
        title: rawTitle,
        byline: byline && byline.length <= 120 ? byline : null,
        siteName,
        publishedTime: publishedTime && publishedTime.length <= 80 ? publishedTime : null,
        excerpt: excerpt && excerpt.length <= 400 ? excerpt : null,
        contentHtml,
        wordCount: words,
        readingTimeMinutes,
        extractedAt: Date.now()
      }
    };
  } catch (err) {
    return { ok: false, reason: err && err.message ? String(err.message) : "Failed to extract article" };
  }
})();
`;

export function isReaderEligibleUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export async function extractReaderArticle(webContents: WebContents): Promise<ReaderExtractionResult> {
  if (webContents.isDestroyed()) {
    return { ok: false, reason: "Tab is closed" };
  }

  const currentUrl = webContents.getURL();
  if (!isReaderEligibleUrl(currentUrl)) {
    return { ok: false, reason: "Reader Mode is only available on web pages" };
  }

  try {
    const result = (await webContents.executeJavaScript(READER_EXTRACT_SCRIPT, true)) as ReaderExtractionResult | null;
    if (!result || typeof result !== "object") {
      return { ok: false, reason: "Unable to read page content" };
    }
    if (!result.ok) {
      return result;
    }

    const article: ReaderArticle = result.article;
    return { ok: true, article };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Failed to extract article"
    };
  }
}
