import type { TabData } from "~/types/tabs";

const KNOWN_MAIL_CHAT_HOSTS = [
  "mail.google.com",
  "outlook.live.com",
  "outlook.office.com",
  "outlook.office365.com",
  "mail.proton.me",
  "mail.yahoo.com",
  "app.fastmail.com",
  "mail.icloud.com",
  "app.slack.com",
  "discord.com",
  "web.whatsapp.com",
  "web.telegram.org",
  "teams.microsoft.com",
  "messages.google.com",
  "messenger.com",
  "chat.google.com"
];

const KNOWN_MAIL_CHAT_TITLE_SUFFIX_RE =
  /[-–|—]\s*(?:Gmail|Google Mail|Outlook|Proton\s?Mail|Proton|Fastmail|Yahoo Mail|Zoho Mail|iCloud Mail|Roundcube|Slack|Discord)\s*$/i;

const LEADING_COUNT_RE = /^\s*(?:[•●*·]\s*)?[([{\uFF08]\s*(\d{1,5}(?:[,\s.\u00a0]\d{3})*)\s*[)\]}\uFF09]\s*(?=\S|$)/;
const FOLDER_COUNT_RE = /[([{\uFF08]\s*(\d{1,5}(?:[,\s.\u00a0]\d{3})*)\s*[)\]}\uFF09]\s*[-–|—]/;
const EXPLICIT_LABEL_COUNT_RE =
  /\b(?:inbox|unread|messages|notifications|alerts)\s*\(\s*(\d{1,5}(?:[,\s.\u00a0]\d{3})*)\s*\)/i;

function parseCountToken(raw: string): number | null {
  const digits = raw.replace(/[,\s.\u00a0]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 99999) {
    return null;
  }
  return parsed;
}

function isKnownMailOrChatSite(urlString: string, title: string): boolean {
  if (KNOWN_MAIL_CHAT_TITLE_SUFFIX_RE.test(title)) {
    return true;
  }
  if (!urlString) return false;
  try {
    const hostname = new URL(urlString).hostname.toLowerCase();
    return (
      KNOWN_MAIL_CHAT_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`)) ||
      hostname.startsWith("mail.")
    );
  } catch {
    return false;
  }
}

/**
 * Extracts an unread/notification badge count from a tab's App Badging API value
 * or page title (e.g. `Inbox (1) - user@gmail.com - Gmail`, `(3) Slack`, `(2) WhatsApp`).
 */
export function getTabUnreadCount(
  tab: Pick<TabData, "title" | "url" | "badgeCount"> | null | undefined,
  fallbackUrl?: string
): number | null {
  if (!tab) return null;

  if (typeof tab.badgeCount === "number" && Number.isFinite(tab.badgeCount) && tab.badgeCount > 0) {
    return Math.min(99999, Math.floor(tab.badgeCount));
  }

  const title = tab.title?.trim();
  if (!title) return null;

  const url = tab.url || fallbackUrl || "";
  const isMailOrChat = isKnownMailOrChatSite(url, title);

  const leadingMatch = LEADING_COUNT_RE.exec(title);
  if (leadingMatch?.[1]) {
    const count = parseCountToken(leadingMatch[1]);
    if (count !== null && (isMailOrChat || count < 1900 || count > 2100)) {
      return count;
    }
  }

  if (isMailOrChat) {
    const folderMatch = FOLDER_COUNT_RE.exec(title);
    if (folderMatch?.[1]) {
      const count = parseCountToken(folderMatch[1]);
      if (count !== null) {
        return count;
      }
    }
  }

  const explicitMatch = EXPLICIT_LABEL_COUNT_RE.exec(title);
  if (explicitMatch?.[1]) {
    return parseCountToken(explicitMatch[1]);
  }

  return null;
}

export function formatUnreadCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
