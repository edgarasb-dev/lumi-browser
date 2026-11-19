import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  Clock,
  Compass,
  FileUp,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "~/lumi/interfaces/sessions/profiles";
import type { Space } from "~/lumi/interfaces/sessions/spaces";
import type { SafariDiscoveryResult, SafariLiveSyncConfig } from "~/types/safari-sync";

const CREATE_SAFARI_SPACE_VALUE = "__create_safari__";

interface SafariBridgeCardProps {
  liveSync: SafariLiveSyncConfig;
  onRefreshState: () => void;
}

export function SafariBridgeCard({ liveSync, onRefreshState }: SafariBridgeCardProps) {
  const [discovery, setDiscovery] = useState<SafariDiscoveryResult | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncingTabsNow, setIsSyncingTabsNow] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("main");
  const [targetSpaceValue, setTargetSpaceValue] = useState(CREATE_SAFARI_SPACE_VALUE);
  const [customSourcePath, setCustomSourcePath] = useState<string | undefined>(undefined);

  const [importOpenTabs, setImportOpenTabs] = useState(true);
  const [importBookmarks, setImportBookmarks] = useState(true);
  const [importReadingListToFavourites, setImportReadingListToFavourites] = useState(true);
  const [importReadingListAsTabs, setImportReadingListAsTabs] = useState(false);
  const [importHistory, setImportHistory] = useState(true);
  const [historyMaxDays, setHistoryMaxDays] = useState("90");
  const [selectedTabUrls, setSelectedTabUrls] = useState<Set<string>>(new Set());
  const [showTabSelector, setShowTabSelector] = useState(false);

  const scanSafari = useCallback(async (overridePath?: string) => {
    setIsScanning(true);
    try {
      const result = await lumi.safariSync.discoverSafari(overridePath);
      setDiscovery(result);
      setSelectedTabUrls(new Set(result.openTabs.map((t) => t.url)));
    } catch (error) {
      console.error("Failed to discover Safari data:", error);
      toast.error("Could not scan Safari data.");
    } finally {
      setIsScanning(false);
    }
  }, []);

  const loadProfilesAndSpaces = useCallback(async () => {
    try {
      const [fetchedProfiles, fetchedSpaces] = await Promise.all([
        lumi.profiles.getProfiles(),
        lumi.spaces.getSpaces()
      ]);
      const nonInternal = fetchedProfiles.filter((p) => !p.internal && !p.ephemeral);
      setProfiles(nonInternal);
      setSpaces(fetchedSpaces);
      if (nonInternal.length > 0 && !nonInternal.some((p) => p.id === selectedProfileId)) {
        setSelectedProfileId(nonInternal[0]!.id);
      }
    } catch (error) {
      console.error("Failed loading profiles/spaces:", error);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    void scanSafari(customSourcePath);
    void loadProfilesAndSpaces();
  }, [scanSafari, loadProfilesAndSpaces, customSourcePath]);

  const profileSpaces = spaces.filter((s) => s.profileId === selectedProfileId);

  const handlePickFile = async () => {
    const picked = await lumi.safariSync.pickBookmarksFile();
    if (!picked) return;
    setCustomSourcePath(picked);
    toast.success("Loaded custom Safari bookmarks source");
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const createSafariSpace = targetSpaceValue === CREATE_SAFARI_SPACE_VALUE;
      const result = await lumi.safariSync.importFromSafari({
        profileId: selectedProfileId,
        targetSpaceId: createSafariSpace ? undefined : targetSpaceValue,
        createSafariSpace,
        importOpenTabs,
        importBookmarks,
        importReadingListToFavourites,
        importReadingListAsTabs,
        importHistory,
        historyMaxDays: Number(historyMaxDays) || 90,
        selectedOpenTabUrls: showTabSelector ? Array.from(selectedTabUrls) : undefined,
        customBookmarksFilePath: customSourcePath
      });

      const summaryParts: string[] = [];
      if (result.tabsOpened > 0) summaryParts.push(`${result.tabsOpened} tabs opened`);
      if (result.favouritesAdded > 0) summaryParts.push(`${result.favouritesAdded} favourites added`);
      if (result.historyEntriesImported > 0) summaryParts.push(`${result.historyEntriesImported} history items`);

      if (summaryParts.length > 0) {
        toast.success(`Safari import complete: ${summaryParts.join(", ")}`);
      } else if (result.errors.length > 0) {
        toast.error(result.errors[0]);
      } else {
        toast.info("Everything selected is already in Lumi.");
      }

      await loadProfilesAndSpaces();
      onRefreshState();
    } catch (error) {
      console.error("Safari import failed:", error);
      toast.error("Failed to import data from Safari.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleLiveSync = async (enabled: boolean) => {
    await lumi.safariSync.updateSafariLiveSync({
      enabled,
      profileId: selectedProfileId,
      targetSpaceId: targetSpaceValue === CREATE_SAFARI_SPACE_VALUE ? undefined : targetSpaceValue
    });
    toast.success(enabled ? "Safari Live Tab Sync enabled" : "Safari Live Tab Sync paused");
  };

  const handleSyncTabsNow = async () => {
    setIsSyncingTabsNow(true);
    try {
      const res = await lumi.safariSync.syncSafariOpenTabsNow();
      if (res.error) {
        toast.error(res.error);
      } else if (res.importedCount > 0) {
        toast.success(`Synced ${res.importedCount} open Safari tab${res.importedCount === 1 ? "" : "s"}`);
      } else {
        toast.info("Safari open tabs are already up to date in Lumi.");
      }
    } finally {
      setIsSyncingTabsNow(false);
    }
  };

  const toggleTabSelection = (url: string) => {
    setSelectedTabUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const hasNothingSelected =
    !importOpenTabs && !importBookmarks && !importReadingListToFavourites && !importReadingListAsTabs && !importHistory;

  return (
    <div className="space-y-5 remove-app-drag">
      <Card className="bg-card/60 backdrop-blur-md border-border/50">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Compass className="size-5 text-sky-500" />
              <CardTitle className="text-lg">macOS Safari Bridge</CardTitle>
              {discovery?.supported ? (
                <Badge variant={discovery.safariRunning ? "default" : "secondary"} className="text-[11px]">
                  {discovery.safariRunning
                    ? "Safari Running"
                    : discovery.safariInstalled
                      ? "Safari Installed"
                      : "Not Found"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px]">
                  HTML Import Mode
                </Badge>
              )}
            </div>
            <CardDescription>
              Import or mirror Safari open tabs, bookmarks, Reading List, and browsing history into Lumi.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handlePickFile}>
              <FileUp className="size-3.5 mr-1.5" />
              Pick File
            </Button>
            <Button variant="outline" size="sm" onClick={() => void scanSafari(customSourcePath)} disabled={isScanning}>
              {isScanning ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5 mr-1.5" />
              )}
              Scan
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {discovery && discovery.supported && (discovery.fullDiskAccessNeeded || discovery.automationError) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="size-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">macOS Permission Guidance</p>
                  {discovery.fullDiskAccessNeeded && (
                    <p className="text-muted-foreground">
                      Safari&apos;s <code className="px-1 py-0.5 rounded bg-muted">Bookmarks.plist</code> and{" "}
                      <code className="px-1 py-0.5 rounded bg-muted">History.db</code> are protected by macOS Full Disk
                      Access. You can either grant access in System Settings or export{" "}
                      <strong>File → Export → Bookmarks…</strong> from Safari and pick the HTML file above.
                    </p>
                  )}
                  {discovery.automationError && <p className="text-muted-foreground">{discovery.automationError}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-6">
                {discovery.fullDiskAccessNeeded && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => void lumi.safariSync.openMacPrivacySettings("full-disk-access")}
                  >
                    Open Full Disk Access
                  </Button>
                )}
                {discovery.automationError && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => void lumi.safariSync.openMacPrivacySettings("automation")}
                  >
                    Open Automation Settings
                  </Button>
                )}
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handlePickFile}>
                  <FolderOpen className="size-3 mr-1" />
                  Select Bookmarks.plist / HTML
                </Button>
              </div>
            </div>
          )}

          {customSourcePath && (
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
              <span className="truncate text-muted-foreground">
                Source file: <strong className="text-foreground font-mono">{customSourcePath}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setCustomSourcePath(undefined)}
              >
                Reset
              </Button>
            </div>
          )}

          {/* Discovery Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Compass className="size-3.5 text-sky-500" />
                <span>Open Tabs</span>
              </div>
              <div className="text-2xl font-bold mt-1">{isScanning ? "—" : (discovery?.counts.openTabs ?? 0)}</div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Bookmark className="size-3.5 text-amber-500" />
                <span>Bookmarks</span>
              </div>
              <div className="text-2xl font-bold mt-1">{isScanning ? "—" : (discovery?.counts.bookmarks ?? 0)}</div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="size-3.5 text-emerald-500" />
                <span>Reading List</span>
              </div>
              <div className="text-2xl font-bold mt-1">{isScanning ? "—" : (discovery?.counts.readingList ?? 0)}</div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-purple-500" />
                <span>History URLs</span>
              </div>
              <div className="text-2xl font-bold mt-1">{isScanning ? "—" : (discovery?.counts.history ?? 0)}</div>
            </div>
          </div>

          {/* Target Profile & Space Mapping */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Target Profile</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose profile" />
                </SelectTrigger>
                <SelectContent className="remove-app-drag z-popover">
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Target Space for Imported Tabs</Label>
              <Select value={targetSpaceValue} onValueChange={setTargetSpaceValue}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose Space" />
                </SelectTrigger>
                <SelectContent className="remove-app-drag z-popover">
                  <SelectItem value={CREATE_SAFARI_SPACE_VALUE}>
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-sky-500" />
                      Create / Use &ldquo;Safari&rdquo; Space
                    </span>
                  </SelectItem>
                  {profileSpaces.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selective Import Toggles */}
          <div className="space-y-2.5 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="import-open-tabs"
                  checked={importOpenTabs}
                  onCheckedChange={(checked) => setImportOpenTabs(checked === true)}
                />
                <Label htmlFor="import-open-tabs" className="text-sm font-medium cursor-pointer">
                  Import open Safari tabs ({discovery?.counts.openTabs ?? 0})
                </Label>
              </div>
              {discovery && discovery.openTabs.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowTabSelector((v) => !v)}
                >
                  {showTabSelector ? "Hide tab picker" : "Select individual tabs"}
                </Button>
              )}
            </div>

            {showTabSelector && discovery && discovery.openTabs.length > 0 && (
              <div className="ml-6 max-h-44 overflow-y-auto rounded-lg border bg-background/60 p-2 space-y-1">
                {discovery.openTabs.map((tab, idx) => (
                  <label
                    key={`${tab.windowIndex}-${tab.tabIndex}-${idx}`}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <Checkbox
                      checked={selectedTabUrls.has(tab.url)}
                      onCheckedChange={() => toggleTabSelection(tab.url)}
                    />
                    <span className="truncate font-medium flex-1">{tab.title}</span>
                    <span className="truncate max-w-44 text-muted-foreground font-mono text-[10px]">{tab.url}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="import-bookmarks"
                checked={importBookmarks}
                onCheckedChange={(checked) => setImportBookmarks(checked === true)}
              />
              <Label htmlFor="import-bookmarks" className="text-sm font-medium cursor-pointer">
                Import Safari bookmarks into Lumi Favourites ({discovery?.counts.bookmarks ?? 0})
              </Label>
            </div>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="import-reading-favs"
                checked={importReadingListToFavourites}
                onCheckedChange={(checked) => setImportReadingListToFavourites(checked === true)}
              />
              <Label htmlFor="import-reading-favs" className="text-sm font-medium cursor-pointer">
                Save Safari Reading List items to Favourites ({discovery?.counts.readingList ?? 0})
              </Label>
            </div>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="import-reading-tabs"
                checked={importReadingListAsTabs}
                onCheckedChange={(checked) => setImportReadingListAsTabs(checked === true)}
              />
              <Label htmlFor="import-reading-tabs" className="text-sm font-medium cursor-pointer">
                Open Safari Reading List items as sleeping tabs in Space
              </Label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="import-history"
                  checked={importHistory}
                  onCheckedChange={(checked) => setImportHistory(checked === true)}
                />
                <Label htmlFor="import-history" className="text-sm font-medium cursor-pointer">
                  Import Safari browsing history ({discovery?.counts.history ?? 0})
                </Label>
              </div>
              {importHistory && (
                <Select value={historyMaxDays} onValueChange={setHistoryMaxDays}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="remove-app-drag z-popover">
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="180">Last 180 days</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button onClick={handleImport} disabled={isImporting || hasNothingSelected}>
              {isImporting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Import Selected from Safari
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Safari Open-Tab Sync Card */}
      <Card className="bg-card/60 backdrop-blur-md border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Live Safari Open-Tab Sync</CardTitle>
              <CardDescription>
                Periodically pull newly opened Safari tabs into your chosen Lumi Space while Safari is running.
              </CardDescription>
            </div>
            <Switch
              checked={liveSync.enabled}
              disabled={discovery?.supported === false}
              onCheckedChange={(checked) => void handleToggleLiveSync(checked)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {discovery?.supported === false ? (
              <>
                <AlertTriangle className="size-3.5 text-amber-500" />
                <span>Live Safari AppleScript sync is available on macOS only.</span>
              </>
            ) : liveSync.lastSyncedAt ? (
              <span>
                Last synced {new Date(liveSync.lastSyncedAt).toLocaleTimeString()} ({liveSync.lastImportedCount} added)
              </span>
            ) : (
              <span>Polls Safari every {liveSync.pollIntervalSec}s without launching Safari when closed.</span>
            )}
          </div>
          {discovery?.supported !== false && (
            <Button variant="outline" size="sm" onClick={handleSyncTabsNow} disabled={isSyncingTabsNow}>
              {isSyncingTabsNow && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              Sync Open Tabs Now
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
