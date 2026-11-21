import { getDomain } from "tldts";

/**
 * Normalizes a web URL into its HTTP(S) origin (`https://example.com` or `https://example.com:8443`).
 * Returns null for internal/unsupported schemes such as `lumi:`, `about:`, or `file:`.
 */
export function normalizeCredentialOrigin(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.hostname) return null;
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function extractCredentialHost(rawUrlOrHost: string): string {
  const trimmed = rawUrlOrHost.trim().toLowerCase();
  if (!trimmed) return "";

  const origin = normalizeCredentialOrigin(trimmed);
  if (origin) {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  return trimmed.replace(/^\.+/, "").split("/")[0]?.split(":")[0] ?? "";
}

export function getRegistrableDomain(host: string): string {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return "";
  return getDomain(normalized) ?? normalized;
}

export function doHostsMatchForAutofill(entryHost: string, pageHost: string): boolean {
  const a = entryHost.trim().toLowerCase();
  const b = pageHost.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.endsWith(`.${b}`) || b.endsWith(`.${a}`)) return true;
  const regA = getDomain(a);
  const regB = getDomain(b);
  return Boolean(regA && regB && regA === regB);
}
