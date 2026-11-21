import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  Cookie,
  Download,
  ExternalLink,
  FileCode2,
  History,
  KeyRound,
  Loader2,
  Lock,
  Pin,
  RefreshCw,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrowserBadge } from "@/components/importer/browser-badge";
import { formatImportSummary, useBrowserImporter } from "@/components/importer/use-browser-importer";
import { SettingsGroup, SettingsRow, SettingsSectionHeader } from "@/components/settings/components/setting-row";
import { useSettingsNavigation } from "@/components/settings/settings-layout";
import { cn } from "@/lib/utils";
import type { ImportDataCategory } from "~/types/importer";

const CATEGORY_META: Array<{
  id: ImportDataCategory;
  label: string;
  description: string;
  icon: typeof Bookmark;
}> = [
  {
    id: "bookmarks",
    label: "Bookmarks & Favourites",
    description: "Import saved bookmarks and Reading List URLs (deduplicated automatically).",
    icon: Bookmark
  },
  {
    id: "history",
    label: "Browsing History",
    description: "Bring visited pages and timestamps for search and Omnibox suggestions.",
    icon: History
  },
  {
    id: "pinnedTabs",
    label: "Pinned Tabs",
    description: "Import sidebar pinned sites from Arc, Zen, Firefox, or Flow directly into your profile.",
    icon: Pin
  },
  {
    id: "searchEngines",
    label: "Search Engines",
    description: "Import custom @shortcut search engines you use in your current browser.",
    icon: Search
  },
  {
    id: "passwords",
    label: "Saved Passwords",
    description: "Encrypt and import saved logins into your profile's Lumi Password Manager (prompts Keychain once).",
    icon: KeyRound
  },
  {
    id: "sessions",
    label: "Cookies & Site Sessions",
    description: "Carry over cookies, localStorage, and IndexedDB sessions so you stay signed in across websites.",
    icon: Cookie
  }
];

