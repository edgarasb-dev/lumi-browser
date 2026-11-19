import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Bookmark, BookOpen, Clock, Compass, FileUp, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { OnboardingAdvanceCallback } from "@/components/onboarding/main";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Space } from "~/lumi/interfaces/sessions/spaces";
import type { SafariDiscoveryResult } from "~/types/safari-sync";

export function OnboardingSafariImport({ advance }: { advance: OnboardingAdvanceCallback }) {
  const isMac = lumi.app.getPlatform() === "darwin";

  const [discovery, setDiscovery] = useState<SafariDiscoveryResult | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [customFilePath, setCustomFilePath] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  const [createSafariSpace, setCreateSafariSpace] = useState(true);
  const [importOpenTabs, setImportOpenTabs] = useState(true);
  const [importBookmarks, setImportBookmarks] = useState(true);
  const [importReadingList, setImportReadingList] = useState(true);
  const [importHistory, setImportHistory] = useState(true);

  useEffect(() => {
    if (!isMac) {
      advance();
    }
  }, [isMac, advance]);

  const scan = useCallback(async (overridePath?: string) => {
    setIsLoading(true);
    try {
      const [res, fetchedSpaces] = await Promise.all([
        lumi.safariSync.discoverSafari(overridePath),
        lumi.spaces.getSpacesFromProfile("main")
      ]);
      setDiscovery(res);
      setSpaces(fetchedSpaces);
    } catch (error) {
      console.error("Onboarding Safari discovery failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isMac) {
      void scan(customFilePath);
    }
  }, [isMac, scan, customFilePath]);

  if (!isMac) {
    return null;
  }

  const handlePickBookmarksFile = async () => {
    const picked = await lumi.safariSync.pickBookmarksFile();
    if (!picked) return;
    setCustomFilePath(picked);
  };

  const handleImportAndContinue = async () => {
    setIsImporting(true);
    try {
      const fallbackSpaceId = spaces[0]?.id;
      const result = await lumi.safariSync.importFromSafari({
        profileId: "main",
        targetSpaceId: createSafariSpace ? undefined : fallbackSpaceId,
        createSafariSpace,
        importOpenTabs,
        importBookmarks,
        importReadingListToFavourites: importReadingList,
        importReadingListAsTabs: false,
        importHistory,
        historyMaxDays: 90,
        customBookmarksFilePath: customFilePath
      });

      const totalCount =
        result.tabsOpened + result.tabsQueuedForOnboarding + result.favouritesAdded + result.historyEntriesImported;

      if (totalCount > 0) {
        toast.success("Imported your Safari items into Lumi");
      } else if (result.errors.length > 0) {
        toast.error(result.errors[0]);
      }
      advance();
    } catch (error) {
      console.error("Onboarding Safari import failed:", error);
      toast.error("Could not complete Safari import");
    } finally {
      setIsImporting(false);
    }
  };

  const hasAnythingChecked = importOpenTabs || importBookmarks || importReadingList || importHistory;

  return (
    <>
      <motion.div
        className="relative z-elevated text-center max-w-2xl px-4 mb-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0066FF]/15 border border-[#0066FF]/30 text-sky-300 text-xs font-medium mb-3">
          <Compass className="size-3.5" />
          Optional Setup
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2.5">Import from Safari</h1>
        <p className="text-gray-400 text-base max-w-lg mx-auto">
          Bring your open Safari tabs, bookmarks, Reading List, and history into Lumi — or skip and set it up anytime in
          Settings.
        </p>
      </motion.div>

      <motion.div
        className="relative z-elevated w-full max-w-xl px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
      >
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 text-white">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-gray-300">
              <Loader2 className="size-4 animate-spin" />
              <span>Scanning Safari data...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Compass className="size-3.5 text-sky-400" />
                    <span>Open Tabs</span>
                  </div>
                  <div className="text-xl font-bold mt-1">{discovery?.counts.openTabs ?? 0}</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Bookmark className="size-3.5 text-amber-400" />
                    <span>Bookmarks</span>
                  </div>
                  <div className="text-xl font-bold mt-1">{discovery?.counts.bookmarks ?? 0}</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <BookOpen className="size-3.5 text-emerald-400" />
                    <span>Reading List</span>
                  </div>
                  <div className="text-xl font-bold mt-1">{discovery?.counts.readingList ?? 0}</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Clock className="size-3.5 text-purple-400" />
                    <span>History</span>
                  </div>
                  <div className="text-xl font-bold mt-1">{discovery?.counts.history ?? 0}</div>
                </div>
              </div>

              {(discovery?.fullDiskAccessNeeded || discovery?.automationError) && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="size-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-gray-300 leading-relaxed">
                      macOS restricts direct access to Safari data without Full Disk Access / Automation approval. You
                      can pick an exported Safari Bookmarks file or grant access in System Settings.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-6">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
                      onClick={() => void handlePickBookmarksFile()}
                    >
                      <FileUp className="size-3 mr-1" />
                      Select Bookmarks File
                    </Button>
                    {discovery?.fullDiskAccessNeeded && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-amber-300 hover:bg-white/10 hover:text-amber-200"
                        onClick={() => void lumi.safariSync.openMacPrivacySettings("full-disk-access")}
                      >
                        Privacy Settings
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <Checkbox
                    checked={importOpenTabs}
                    onCheckedChange={(v) => setImportOpenTabs(v === true)}
                    className="border-white/30"
                  />
                  <span>Open Safari tabs ({discovery?.counts.openTabs ?? 0})</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <Checkbox
                    checked={importBookmarks}
                    onCheckedChange={(v) => setImportBookmarks(v === true)}
                    className="border-white/30"
                  />
                  <span>Bookmarks → Lumi Favourites ({discovery?.counts.bookmarks ?? 0})</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <Checkbox
                    checked={importReadingList}
                    onCheckedChange={(v) => setImportReadingList(v === true)}
                    className="border-white/30"
                  />
                  <span>Reading List → Lumi Favourites ({discovery?.counts.readingList ?? 0})</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <Checkbox
                    checked={importHistory}
                    onCheckedChange={(v) => setImportHistory(v === true)}
                    className="border-white/30"
                  />
                  <span>Recent Safari browsing history ({discovery?.counts.history ?? 0})</span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onboarding-safari-space"
                    checked={createSafariSpace}
                    onCheckedChange={(v) => setCreateSafariSpace(v === true)}
                    className="border-white/30"
                  />
                  <Label
                    htmlFor="onboarding-safari-space"
                    className="text-xs text-gray-300 cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="size-3.5 text-sky-400" />
                    Keep imported tabs in a dedicated &ldquo;Safari&rdquo; Space
                  </Label>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <div className="mt-7 flex items-center gap-3 relative z-elevated">
        <Button
          variant="ghost"
          onClick={advance}
          disabled={isImporting}
          className="cursor-pointer px-6 py-5 text-base text-gray-300 hover:text-white hover:bg-white/10"
        >
          Skip for Now
        </Button>

        <Button
          onClick={() => void handleImportAndContinue()}
          disabled={isLoading || isImporting || !hasAnythingChecked}
          className="cursor-pointer px-8 py-5 text-base bg-[#0066FF] hover:bg-[#0055DD] text-white border border-[#0066FF]/50 gap-2"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              Import &amp; Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
