import { useState } from "react";
import { motion } from "motion/react";
import { Check, Compass, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InternalPageShell } from "@/components/main/internal-page-shell";
import { copyTextToClipboard } from "@/lib/utils";

const LUMI_URLS = [
  { hostname: "new-tab", description: "Start page with Omnibox search, studio backdrop, and widgets" },
  { hostname: "history", description: "Searchable browsing history grouped by day" },
  { hostname: "downloads", description: "Download manager with progress, pause/resume, and quick open" },
  { hostname: "bangs", description: "Quick search shortcut index across thousands of websites" },
  { hostname: "extensions", description: "Manage Chrome Web Store extensions and permissions" },
  { hostname: "games", description: "Built-in offline mini-games library" },
  { hostname: "about", description: "Directory of internal lumi:// routes" },
  { hostname: "omnibox", description: "Command palette and instant tools overlay surface" },
  { hostname: "onboarding", description: "First-run setup wizard experience" },
  { hostname: "error", description: "Network and page load error fallback screen" }
] as const;

function Page() {
  const [copiedHost, setCopiedHost] = useState<string | null>(null);

  const handleCopy = (hostname: string, url: string) => {
    copyTextToClipboard(url);
    setCopiedHost(hostname);
    setTimeout(() => setCopiedHost((prev) => (prev === hostname ? null : prev)), 1400);
  };

  return (
    <InternalPageShell
      title="Lumi URLs"
      subtitle="Internal lumi:// protocols available in this browser"
      icon={<Compass className="size-4" />}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="lumi-glass-group divide-y divide-black/6 dark:divide-white/8"
      >
        {LUMI_URLS.map((item) => {
          const url = `lumi://${item.hostname}`;
          const isCopied = copiedHost === item.hostname;
          return (
            <div key={url} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm font-medium text-foreground">{url}</div>
                <div className="truncate text-xs text-muted-foreground">{item.description}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleCopy(item.hostname, url)}
                >
                  {isCopied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  {isCopied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => window.open(url, "_blank")}
                >
                  <ExternalLink className="size-3.5" />
                  Open
                </Button>
              </div>
            </div>
          );
        })}
      </motion.div>
    </InternalPageShell>
  );
}

function App() {
  return (
    <>
      <title>Lumi URLs</title>
      <Page />
    </>
  );
}

export default App;
