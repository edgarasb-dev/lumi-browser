import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Profile } from "~/lumi/interfaces/sessions/profiles";
import type { PrivacySettingsPane } from "~/lumi/interfaces/settings/importer";
import type {
  BrowserImportResult,
  DetectedBrowser,
  HtmlBookmarkImportResult,
  ImportCategoryCounts,
  ImportDataCategory
} from "~/types/importer";

const ALL_CATEGORIES: ImportDataCategory[] = [
  "bookmarks",
  "history",
  "pinnedTabs",
  "searchEngines",
  "passwords",
  "sessions"
];

export function formatImportSummary(result: BrowserImportResult): string {
  const parts: string[] = [];
  if (result.imported.bookmarks > 0) {
    parts.push(`${result.imported.bookmarks.toLocaleString()} bookmarks`);
  }
  if (result.imported.history > 0) {
    parts.push(`${result.imported.history.toLocaleString()} history items`);
  }
  if (result.imported.pinnedTabs > 0) {
    parts.push(`${result.imported.pinnedTabs.toLocaleString()} pinned tabs`);
  }
  if (result.imported.searchEngines > 0) {
    parts.push(`${result.imported.searchEngines.toLocaleString()} search engines`);
  }
  if (result.imported.passwords > 0) {
    parts.push(`${result.imported.passwords.toLocaleString()} passwords`);
  }
  if (result.imported.sessions > 0) {
    if (result.sessionDetails) {
      const s = result.sessionDetails;
      const storageCount = s.localStorageOrigins + s.indexedDbOrigins;
      const segs: string[] = [];
      if (s.cookies > 0) segs.push(`${s.cookies.toLocaleString()} cookies`);
      if (storageCount > 0) segs.push(`${storageCount.toLocaleString()} site storage entries`);
      if (segs.length > 0) parts.push(segs.join(" & "));
    } else {
      parts.push(`${result.imported.sessions.toLocaleString()} session items`);
    }
  }

  if (parts.length === 0) {
    return `Everything selected from ${result.browserName} (${result.profileName}) is already in Lumi.`;
  }
  return `Imported ${parts.join(", ")} from ${result.browserName} (${result.profileName}).`;
}

