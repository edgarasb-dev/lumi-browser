import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cloud, Compass, Inbox, Loader2, Wifi } from "lucide-react";
import type { SafariSyncState } from "~/types/safari-sync";
import { SafariBridgeCard } from "./safari-bridge-card";
import { ICloudSyncCard } from "./icloud-sync-card";
import { CompanionServerCard } from "./companion-server-card";
import { SyncInboxCard } from "./sync-inbox-card";

export function SafariSyncSettings() {
  const [state, setState] = useState<SafariSyncState | null>(null);
  const [activeTab, setActiveTab] = useState("safari");

  const loadState = useCallback(async () => {
    try {
      const next = await lumi.safariSync.getState();
      setState(next);
    } catch (error) {
      console.error("Failed to fetch Safari & Sync state:", error);
    }
  }, []);

  useEffect(() => {
    void loadState();
    const unsub = lumi.safariSync.onStateChanged((nextState) => {
      setState(nextState);
    });
    return unsub;
  }, [loadState]);

  if (!state) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground gap-2">
        <Loader2 className="size-4 animate-spin" />
        <span>Loading Safari &amp; Sync...</span>
      </div>
    );
  }

  const pendingInboxCount = state.inbox.filter((item) => item.status === "pending").length;

  return (
    <div className="space-y-6 remove-app-drag">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Safari &amp; External Sync</h2>
          <p className="text-muted-foreground text-sm">
            Connect macOS Safari, encrypted iCloud Drive snapshots, and iOS/mobile devices over local Wi-Fi.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {state.safariLiveSync.enabled && (
            <Badge variant="secondary" className="text-[11px] gap-1">
              <Compass className="size-3 text-sky-500" />
              Live Safari
            </Badge>
          )}
          {state.icloud.config.enabled && (
            <Badge variant="secondary" className="text-[11px] gap-1">
              <Cloud className="size-3 text-blue-500" />
              iCloud
            </Badge>
          )}
          {state.companion.running && (
            <Badge variant="secondary" className="text-[11px] gap-1">
              <Wifi className="size-3 text-emerald-500" />
              Wi-Fi :{state.companion.actualPort}
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-10">
          <TabsTrigger value="safari" className="text-xs gap-1.5">
            <Compass className="size-3.5" />
            <span>Safari Bridge</span>
          </TabsTrigger>
          <TabsTrigger value="icloud" className="text-xs gap-1.5">
            <Cloud className="size-3.5" />
            <span>iCloud Sync</span>
          </TabsTrigger>
          <TabsTrigger value="companion" className="text-xs gap-1.5">
            <Wifi className="size-3.5" />
            <span>Wi-Fi / Bonjour</span>
          </TabsTrigger>
          <TabsTrigger value="inbox" className="text-xs gap-1.5">
            <Inbox className="size-3.5" />
            <span>Inbox</span>
            {pendingInboxCount > 0 && (
              <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                {pendingInboxCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="safari" className="mt-4">
          <SafariBridgeCard liveSync={state.safariLiveSync} onRefreshState={() => void loadState()} />
        </TabsContent>

        <TabsContent value="icloud" className="mt-4">
          <ICloudSyncCard icloud={state.icloud} />
        </TabsContent>

        <TabsContent value="companion" className="mt-4">
          <CompanionServerCard companion={state.companion} />
        </TabsContent>

        <TabsContent value="inbox" className="mt-4">
          <SyncInboxCard platform={state.platform} inbox={state.inbox} recentActivity={state.recentActivity} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
