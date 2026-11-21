import { useEffect } from "react";

/**
 * Defers optional Umami analytics loading until after initial chrome paint & idle
 * so cold-start rendering on top-level windows stays completely unblocked.
 */
export const UmamiScriptLoader = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;
    const injectScript = () => {
      if (cancelled || document.querySelector('script[src="/umami.js"]')) return;
      const script = document.createElement("script");
      script.defer = true;
      script.src = "/umami.js";
      script.dataset.hostUrl = "https://umami.iamevan.dev";
      script.dataset.websiteId = "846df382-cb68-4e59-a97e-76df33a73e90";
      document.head.appendChild(script);
    };

    const timerId = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(injectScript, { timeout: 2000 });
      } else {
        injectScript();
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, []);

  return null;
};
