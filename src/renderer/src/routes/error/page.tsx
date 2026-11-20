import { transformUrlToDisplayURL } from "@/lib/url";
import { FrownIcon, RefreshCwIcon, ArrowLeftIcon, Gamepad2Icon } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo } from "react";

function Page() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const errorCode = params.get("errorCode") || "-105";
  const url = params.get("url");
  const displayUrl = transformUrlToDisplayURL(url ?? "", false) ?? url;

  const info = {
    "-6": {
      title: "Your file was not found",
      description: `It may have been moved or deleted.`,
      code: "ERR_FILE_NOT_FOUND"
    },
    "-10": {
      title: "This site can't be reached",
      description: `The webpage at <b>${displayUrl}</b> might be temporarily down or it may have moved permanently to a new web address.`,
      code: "ERR_ACCESS_DENIED"
    },
    "-105": {
      title: "This site can't be reached",
      description: `<b>${displayUrl}</b>'s server IP address could not be found.`,
      code: "ERR_NAME_NOT_RESOLVED"
    },
    "-106": {
      title: "No internet",
      description: `Try: <ul><li>Checking the network cables, modem, and router</li><li>Reconnecting to Wi-Fi</li></ul>`,
      code: "ERR_INTERNET_DISCONNECTED"
    },
    "-108": {
      title: "This site can't be reached",
      description: `The webpage at <b>${displayUrl}</b> might be temporarily down or it may have moved permanently to a new web address.`,
      code: "ERR_ADDRESS_INVALID"
    },
    "-109": {
      title: "This site can't be reached",
      description: `<b>${displayUrl}</b> is unreachable.`,
      code: "ERR_ADDRESS_UNREACHABLE"
    },
    "-300": {
      title: "This site can't be reached",
      description: `The webpage at <b>${displayUrl}</b> might be temporarily down or it may have moved permanently to a new web address.`,
      code: "ERR_INVALID_URL"
    },
    "-379": {
      title: "This site can't be reached",
      description: `The webpage at <b>${displayUrl}</b> might be temporarily down or it may have moved permanently to a new web address.`,
      code: "ERR_HTTP_RESPONSE_CODE_FAILURE"
    }
  };

  const errorInfo = info[errorCode as keyof typeof info] || info["-105"];

  const handleReload = useCallback(() => {
    if (!url) return;
    window.location.replace(url);
  }, [url]);

  const canGoBack = window.history.length > 1;

  const handleGoBack = () => {
    window.history.back();
  };

  useEffect(() => {
    const initial = params.get("initial");
    if (initial) {
      // remove initial param
      const newURL = new URL(window.location.href);
      newURL.searchParams.delete("initial");
      window.history.replaceState({}, "", newURL.toString());
    } else {
      handleReload();
    }
  }, [handleReload, params]);

  if (!url) {
    return null;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground transition-colors duration-300">
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-radial from-primary/10 via-transparent to-transparent"
        aria-hidden
      />
      <title>{displayUrl || "Error"}</title>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="lumi-glass-panel relative flex w-full max-w-md flex-col items-center p-8 text-center shadow-lg"
      >
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <FrownIcon className="size-8" />
        </div>

        <h1 className="mb-2 text-2xl font-semibold tracking-tight">{errorInfo.title}</h1>

        <div
          className="mb-4 text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: errorInfo.description }}
        />

        <div className="lumi-glass-pill mb-7 px-3 py-1 font-mono text-xs text-muted-foreground">{errorInfo.code}</div>

        <div className="flex flex-wrap justify-center gap-2.5">
          {canGoBack && (
            <button
              type="button"
              onClick={handleGoBack}
              className="flex items-center gap-2 rounded-xl border border-black/10 bg-black/5 px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/10 dark:border-white/12 dark:bg-white/8 dark:hover:bg-white/14"
            >
              <ArrowLeftIcon className="size-4" />
              Go Back
            </button>
          )}

          <button
            type="button"
            onClick={handleReload}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-opacity hover:opacity-90"
          >
            <RefreshCwIcon className="size-4" />
            Reload
          </button>
        </div>

        <div className="mt-7 border-t border-black/8 pt-5 dark:border-white/10">
          <button
            type="button"
            onClick={() => window.open("lumi://games", "_blank")}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/8"
          >
            <Gamepad2Icon className="size-4 text-primary" />
            Take a break in Game Library
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default Page;
