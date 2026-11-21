import { OnboardingAdvanceCallback } from "@/components/onboarding/main";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BrowserBadge } from "@/components/importer/browser-badge";
import { formatImportSummary, useBrowserImporter } from "@/components/importer/use-browser-importer";
import { ArrowRight, Bookmark, CheckCircle2, FileCode2, History, Loader2, Pin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportDataCategory } from "~/types/importer";

const CATEGORY_OPTIONS: Array<{ id: ImportDataCategory; label: string; icon: typeof Bookmark }> = [
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { id: "history", label: "History", icon: History },
  { id: "pinnedTabs", label: "Pinned Tabs", icon: Pin },
  { id: "searchEngines", label: "Search Engines", icon: Search }
];

export function OnboardingImport({ advance }: { advance: OnboardingAdvanceCallback }) {
  const {
    browsers,
    selectedBrowser,
    selectedProfile,
    selectedCategories,
    previewCounts,
    isScanning,
    isPreviewing,
    isImporting,
    isImportingHtml,
    lastResult,
    lastHtmlResult,
    selectBrowser,
    selectProfile,
    toggleCategory,
    runImport,
    runHtmlImport
  } = useBrowserImporter();

  const usableBrowsers = browsers.filter((b) => !b.permissionRequired && b.profiles.length > 0);
  const selectedActionableCount = Array.from(selectedCategories).reduce((sum, cat) => {
    if (!selectedProfile?.available[cat]) return sum;
    if (!previewCounts) return sum + 1;
    return sum + (previewCounts[cat] > 0 ? 1 : 0);
  }, 0);

  const handleImportAndContinue = async () => {
    if (selectedActionableCount === 0) {
      advance();
      return;
    }
    const result = await runImport();
    if (result?.success) {
      window.setTimeout(advance, 450);
    }
  };

  return (
    <>
      <motion.div
        className="relative z-elevated mb-5 max-w-2xl px-4 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <h1 className="mb-2.5 text-4xl font-bold tracking-tight text-white md:text-5xl">Bring Your Browsing Over</h1>
        <p className="text-base text-slate-300/90 md:text-lg">
          Import bookmarks, history, pinned tabs, and search engines from your installed browsers.
        </p>
      </motion.div>

      <motion.div
        className="relative z-elevated w-full max-w-xl px-4 space-y-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
      >
        {isScanning ? (
          <div className="rounded-2xl border border-white/14 bg-white/7 p-8 backdrop-blur-xl flex items-center justify-center gap-2.5 text-sm text-slate-200">
            <Loader2 className="size-4 animate-spin text-sky-400" />
            Scanning installed browsers...
          </div>
        ) : usableBrowsers.length === 0 ? (
          <div className="rounded-2xl border border-white/14 bg-white/7 p-6 backdrop-blur-xl text-center space-y-3">
            <p className="text-sm font-medium text-white">No direct browser profiles detected automatically</p>
            <p className="text-xs text-slate-300/80">
              You can import a Bookmarks HTML export now, or configure imports anytime in Lumi Settings.
            </p>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runHtmlImport()}
                disabled={isImportingHtml}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 gap-1.5"
              >
                <FileCode2 className="size-3.5" />
                {isImportingHtml ? "Importing..." : "Import Bookmarks HTML..."}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/14 bg-white/7 p-4 backdrop-blur-xl space-y-3.5">
            {/* Detected browser grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {usableBrowsers.slice(0, 9).map((browser) => {
                const active = browser.id === selectedBrowser?.id;
                return (
                  <button
                    key={browser.id}
                    type="button"
                    onClick={() => selectBrowser(browser.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer",
                      active
                        ? "border-blue-400/75 bg-blue-500/22 ring-2 ring-blue-400/35"
                        : "border-white/10 bg-white/4 hover:bg-white/10"
                    )}
                  >
                    <BrowserBadge
                      browserId={browser.id}
                      name={browser.name}
                      family={browser.family}
                      className="size-7 rounded-lg text-[10px]"
                    />
                    <span className="text-xs font-medium text-white truncate">{browser.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Profile switcher when multiple profiles exist */}
            {selectedBrowser && selectedBrowser.profiles.length > 1 && selectedProfile && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-slate-300/80 mr-1">Profile:</span>
                {selectedBrowser.profiles.map((prof) => (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => selectProfile(prof.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                      prof.id === selectedProfile.id
                        ? "bg-blue-500 text-white"
                        : "bg-white/8 text-slate-200 hover:bg-white/14"
                    )}
                  >
                    {prof.name}
                  </button>
                ))}
              </div>
            )}

            {/* Data categories */}
            {selectedProfile && (
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map((cat) => {
                  const Icon = cat.icon;
                  const supported = selectedProfile.available[cat.id];
                  const count = previewCounts ? previewCounts[cat.id] : null;
                  const disabled = !supported || count === 0;
                  const checked = !disabled && selectedCategories.has(cat.id);

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer",
                        disabled
                          ? "border-white/6 bg-white/[0.02] opacity-45 cursor-not-allowed"
                          : checked
                            ? "border-blue-400/50 bg-blue-500/15"
                            : "border-white/10 bg-white/4 hover:bg-white/8"
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon className="size-3.5 text-sky-300 shrink-0" />
                        <span className="text-xs font-medium text-white truncate">
                          {cat.label}
                          {isPreviewing && supported ? (
                            <span className="text-[10px] text-slate-300/70 ml-1">…</span>
                          ) : count !== null && count > 0 ? (
                            <span className="text-[10px] text-slate-300/80 ml-1">({count.toLocaleString()})</span>
                          ) : null}
                        </span>
                      </span>
                      <Checkbox checked={checked} disabled={disabled} className="pointer-events-none" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(lastResult || (lastHtmlResult && !lastHtmlResult.canceled)) && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-2.5 text-xs text-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-300 shrink-0" />
            <span>
              {lastResult
                ? formatImportSummary(lastResult)
                : `Imported ${lastHtmlResult?.importedBookmarks ?? 0} bookmarks from HTML.`}
            </span>
          </div>
        )}
      </motion.div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="ghost"
          onClick={advance}
          disabled={isImporting}
          className="cursor-pointer text-slate-300 hover:text-white hover:bg-white/10"
        >
          Skip for now
        </Button>

        {usableBrowsers.length > 0 ? (
          <Button
            onClick={() => void handleImportAndContinue()}
            disabled={isImporting || isPreviewing}
            className="cursor-pointer gap-2 rounded-xl border border-blue-400/40 bg-[#2563EB]/90 px-8 py-6 text-base font-medium text-white backdrop-blur-md hover:bg-[#2563EB]"
          >
            {isImporting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Importing...
              </>
            ) : selectedActionableCount > 0 ? (
              <>
                Import &amp; Continue
                <ArrowRight className="size-5" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="size-5" />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={advance}
            className="cursor-pointer gap-2 rounded-xl border border-blue-400/40 bg-[#2563EB]/90 px-8 py-6 text-base font-medium text-white backdrop-blur-md hover:bg-[#2563EB]"
          >
            Continue
            <ArrowRight className="size-5" />
          </Button>
        )}
      </div>
    </>
  );
}
