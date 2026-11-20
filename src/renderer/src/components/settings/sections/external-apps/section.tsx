import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { ChevronRight, Search, ShieldAlert, Loader2, BlocksIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { WebsiteFavicon } from "@/components/main/website-favicon";
import { ExternalAppPermission } from "~/lumi/interfaces/settings/openExternal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SettingsGroup, SettingsSectionHeader } from "@/components/settings/components/setting-row";

function PermissionItem({
  websiteUrl,
  protocols,
  onRevoke
}: {
  websiteUrl: string;
  protocols: string[];
  onRevoke: (url: string, protocol: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; protocol: string }>({
    isOpen: false,
    protocol: ""
  });

  return (
    <div>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronRight
            className={cn(
              "size-4 text-muted-foreground shrink-0 transition-transform duration-150",
              expanded && "rotate-90"
            )}
          />
          <WebsiteFavicon url={websiteUrl} className="size-4 shrink-0" />
          <p className="font-medium text-sm truncate" title={websiteUrl}>
            {websiteUrl}
          </p>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-muted-foreground shrink-0">
          {protocols.length} protocol{protocols.length > 1 ? "s" : ""}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="protocols-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden border-t border-black/[0.05] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]"
          >
            <div className="px-4 py-3 space-y-2">
              {protocols.map((protocol) => (
                <div
                  key={protocol}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/70 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08]"
                >
                  <span className="text-xs font-mono text-primary break-all" title={protocol}>
                    {protocol}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDialog({ isOpen: true, protocol });
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) => setConfirmDialog({ isOpen: open, protocol: open ? confirmDialog.protocol : "" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Revocation</DialogTitle>
            <DialogDescription>
              Revoke permission for <span className="font-semibold">{websiteUrl}</span> to open{" "}
              <span className="font-mono text-primary bg-muted px-1 py-0.5 rounded">{confirmDialog.protocol}</span>{" "}
              links?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setConfirmDialog({ isOpen: false, protocol: "" })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onRevoke(websiteUrl, confirmDialog.protocol);
                setConfirmDialog({ isOpen: false, protocol: "" });
              }}
            >
              Revoke Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ExternalAppsSettings({ embedded = false }: { embedded?: boolean }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [permissions, setPermissions] = useState<ExternalAppPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const revalidatePermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedPermissions = await lumi.openExternal.getAlwaysOpenExternal();
      setPermissions(fetchedPermissions);
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
      toast.error("Could not load permissions.");
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revokePermission = useCallback(
    async (url: string, protocol: string) => {
      try {
        const success = await lumi.openExternal.unsetAlwaysOpenExternal(url, protocol);
        if (success) {
          toast.success("Permission revoked.");
          void revalidatePermissions();
        } else {
          toast.error("Failed to revoke permission.");
        }
      } catch (error) {
        console.error("Failed to revoke permission:", error);
        toast.error("An error occurred while revoking permission.");
      }
    },
    [revalidatePermissions]
  );

  useEffect(() => {
    void revalidatePermissions();
  }, [revalidatePermissions]);

  const groupedPermissions = permissions.reduce<Record<string, string[]>>((acc, { requestingURL, openingProtocol }) => {
    if (!acc[requestingURL]) {
      acc[requestingURL] = [];
    }
    acc[requestingURL].push(openingProtocol);
    return acc;
  }, {});

  const filteredWebsites = Object.keys(groupedPermissions).filter(
    (url) =>
      url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      groupedPermissions[url].some((protocol) => protocol.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-5 remove-app-drag">
      {!embedded && (
        <SettingsSectionHeader
          title="External Applications"
          description="Review websites allowed to open desktop applications automatically."
          icon={<BlocksIcon className="size-4" />}
        />
      )}

      <SettingsGroup
        title="External App Protocol Permissions"
        description="Websites granted automatic launch access via custom protocols (e.g. zoommtg:, mailto:)."
      >
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter by website or protocol..."
              className="pl-8 h-8 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <Loader2 className="size-5 text-primary animate-spin mb-2" />
            <p className="text-xs text-muted-foreground">Loading protocol permissions...</p>
          </div>
        ) : filteredWebsites.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4">
            <ShieldAlert className="size-7 text-muted-foreground/70 mb-2" />
            <p className="text-sm font-medium text-foreground">
              {searchQuery ? "No matching permissions found" : "No automatic app permissions saved"}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground mt-1">
                Websites will prompt before opening external desktop apps.
              </p>
            )}
          </div>
        ) : (
          filteredWebsites.map((websiteUrl) => (
            <PermissionItem
              key={websiteUrl}
              websiteUrl={websiteUrl}
              protocols={groupedPermissions[websiteUrl]}
              onRevoke={revokePermission}
            />
          ))
        )}
      </SettingsGroup>
    </div>
  );
}
