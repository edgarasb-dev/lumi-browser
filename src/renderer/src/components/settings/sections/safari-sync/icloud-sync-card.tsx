import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Cloud,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  FolderOpen,
  KeyRound,
  Laptop,
  Loader2,
  RefreshCw,
  Smartphone,
  Wand2
} from "lucide-react";
import { toast } from "sonner";
import type { ICloudSyncStatus } from "~/types/safari-sync";

interface ICloudSyncCardProps {
  icloud: ICloudSyncStatus;
}

export function ICloudSyncCard({ icloud }: ICloudSyncCardProps) {
  const [passphraseInput, setPassphraseInput] = useState("");
  const [revealedPassphrase, setRevealedPassphrase] = useState<string | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isSavingPassphrase, setIsSavingPassphrase] = useState(false);
  const [showShortcutRecipe, setShowShortcutRecipe] = useState(false);

  const handleSavePassphrase = async () => {
    setIsSavingPassphrase(true);
    try {
      const res = await lumi.safariSync.setICloudPassphrase(passphraseInput);
      if (!res.success) {
        toast.error(res.error || "Invalid passphrase");
        return;
      }
      setRevealedPassphrase(passphraseInput.trim() || null);
      setPassphraseInput("");
      toast.success("Encryption passphrase saved to system keychain");
    } finally {
      setIsSavingPassphrase(false);
    }
  };

  const handleGeneratePassphrase = async () => {
    const generated = await lumi.safariSync.generateICloudPassphrase();
    setRevealedPassphrase(generated);
    setShowPassphrase(true);
    toast.success("Generated and saved AES-256 sync passphrase");
  };

  const handleToggleReveal = async () => {
    if (showPassphrase) {
      setShowPassphrase(false);
      return;
    }
    const revealed = await lumi.safariSync.revealICloudPassphrase();
    setRevealedPassphrase(revealed);
    setShowPassphrase(true);
  };

  const handleCopyText = (text: string, label: string) => {
    lumi.app.writeTextToClipboard(text);
    toast.success(`Copied ${label}`);
  };

  const handleSyncNow = async () => {
    const res = await lumi.safariSync.syncICloudNow();
    if (res.success) {
      toast.success("Encrypted sync snapshot updated in iCloud Drive");
    } else {
      toast.error(res.error || "Sync failed");
    }
  };

  const handleOpenAllRemote = async (deviceId: string, deviceName: string) => {
    const count = await lumi.safariSync.openAllRemoteDeviceTabs(deviceId, true);
    if (count > 0) {
      toast.success(`Opened ${count} tabs from ${deviceName}`);
    } else {
      toast.info(`All tabs from ${deviceName} are already open in that Space.`);
    }
  };

  return (
    <div className="space-y-5 remove-app-drag">
      <Card className="bg-card/60 backdrop-blur-md border-border/50">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Cloud className="size-5 text-blue-500" />
              <CardTitle className="text-lg">iCloud Drive Encrypted Sync</CardTitle>
              <Badge variant={icloud.icloudAvailable ? "secondary" : "outline"} className="text-[11px]">
                {icloud.icloudAvailable ? "Folder Ready" : "Custom Folder Needed"}
              </Badge>
            </div>
            <CardDescription>
              Sync an AES-256-GCM encrypted snapshot of open tabs, favourites, and history via iCloud Drive or any
              cloud-synced folder, plus watch an inbox folder for iOS Shortcuts.
            </CardDescription>
          </div>
          <Switch
            checked={icloud.config.enabled}
            onCheckedChange={(enabled) => void lumi.safariSync.updateICloudConfig({ enabled })}
          />
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Folder Location */}
          <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">Sync Folder Location</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => void lumi.safariSync.pickICloudDirectory()}
                >
                  <FolderOpen className="size-3.5 mr-1" />
                  Choose Folder
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => void lumi.safariSync.revealICloudDirectory()}
                >
                  <ExternalLink className="size-3.5 mr-1" />
                  Reveal
                </Button>
              </div>
            </div>
            <div className="font-mono text-xs text-foreground/90 break-all bg-background/60 px-3 py-2 rounded-lg border">
              {icloud.resolvedDirectory}
            </div>
          </div>

          {/* Encryption Passphrase */}
          <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-amber-500" />
                <span className="text-sm font-medium">AES-256-GCM Passphrase</span>
                <Badge variant={icloud.hasPassphrase ? "default" : "destructive"} className="text-[10px]">
                  {icloud.hasPassphrase ? "Configured" : "Required"}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                {icloud.hasPassphrase && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleToggleReveal}>
                    {showPassphrase ? <EyeOff className="size-3.5 mr-1" /> : <Eye className="size-3.5 mr-1" />}
                    {showPassphrase ? "Hide" : "Reveal"}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleGeneratePassphrase}>
                  <Wand2 className="size-3.5 mr-1" />
                  Generate Strong Key
                </Button>
              </div>
            </div>

            {showPassphrase && revealedPassphrase && (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-background/70 px-3 py-2">
                <code className="text-xs font-mono text-foreground break-all">{revealedPassphrase}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => handleCopyText(revealedPassphrase, "sync passphrase")}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={
                  icloud.hasPassphrase ? "Enter new passphrase to replace..." : "Enter shared sync passphrase..."
                }
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && passphraseInput.trim().length >= 4) {
                    void handleSavePassphrase();
                  }
                }}
              />
              <Button
                variant="secondary"
                disabled={isSavingPassphrase || passphraseInput.trim().length < 4}
                onClick={handleSavePassphrase}
              >
                Save Key
              </Button>
            </div>
          </div>

          {/* Sync Options */}
          <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-medium">Auto-Sync in Background</Label>
                <p className="text-xs text-muted-foreground">
                  Watch iCloud inbox &amp; refresh encrypted snapshot automatically
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={String(icloud.config.syncIntervalSec)}
                  onValueChange={(v) => void lumi.safariSync.updateICloudConfig({ syncIntervalSec: Number(v) })}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="remove-app-drag z-popover">
                    <SelectItem value="30">30s</SelectItem>
                    <SelectItem value="60">1 min</SelectItem>
                    <SelectItem value="300">5 min</SelectItem>
                  </SelectContent>
                </Select>
                <Switch
                  checked={icloud.config.autoSync}
                  onCheckedChange={(autoSync) => void lumi.safariSync.updateICloudConfig({ autoSync })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-medium">Merge Remote Favourites</Label>
                <p className="text-xs text-muted-foreground">Add favourites synced from your other Lumi devices</p>
              </div>
              <Switch
                checked={icloud.config.mergeRemoteFavourites}
                onCheckedChange={(mergeRemoteFavourites) =>
                  void lumi.safariSync.updateICloudConfig({ mergeRemoteFavourites })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-medium">Merge Remote History</Label>
                <p className="text-xs text-muted-foreground">Import recent history visits from other synced devices</p>
              </div>
              <Switch
                checked={icloud.config.mergeRemoteHistory}
                onCheckedChange={(mergeRemoteHistory) =>
                  void lumi.safariSync.updateICloudConfig({ mergeRemoteHistory })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-medium">Auto-Open iCloud Shortcut Links</Label>
                <p className="text-xs text-muted-foreground">
                  Immediately open links dropped into the iCloud inbox folder
                </p>
              </div>
              <Switch
                checked={icloud.config.autoOpenInboxLinks}
                onCheckedChange={(autoOpenInboxLinks) =>
                  void lumi.safariSync.updateICloudConfig({ autoOpenInboxLinks })
                }
              />
            </div>
          </div>

          {icloud.lastError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {icloud.lastError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {icloud.lastSyncedAt ? `Last synced ${new Date(icloud.lastSyncedAt).toLocaleString()}` : "Not synced yet"}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowShortcutRecipe((v) => !v)}>
                <Smartphone className="size-3.5 mr-1.5" />
                {showShortcutRecipe ? "Hide iOS Shortcut Guide" : "iOS Shortcut Setup"}
              </Button>
              <Button size="sm" onClick={handleSyncNow} disabled={icloud.isSyncing || !icloud.hasPassphrase}>
                {icloud.isSyncing ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5 mr-1.5" />
                )}
                Sync Now
              </Button>
            </div>
          </div>

          {showShortcutRecipe && (
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2.5 text-xs">
              <p className="font-semibold text-foreground">Send links from iPhone Safari via Apple Shortcuts</p>
              <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                <li>
                  Create a Shortcut in the iOS Shortcuts app enabled for &ldquo;Show in Share Sheet&rdquo; (URLs).
                </li>
                <li>
                  Add a <strong>Save File</strong> action saving the JSON snippet below (or just the URL as{" "}
                  <code>.txt</code>) into this iCloud Drive folder:
                </li>
              </ol>
              <div className="flex items-center justify-between gap-2 bg-background/70 rounded-lg border px-3 py-2">
                <code className="font-mono break-all">{icloud.iosShortcutRecipe.inboxFolderPath}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  onClick={() => handleCopyText(icloud.iosShortcutRecipe.inboxFolderPath, "inbox path")}
                >
                  <Copy className="size-3" />
                </Button>
              </div>
              <pre className="bg-background/70 rounded-lg border p-2.5 font-mono text-[11px] overflow-x-auto">
                {icloud.iosShortcutRecipe.sampleJsonPayload}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remote Synced Devices */}
      <Card className="bg-card/60 backdrop-blur-md border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Synced Devices ({icloud.remoteDevices.length})</CardTitle>
          <CardDescription>Open tabs from other Macs or devices sharing your iCloud sync folder.</CardDescription>
        </CardHeader>
        <CardContent>
          {icloud.remoteDevices.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No peer device snapshots found in your sync folder yet.
            </div>
          ) : (
            <div className="space-y-3">
              {icloud.remoteDevices.map((device) => (
                <div key={device.deviceId} className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Laptop className="size-4 text-primary" />
                      <span className="font-medium text-sm">{device.deviceName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {device.openTabs.length} tabs
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs"
                      disabled={device.openTabs.length === 0}
                      onClick={() => void handleOpenAllRemote(device.deviceId, device.deviceName)}
                    >
                      Open All in Space
                    </Button>
                  </div>
                  {device.openTabs.length > 0 && (
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {device.openTabs.slice(0, 15).map((tab) => (
                        <button
                          key={tab.uniqueId}
                          type="button"
                          onClick={() => void lumi.safariSync.openRemoteDeviceTab(tab.url)}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 text-left text-xs transition-colors cursor-pointer"
                        >
                          <span className="truncate font-medium flex-1">{tab.title}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{tab.spaceName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