export function ImportDataSettings() {
  const { highlightedRowId } = useSettingsNavigation();
  const {
    browsers,
    lumiProfiles,
    targetProfileId,
    setTargetProfileId,
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
    runHtmlImport,
    rescan,
    openPrivacySettings
  } = useBrowserImporter();

  const isMacOS = navigator.platform.toUpperCase().includes("MAC");

  const handleImport = async () => {
    const result = await runImport();
    if (!result) return;
    if (result.errors.length > 0 && !result.success) {
      toast.error(result.errors[0]);
    } else {
      toast.success(formatImportSummary(result));
    }
  };

  const handleHtmlImport = async () => {
    const result = await runHtmlImport();
    if (result.canceled) return;
    if (result.error) {
      toast.error(`Failed importing HTML file: ${result.error}`);
    } else if (result.importedBookmarks === 0) {
      toast.info("No new bookmarks found in the selected HTML file.");
    } else {
      toast.success(`Imported ${result.importedBookmarks.toLocaleString()} bookmarks from HTML file.`);
    }
  };

  const actionableCount = Array.from(selectedCategories).reduce((sum, cat) => {
    if (!selectedProfile?.available[cat]) return sum;
    if (!previewCounts) return sum + 1;
    return sum + (previewCounts[cat] > 0 ? 1 : 0);
  }, 0);

  return (
    <div className="space-y-6 remove-app-drag" data-setting-id="browserImporter">
      <SettingsSectionHeader
        title="Import from Other Browsers"
        description="Automatically scans installed browsers on your computer to bring over bookmarks, history, pinned tabs, and search engines."
        icon={<Download className="size-4" />}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => void handleHtmlImport()}
              disabled={isImportingHtml}
            >
              {isImportingHtml ? <Loader2 className="size-3.5 animate-spin" /> : <FileCode2 className="size-3.5" />}
              Import HTML...
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => void rescan()}
              disabled={isScanning}
            >
              <RefreshCw className={cn("size-3.5", isScanning && "animate-spin")} />
              Rescan
            </Button>
          </>
        }
      />

      {isScanning ? (
        <div className="lumi-glass-panel rounded-2xl p-10 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Scanning installed browsers on this system...
        </div>
      ) : browsers.length === 0 ? (
        <SettingsGroup
          title="No External Browsers Found"
          description="Lumi checked Chrome, Safari, Firefox, Zen, Arc, Brave, Edge, Vivaldi, Opera, Comet, Dia, Flow, and more."
        >
          <SettingsRow
            icon={<FileCode2 className="size-4" />}
            label="Import from a Bookmarks HTML file"
            description="Export a bookmarks HTML file from any browser and import it straight into Lumi Favourites."
          >
            <Button size="sm" onClick={() => void handleHtmlImport()} disabled={isImportingHtml}>
              {isImportingHtml ? "Importing..." : "Choose HTML File"}
            </Button>
          </SettingsRow>
        </SettingsGroup>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-12 gap-5 items-start",
            highlightedRowId === "browserImporter" && "rounded-2xl lumi-highlight-pulse"
          )}
        >
          {/* Left column: Detected Browsers */}
          <div className="lg:col-span-5 space-y-5">
            <SettingsGroup
              title={`Detected Browsers (${browsers.length})`}
              description="Select a source browser detected on your device."
            >
              {browsers.map((browser) => {
                const isSelected = browser.id === selectedBrowser?.id;
                const defaultProf = browser.profiles.find((p) => p.isDefault) ?? browser.profiles[0];
                const subtitle = browser.permissionRequired
                  ? isMacOS
                    ? "Permission required in System Settings"
                    : "Permission required to read profile"
                  : browser.profiles.length > 1
                    ? `${browser.profiles.length} profiles • ${defaultProf?.name ?? "Default"}`
                    : defaultProf?.name || "Detected";

                return (
                  <SettingsRow
                    key={browser.id}
                    icon={<BrowserBadge browserId={browser.id} name={browser.name} family={browser.family} />}
                    label={
                      <span className="inline-flex items-center gap-2 flex-wrap">
                        <span>{browser.name}</span>
                        {browser.permissionRequired && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                            <Lock className="size-2.5" />
                            Locked
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                            Selected
                          </span>
                        )}
                      </span>
                    }
                    description={subtitle}
                    onClick={() => selectBrowser(browser.id)}
                    className={cn(isSelected && "bg-primary/[0.06] dark:bg-primary/[0.1]")}
                  />
                );
              })}
            </SettingsGroup>

            <SettingsGroup
              title="Universal HTML Export"
              description="Works with bookmarks exported from any browser or device."
            >
              <SettingsRow
                icon={<FileCode2 className="size-4" />}
                label="Bookmarks HTML File"
                description="Imports Netscape HTML bookmarks into Lumi Favourites without overwriting existing links."
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => void handleHtmlImport()}
                  disabled={isImportingHtml}
                >
                  {isImportingHtml ? "Importing..." : "Choose File"}
                </Button>
              </SettingsRow>
              {lastHtmlResult && !lastHtmlResult.canceled && (
                <div className="px-4 py-2.5 text-xs flex items-center gap-2 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>
                    {lastHtmlResult.error
                      ? lastHtmlResult.error
                      : `Added ${lastHtmlResult.importedBookmarks.toLocaleString()} bookmarks from HTML.`}
                  </span>
                </div>
              )}
            </SettingsGroup>
          </div>

          {/* Right column: Profile & Data Selection */}
          <div className="lg:col-span-7 space-y-5">
            {selectedBrowser?.permissionRequired ? (
              <SettingsGroup title={`${selectedBrowser.name} Access Needed`}>
                <div className="p-5 space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1.5">
                      <p className="font-medium text-foreground">
                        {isMacOS
                          ? `macOS prevented direct access to ${selectedBrowser.name} data`
                          : `Lumi could not read ${selectedBrowser.name} profile data`}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {isMacOS
                          ? selectedBrowser.family === "safari"
                            ? "Safari bookmarks and history are protected by macOS. Enable Lumi in System Settings → Privacy & Security → Full Disk Access (or use Import HTML below)."
                            : `macOS protects ${selectedBrowser.name} app data. Enable Lumi in System Settings → Privacy & Security → Full Disk Access (recommended) or Files & Folders, then click Rescan — or export bookmarks as HTML.`
                          : `Check filesystem permissions for your ${selectedBrowser.name} profile directory and click Rescan, or import a Bookmarks HTML export below.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-8">
                    {isMacOS && (
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => void openPrivacySettings("fullDisk")}
                      >
                        <ExternalLink className="size-3.5" />
                        Open Full Disk Access
                      </Button>
                    )}
                    {isMacOS && selectedBrowser.family !== "safari" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => void openPrivacySettings("filesAndFolders")}
                      >
                        <ExternalLink className="size-3.5" />
                        Files &amp; Folders
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => void rescan()}
                      disabled={isScanning}
                    >
                      <RefreshCw className={cn("size-3.5", isScanning && "animate-spin")} />
                      Rescan
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => void handleHtmlImport()}
                      disabled={isImportingHtml}
                    >
                      <FileCode2 className="size-3.5" />
                      {isImportingHtml ? "Importing..." : "Import HTML..."}
                    </Button>
                  </div>
                </div>
              </SettingsGroup>
            ) : selectedBrowser && selectedProfile ? (
              <>
                <SettingsGroup
                  title={`Import from ${selectedBrowser.name}`}
                  description="Choose source/destination profiles and select what data to bring into Lumi."
                >
                  {selectedBrowser.profiles.length > 1 && (
                    <SettingsRow
                      label="Source Browser Profile"
                      description={`Multiple profiles detected inside ${selectedBrowser.name}.`}
                    >
                      <Select value={selectedProfile.id} onValueChange={selectProfile}>
                        <SelectTrigger className="w-52 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedBrowser.profiles.map((prof) => (
                            <SelectItem key={prof.id} value={prof.id} className="text-xs">
                              {prof.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsRow>
                  )}

                  {lumiProfiles.length > 0 && (
                    <SettingsRow
                      label="Destination Lumi Profile"
                      description="History, pinned tabs, saved passwords, and site sessions are scoped to this profile."
                    >
                      <Select value={targetProfileId} onValueChange={setTargetProfileId}>
                        <SelectTrigger className="w-52 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {lumiProfiles.map((prof) => (
                            <SelectItem key={prof.id} value={prof.id} className="text-xs">
                              {prof.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsRow>
                  )}

                  {CATEGORY_META.map((cat) => {
                    const Icon = cat.icon;
                    const supported = selectedProfile.available[cat.id];
                    const count = previewCounts ? previewCounts[cat.id] : null;
                    const alreadyCount = previewCounts?.alreadyImported?.[cat.id] ?? 0;
                    const isEmpty = !supported || count === 0;
                    const checked = !isEmpty && selectedCategories.has(cat.id);

                    return (
                      <SettingsRow
                        key={cat.id}
                        icon={<Icon className="size-4" />}
                        label={
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            <span>{cat.label}</span>
                            {isPreviewing && supported ? (
                              <Loader2 className="size-3 animate-spin text-muted-foreground" />
                            ) : count !== null ? (
                              <span
                                className={cn(
                                  "text-[11px] font-medium px-1.5 py-0.5 rounded-md",
                                  count > 0
                                    ? "bg-black/[0.05] dark:bg-white/[0.08] text-foreground/80"
                                    : alreadyCount > 0
                                      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                      : "text-muted-foreground/70"
                                )}
                              >
                                {count > 0
                                  ? alreadyCount > 0
                                    ? `${count.toLocaleString()} new • ${alreadyCount.toLocaleString()} imported`
                                    : `${count.toLocaleString()} found`
                                  : alreadyCount > 0
                                    ? `Already imported (${alreadyCount.toLocaleString()})`
                                    : "None found"}
                              </span>
                            ) : !supported ? (
                              <span className="text-[11px] text-muted-foreground/70">Unavailable</span>
                            ) : null}
                          </span>
                        }
                        description={cat.description}
                        onClick={isEmpty ? undefined : () => toggleCategory(cat.id)}
                        className={cn(isEmpty && "opacity-55")}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={isEmpty}
                          onCheckedChange={() => {
                            if (!isEmpty) toggleCategory(cat.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </SettingsRow>
                    );
                  })}

                  <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/[0.015] dark:bg-white/[0.02]">
                    <p className="text-xs text-muted-foreground">
                      Existing Lumi data is preserved — duplicates are skipped safely.
                    </p>
                    <Button
                      onClick={() => void handleImport()}
                      disabled={isImporting || isPreviewing || actionableCount === 0}
                      className="gap-1.5 shrink-0"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Download className="size-3.5" />
                          Import Selected Data
                        </>
                      )}
                    </Button>
                  </div>
                </SettingsGroup>

                {lastResult && (
                  <div
                    className={cn(
                      "rounded-2xl border p-4 text-xs space-y-1.5",
                      lastResult.success
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium text-sm">
                      {lastResult.success ? (
                        <CheckCircle2 className="size-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="size-4 shrink-0" />
                      )}
                      <span>{formatImportSummary(lastResult)}</span>
                    </div>
                    {lastResult.errors.map((err, idx) => (
                      <p key={idx} className="opacity-90 pl-6">
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
