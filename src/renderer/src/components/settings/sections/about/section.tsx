import { useState, useEffect } from "react";
import { BrowserInfoCard } from "./browser-info-card";
import { GitFork, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { getReleaseCodename } from "~/version";

export function AboutSettings() {
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    flow.app
      .getAppInfo()
      .then((info) => setVersion(info.app_version))
      .catch((err) => console.error("Failed to load app version:", err));
  }, []);

  const codename = version ? getReleaseCodename(version) : undefined;

  return (
    <div className="space-y-6">
      {/* Lumi Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-br from-primary/10 via-purple-500/5 to-transparent p-6 sm:p-8 backdrop-blur-md">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <img
            src="/assets/logo.svg"
            alt="Lumi"
            className="size-16 rounded-2xl shadow-lg shadow-primary/20 shrink-0 object-contain drop-shadow-md"
          />

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Lumi Browser</h2>
              {version ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  v{version}
                </span>
              ) : null}
              {codename ? (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1 shadow-xs">
                  <Sparkles className="size-3" />
                  {codename}
                </span>
              ) : null}
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40">
                Open Source
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              A modern, privacy-focused browser with vertical spaces, tab previews, and a customizable minimalistic
              design.
            </p>
          </div>
        </div>
      </div>

      {/* Heritage & Open Source Attribution Card */}
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <GitFork className="size-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Open Source Heritage & Attribution
            </h3>
            <p className="text-xs text-muted-foreground">
              Honoring the original creators and the GNU General Public License v3.0.
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground leading-relaxed space-y-2 bg-muted/30 p-4 rounded-xl border border-border/30">
          <p>
            <strong className="text-foreground">Lumi</strong> is an open-source browser proudly forked from{" "}
            <strong className="text-foreground">Flow Browser</strong>, created by{" "}
            <strong className="text-foreground">iamEvan</strong> and the{" "}
            <strong className="text-foreground">multiboxlabs</strong> team.
          </p>
          <p>
            In accordance with the GNU General Public License v3.0 (GPLv3), Lumi maintains all original copyright
            notices, remains 100% free and open source, and extends the browser with new capabilities including
            customizable search engines, live tab previews, enhanced window management, and custom themes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <a
            href="https://github.com/multiboxlabs/flow-browser"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/40 hover:border-border transition-colors cursor-pointer"
          >
            <GitFork className="size-3.5 text-muted-foreground" />
            <span>Original Flow Browser Repository</span>
            <ExternalLink className="size-3 text-muted-foreground ml-0.5" />
          </a>

          <a
            href="https://www.gnu.org/licenses/gpl-3.0.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/40 hover:border-border transition-colors cursor-pointer"
          >
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>GNU GPLv3 License</span>
            <ExternalLink className="size-3 text-muted-foreground ml-0.5" />
          </a>
        </div>
      </div>

      {/* System & Engine Specifications */}
      <BrowserInfoCard />
    </div>
  );
}
