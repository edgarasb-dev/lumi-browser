import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Dynamically load electron-webauthn
type WebauthnModule = typeof import("electron-webauthn");
let webauthnModule: WebauthnModule | null = null;
let webauthnModulePromise: Promise<WebauthnModule | null> | null = null;
let passkeyEntitlementPromise: Promise<boolean> | null = null;

const WEB_BROWSER_PASSKEY_ENTITLEMENT_RE =
  /<key>\s*com\.apple\.developer\.web-browser\.public-key-credential\s*<\/key>\s*<true\s*\/>/i;

/**
 * Checks whether the running macOS binary holds Apple's restricted
 * `com.apple.developer.web-browser.public-key-credential` entitlement.
 * Without it, AuthenticationServices permanently denies passkey listing and
 * macOS omits the app from System Settings → Passkeys Access for Web Browsers.
 */
export async function hasWebBrowserPasskeyEntitlement(): Promise<boolean> {
  if (process.platform !== "darwin") {
    return false;
  }

  if (passkeyEntitlementPromise) {
    return passkeyEntitlementPromise;
  }

  passkeyEntitlementPromise = execFileAsync("/usr/bin/codesign", ["-d", "--entitlements", ":-", process.execPath], {
    timeout: 2000
  })
    .then(({ stdout }) => WEB_BROWSER_PASSKEY_ENTITLEMENT_RE.test(stdout))
    .catch(() => false);

  return passkeyEntitlementPromise;
}

export async function getWebauthnAddon(): Promise<WebauthnModule | null> {
  // This addon is only available on macOS with the Apple web-browser passkey entitlement
  if (process.platform !== "darwin") {
    return null;
  }

  // If module is already loaded, return it immediately
  if (webauthnModule) {
    return webauthnModule;
  }

  // If import is in progress, await the existing promise
  if (webauthnModulePromise) {
    return webauthnModulePromise;
  }

  // Start the check + import and cache the promise
  webauthnModulePromise = (async () => {
    try {
      const entitled = await hasWebBrowserPasskeyEntitlement();
      if (!entitled) {
        return null;
      }

      const module = await import("electron-webauthn");
      webauthnModule = module;
      return module;
    } catch (error) {
      // Clear the promise cache on failure so subsequent calls can retry
      console.error("Failed to load electron-webauthn:", error);
      return null;
    } finally {
      webauthnModulePromise = null;
    }
  })();

  return webauthnModulePromise;
}