export function useBrowserImporter() {
  const [browsers, setBrowsers] = useState<DetectedBrowser[]>([]);
  const [lumiProfiles, setLumiProfiles] = useState<Profile[]>([]);
  const [targetProfileId, setTargetProfileId] = useState<string>("main");
  const [selectedBrowserId, setSelectedBrowserId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<ImportDataCategory>>(
    () => new Set<ImportDataCategory>(["bookmarks", "history"])
  );

  const [isScanning, setIsScanning] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingHtml, setIsImportingHtml] = useState(false);
  const [lastResult, setLastResult] = useState<BrowserImportResult | null>(null);
  const [lastHtmlResult, setLastHtmlResult] = useState<HtmlBookmarkImportResult | null>(null);

  const previewCacheRef = useRef(new Map<string, ImportCategoryCounts>());
  const selectedBrowserIdRef = useRef<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);

  useEffect(() => {
    selectedBrowserIdRef.current = selectedBrowserId;
  }, [selectedBrowserId]);

  const loadInitial = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsScanning(true);
    }
    try {
      const [detected, profiles] = await Promise.all([
        lumi.importer.scanBrowsers(),
        lumi.profiles.getProfiles().catch(() => [] as Profile[])
      ]);

      setBrowsers(detected);
      const userProfiles = profiles.filter((p) => !p.internal);
      setLumiProfiles(userProfiles);
      if (userProfiles.length > 0) {
        setTargetProfileId((prev) => (userProfiles.some((p) => p.id === prev) ? prev : userProfiles[0].id));
      }

      const firstUsable = detected.find((b) => b.profiles.length > 0) ?? detected[0] ?? null;
      const activeBrowser = detected.find((b) => b.id === selectedBrowserIdRef.current) ?? firstUsable;
      setSelectedBrowserId(activeBrowser?.id ?? null);
      const defaultProfile = activeBrowser?.profiles.find((p) => p.isDefault) ?? activeBrowser?.profiles[0] ?? null;
      setSelectedProfileId((prev) => {
        if (prev && activeBrowser?.profiles.some((p) => p.id === prev)) return prev;
        return defaultProfile?.id ?? null;
      });
    } catch (error) {
      console.error("Failed scanning installed browsers:", error);
    } finally {
      if (!silent) {
        setIsScanning(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const hasPermissionBlocked = useMemo(() => browsers.some((b) => Boolean(b.permissionRequired)), [browsers]);

  // Automatically re-check access when user returns from System Settings
  useEffect(() => {
    if (!hasPermissionBlocked) return;
    const handleFocus = () => {
      previewCacheRef.current.clear();
      void loadInitial({ silent: true });
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [hasPermissionBlocked, loadInitial]);

  const selectedBrowser = useMemo(
    () => browsers.find((b) => b.id === selectedBrowserId) ?? null,
    [browsers, selectedBrowserId]
  );

  const selectedProfile = useMemo(
    () => selectedBrowser?.profiles.find((p) => p.id === selectedProfileId) ?? selectedBrowser?.profiles[0] ?? null,
    [selectedBrowser, selectedProfileId]
  );

  // When browser changes, auto-select its default profile
  const selectBrowser = useCallback(
    (browserId: string) => {
      setSelectedBrowserId(browserId);
      setLastResult(null);
      const target = browsers.find((b) => b.id === browserId);
      const defProfile = target?.profiles.find((p) => p.isDefault) ?? target?.profiles[0] ?? null;
      setSelectedProfileId(defProfile?.id ?? null);
    },
    [browsers]
  );

  const selectProfile = useCallback((profileId: string) => {
    setSelectedProfileId(profileId);
    setLastResult(null);
  }, []);

  const cacheKey =
    selectedBrowser && selectedProfile ? `${selectedBrowser.id}::${selectedProfile.id}::${targetProfileId}` : null;
  const previewCounts = useMemo(() => {
    void previewVersion;
    return cacheKey ? (previewCacheRef.current.get(cacheKey) ?? null) : null;
  }, [cacheKey, previewVersion]);

  const applyDefaultCategoriesForProfile = useCallback(
    (profile: DetectedBrowser["profiles"][number], counts: ImportCategoryCounts | null) => {
      const next = new Set<ImportDataCategory>();
      for (const cat of ALL_CATEGORIES) {
        if (!profile.available[cat]) continue;
        if (counts && counts[cat] === 0) continue;
        next.add(cat);
      }
      setSelectedCategories(next);
    },
    []
  );

  // Fetch live item counts for the active (browser, profile, targetProfileId) tuple and update category defaults
  useEffect(() => {
    if (!selectedBrowser || !selectedProfile) return;

    const key = `${selectedBrowser.id}::${selectedProfile.id}::${targetProfileId}`;
    const cached = previewCacheRef.current.get(key);
    if (cached) {
      applyDefaultCategoriesForProfile(selectedProfile, cached);
      return;
    }

    applyDefaultCategoriesForProfile(selectedProfile, null);
    let cancelled = false;
    setIsPreviewing(true);

    lumi.importer
      .previewProfile(selectedBrowser.id, selectedProfile.id, targetProfileId)
      .then((counts) => {
        if (cancelled) return;
        previewCacheRef.current.set(key, counts);
        setPreviewVersion((v) => v + 1);
        applyDefaultCategoriesForProfile(selectedProfile, counts);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsPreviewing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBrowser, selectedProfile, targetProfileId, applyDefaultCategoriesForProfile]);

  const toggleCategory = useCallback((cat: ImportDataCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const runImport = useCallback(async () => {
    if (!selectedBrowser || !selectedProfile || selectedCategories.size === 0) return null;

    setIsImporting(true);
    setLastResult(null);
    try {
      const result = await lumi.importer.importFromBrowser({
        browserId: selectedBrowser.id,
        profileId: selectedProfile.id,
        targetProfileId,
        categories: Array.from(selectedCategories)
      });
      setLastResult(result);

      // Re-compute remaining unimported counts across all cached profiles so imported categories immediately switch to "Already imported"
      const key = `${selectedBrowser.id}::${selectedProfile.id}::${targetProfileId}`;
      previewCacheRef.current.clear();
      try {
        const freshCounts = await lumi.importer.previewProfile(selectedBrowser.id, selectedProfile.id, targetProfileId);
        previewCacheRef.current.set(key, freshCounts);
        setPreviewVersion((v) => v + 1);
        applyDefaultCategoriesForProfile(selectedProfile, freshCounts);
      } catch {
        // Ignore preview refresh error
      }

      return result;
    } finally {
      setIsImporting(false);
    }
  }, [selectedBrowser, selectedProfile, selectedCategories, targetProfileId, applyDefaultCategoriesForProfile]);

  const runHtmlImport = useCallback(async () => {
    setIsImportingHtml(true);
    setLastHtmlResult(null);
    try {
      const res = await lumi.importer.importFromHtmlFile();
      setLastHtmlResult(res);
      previewCacheRef.current.clear();
      setPreviewVersion((v) => v + 1);
      return res;
    } finally {
      setIsImportingHtml(false);
    }
  }, []);

  const rescan = useCallback(async () => {
    previewCacheRef.current.clear();
    setPreviewVersion((v) => v + 1);
    setLastResult(null);
    await loadInitial();
  }, [loadInitial]);

  const openPrivacySettings = useCallback((pane?: PrivacySettingsPane) => {
    return lumi.importer.openPrivacySettings(pane);
  }, []);

  return {
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
  };
}
