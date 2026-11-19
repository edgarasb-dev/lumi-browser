import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Compass, ExternalLink, Inbox, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { SyncActivityEntry, SyncInboxLink } from "~/types/safari-sync";

interface SyncInboxCardProps {
  platform: NodeJS.Platform;
  inbox: SyncInboxLink[];
  recentActivity: SyncActivityEntry[];
}

export function SyncInboxCard({ platform, inbox, recentActivity }: SyncInboxCardProps) {
  const handleOpenLink = async (link: SyncInboxLink) => {
    const ok = await lumi.safariSync.openInboxLink(link.id);
    if (ok) {
      toast.success(`Opened "${link.title}"`);
    } else {
      toast.error("Could not open link");
    }
  };

  const handleSaveFav = async (link: SyncInboxLink) => {
    const ok = await lumi.safariSync.saveInboxLinkToFavourites(link.id);
    if (ok) {
      toast.success("Saved to Favourites");
    }
  };

  const handleOpenInSafari = async (url: string) => {
    const ok = await lumi.safariSync.openInSafari(url);
    if (!ok) {
      toast.error("Could not launch Safari with this link");
    }
  };

  return (
    <div className="space-y-5 remove-app-drag">
      <Card className="bg-card/60 backdrop-blur-md border-border/50">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Inbox className="size-5 text-primary" />
              <CardTitle className="text-lg">Sync Inbox</CardTitle>
              {inbox.length > 0 && (
                <Badge variant="secondary" className="text-[11px]">
                  {inbox.length}
                </Badge>
              )}
            </div>
            <CardDescription>
              Links pushed from your iPhone Safari Companion or iCloud Shortcut inbox appear here.
            </CardDescription>
          </div>
          {inbox.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void lumi.safariSync.clearInbox();
                toast.success("Cleared Sync Inbox");
              }}
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Clear All
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {inbox.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-xs text-muted-foreground">
              Your Sync Inbox is empty. Share a link from mobile Safari via Wi-Fi Companion or iCloud Shortcuts.
            </div>
          ) : (
            <div className="space-y-2.5">
              {inbox.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3.5"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{item.title}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {item.sourceDevice}
                      </Badge>
                      {item.status !== "pending" && (
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {item.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{item.url}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs"
                      onClick={() => void handleOpenLink(item)}
                    >
                      <ExternalLink className="size-3 mr-1" />
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => void handleSaveFav(item)}
                      title="Save to Favourites"
                    >
                      <Star className="size-3" />
                    </Button>
                    {platform === "darwin" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => void handleOpenInSafari(item.url)}
                        title="Open in Safari"
                      >
                        <Compass className="size-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground"
                      onClick={() => void lumi.safariSync.dismissInboxLink(item.id)}
                      title="Dismiss"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur-md border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Recent Sync Activity</CardTitle>
          <CardDescription>Live audit log across Safari Bridge, iCloud Sync, and Wi-Fi Companion.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">No sync activity recorded yet.</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentActivity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                      {entry.channel}
                    </Badge>
                    <span className="truncate">{entry.message}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
