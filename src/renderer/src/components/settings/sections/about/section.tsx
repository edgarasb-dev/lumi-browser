import { useState, useEffect } from "react";
import { BrowserInfoCard } from "./browser-info-card";
import { GitFork, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { getReleaseCodename } from "~/version";
import { SettingsGroup } from "@/components/settings/components/setting-row";

export function AboutSettings() {
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    lumi.app
      .getAppInfo()
      .then((info) => setVersion(info.app_version))
      .catch((err) => console.error("Failed to load app version:", err));
  }, []);

  const codename = version ? getReleaseCodename(version) : undefined;

  return (
    <div className="space-y-6 remove-app-drag">
      {/* Unified Native Liquid Glass Hero */}
      <div className="lumi-glass-panel rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <img
            src="/assets/logo.svg"
            alt="Lumi"
            className="size-16 rounded-2xl shadow-md shrink-0 object-contain ring-1 ring-black/10 dark:ring-white/15"
          />

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Lumi Browser</h2>
              {version ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                  v{version}
                </span>
              ) : null}
              {codename ? (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full lumi-glass-pill text-foreground/85 inline-flex items-center gap-1">
                  <Sparkles className="size-3 text-primary" />
                  {codename}
                </span>
              ) : null}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Cleaner browsing, sharper focus — a modern privacy-focused desktop browser with fluid spaces, Chrome
              extensions, and macOS continuity.
            </p>
          </div>
        </div>
      </div>

      {/* Heritage & License */}
      <SettingsGroup
        title="Open Source Heritage & Attribution"
        description="Honoring the original creators under GNU GPLv3."
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <GitFork className="size-4" />
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                <strong className="text-foreground">Lumi</strong> is an open-source browser proudly forked from{" "}
                <strong className="text-foreground">Flow Browser</strong>, created by{" "}
                <strong className="text-foreground">iamEvan</strong> and the{" "}
                <strong className="text-foreground">multiboxlabs</strong> team.
              </p>
              <p>
                In accordance with the GNU General Public License v3.0 (GPLv3), Lumi preserves all original copyright
                notices, remains 100% free and open source, and continues evolving with modern workspace, privacy, and
                platform integrations.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 pl-11">
            <a
              href="https://github.com/multiboxlabs/flow-browser"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium lumi-glass-pill hover:border-primary/40 text-foreground transition-colors cursor-pointer"
            >
              <GitFork className="size-3.5 text-muted-foreground" />
              <span>Flow Browser Repository</span>
              <ExternalLink className="size-3 text-muted-foreground ml-0.5" />
            </a>

            <a
              href="https://www.gnu.org/licenses/gpl-3.0.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium lumi-glass-pill hover:border-primary/40 text-foreground transition-colors cursor-pointer"
            >
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>GNU GPLv3 License</span>
              <ExternalLink className="size-3 text-muted-foreground ml-0.5" />
            </a>
          </div>
        </div>
      </SettingsGroup>

      <BrowserInfoCard />
    </div>
  );
}
