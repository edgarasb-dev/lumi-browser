import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/providers/minimal-toast-provider";
import type { DownloadItemData } from "~/types/downloads";

interface DownloadsContextValue {
  downloads: DownloadItemData[];
  activeDownloads: DownloadItemData[];
  hasActiveDownloads: boolean;
  hasUnseenCompletedDownload: boolean;
  markDownloadsSeen: () => void;
  overallProgress: number | null;
}

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

export function useDownloads() {
  const ctx = useContext(DownloadsContext);
  if (!ctx) {
    throw new Error("useDownloads must be used within a DownloadsProvider");
  }
  return ctx;
}

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadItemData[]>([]);
  const [hasUnseenCompletedDownload, setHasUnseenCompletedDownload] = useState(false);
  const { showToast } = useToast();

  const markDownloadsSeen = useCallback(() => {
    setHasUnseenCompletedDownload(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    lumi.downloads.list().then((items) => {
      if (mounted) setDownloads(items);
    });

    const unsubChanged = lumi.downloads.onChanged((items) => {
      setDownloads(items);
    });
    const unsubEvent = lumi.downloads.onEvent((event) => {
      if (event.type === "started") {
        showToast("downloadStarted", event.item.filename);
      } else if (event.type === "completed") {
        setHasUnseenCompletedDownload(true);
        showToast("downloadCompleted", event.item.filename);
      }
    });

    return () => {
      mounted = false;
      unsubChanged();
      unsubEvent();
    };
  }, [showToast]);

  const activeDownloads = useMemo(
    () => downloads.filter((d) => d.state === "progressing" || d.state === "paused"),
    [downloads]
  );

  const overallProgress = useMemo(() => {
    if (activeDownloads.length === 0) return null;
    const knownTotals = activeDownloads.filter((d) => d.totalBytes > 0);
    if (knownTotals.length === 0) return null;
    const receivedSum = knownTotals.reduce((acc, d) => acc + d.receivedBytes, 0);
    const totalSum = knownTotals.reduce((acc, d) => acc + d.totalBytes, 0);
    if (totalSum <= 0) return null;
    return Math.min(1, Math.max(0, receivedSum / totalSum));
  }, [activeDownloads]);

  const value = useMemo<DownloadsContextValue>(
    () => ({
      downloads,
      activeDownloads,
      hasActiveDownloads: activeDownloads.length > 0,
      hasUnseenCompletedDownload,
      markDownloadsSeen,
      overallProgress
    }),
    [downloads, activeDownloads, hasUnseenCompletedDownload, markDownloadsSeen, overallProgress]
  );

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}
