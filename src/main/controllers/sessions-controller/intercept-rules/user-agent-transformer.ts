import { transformUserAgentHeader } from "@/modules/user-agent";
import { createBetterWebRequest } from "@/controllers/sessions-controller/web-requests";
import type { Session } from "electron";
import { generateChromeValidationHeader } from "@/modules/chrome";

function generateBrowserClientHeaders(userAgent: string): Record<string, string> {
  const year = new Date().getFullYear();
  const chromeFullVersion = userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? "146.0.0.0";
  const chromeMajorVersion = chromeFullVersion.split(".")[0] || "146";

  const BROWSER_CLIENT_HEADERS: Record<string, string> = {
    "x-browser-channel": "stable",
    "x-browser-copyright": `Copyright ${year} Google LLC. All Rights reserved.`,
    "x-browser-year": year.toString(),
    // Ensure server-side rendered Chrome Web Store pages see the "Google Chrome" brand
    // alongside Chromium before client-side preload scripts execute.
    "sec-ch-ua": `"Chromium";v="${chromeMajorVersion}", "Not:A-Brand";v="24", "Google Chrome";v="${chromeMajorVersion}"`,
    "sec-ch-ua-full-version-list": `"Chromium";v="${chromeFullVersion}", "Not:A-Brand";v="24.0.0.0", "Google Chrome";v="${chromeFullVersion}"`
  };

  const validationHeader = generateChromeValidationHeader(userAgent);
  if (validationHeader) {
    BROWSER_CLIENT_HEADERS["x-browser-validation"] = validationHeader;
  }

  return BROWSER_CLIENT_HEADERS;
}

export function setupUserAgentTransformer(session: Session) {
  const webRequest = createBetterWebRequest(session.webRequest, "user-agent-transformer");

  webRequest.onBeforeSendHeaders((details, callback) => {
    let updated = false;

    const url = URL.parse(details.url);

    const requestHeaders = details.requestHeaders;
    const newHeaders = { ...requestHeaders };
    for (const header of Object.keys(requestHeaders)) {
      if (header.toLowerCase() == "user-agent") {
        const oldValue = requestHeaders[header];
        const { userAgent: newValue, includeChromeBrowserHeaders } = transformUserAgentHeader(oldValue, url);
        if (oldValue !== newValue) {
          newHeaders[header] = newValue;
          updated = true;
        }

        if (includeChromeBrowserHeaders) {
          const browserHeaders = generateBrowserClientHeaders(newValue);
          const lowerBrowserKeys = new Set(Object.keys(browserHeaders).map((k) => k.toLowerCase()));
          for (const existingKey of Object.keys(newHeaders)) {
            if (lowerBrowserKeys.has(existingKey.toLowerCase())) {
              delete newHeaders[existingKey];
            }
          }
          for (const [key, value] of Object.entries(browserHeaders)) {
            newHeaders[key] = value;
          }
          updated = true;
        }
      }
    }

    if (updated) {
      callback({ requestHeaders: newHeaders });
    } else {
      callback({});
    }
  });
}
