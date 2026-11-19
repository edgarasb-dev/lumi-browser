import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { QrCodeSvg } from "@/components/ui/qr-code";
import { Copy, Radio, RefreshCw, Smartphone, Wifi } from "lucide-react";
import { toast } from "sonner";
import type { LocalCompanionStatus } from "~/types/safari-sync";

interface CompanionServerCardProps {
  companion: LocalCompanionStatus;
}

export function CompanionServerCard({ companion }: CompanionServerCardProps) {
  const [portInput, setPortInput] = useState(String(companion.config.port));

  const handleCopy = (value: string, label: string) => {
    lumi.app.writeTextToClipboard(value);
    toast.success(`Copied ${label}`);
  };

  const handleApplyPort = async () => {
    const parsed = Number(portInput);
    if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535) {
      toast.error("Port must be between 1024 and 65535.");
      return;
    }
    await lumi.safariSync.updateCompanionConfig({ port: parsed });
    toast.success("Companion port updated");
  };

  const handleRotatePairing = async () => {
    await lumi.safariSync.regenerateCompanionPairing();
    toast.success("Generated a fresh pairing code and QR token");
  };

  return (
    <div className="space-y-5 remove-app-drag">
      <Card className="bg-card/60 backdrop-blur-md border-border/50">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Wifi className="size-5 text-emerald-500" />
              <CardTitle className="text-lg">Local Wi-Fi &amp; Bonjour Companion</CardTitle>
              <Badge variant={companion.running ? "default" : "secondary"} className="text-[11px]">
                {companion.running ? `Live on :${companion.actualPort}` : "Stopped"}
              </Badge>
              {companion.bonjourActive && (
                <Badge variant="outline" className="text-[11px] gap-1">
                  <Radio className="size-3 text-emerald-500" />
                  Bonjour Active
                </Badge>
              )}
            </div>
            <CardDescription>
              Serve a mobile Safari companion web app on your local Wi-Fi with real-time WebSocket sync and Bonjour
              discovery — scan the QR code from your iPhone camera.
            </CardDescription>
          </div>
          <Switch
            checked={companion.config.enabled}
            onCheckedChange={(enabled) => void lumi.safariSync.updateCompanionConfig({ enabled })}
          />
        </CardHeader>

        <CardContent className="space-y-5">
          {companion.lastError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {companion.lastError}
            </div>
          )}

          {companion.running && companion.primaryPairUrl ? (
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-center rounded-2xl border bg-muted/20 p-4">
              <div className="flex flex-col items-center gap-2">
                <div className="p-2.5 rounded-2xl bg-white shadow-sm border">
                  <QrCodeSvg value={companion.primaryPairUrl} size={164} />
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Smartphone className="size-3" />
                  Scan with iPhone Camera
                </span>
              </div>

              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-xs text-muted-foreground">6-Digit Pairing Code</div>
                    <div className="text-2xl font-bold font-mono tracking-widest text-foreground">
                      {companion.pairingCode}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {companion.connectedClients} live client{companion.connectedClients === 1 ? "" : "s"}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={handleRotatePairing}>
                      <RefreshCw className="size-3.5 mr-1.5" />
                      Rotate Token
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Local Wi-Fi URLs</div>
                  {companion.urls.map((url) => (
                    <div
                      key={url}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-background/70 px-3 py-1.5"
                    >
                      <code className="text-xs font-mono truncate">{url}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => handleCopy(url, "companion URL")}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  ))}
                  {companion.bonjourUrl && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border bg-background/70 px-3 py-1.5">
                      <code className="text-xs font-mono truncate">{companion.bonjourUrl}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => handleCopy(companion.bonjourUrl!, "Bonjour URL")}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
              Turn on the Local Wi-Fi Companion switch above to generate a QR code and start WebSocket sync.
            </div>
          )}

          {/* Settings */}
          <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-medium">Advertise via Bonjour ({companion.bonjourServiceType})</Label>
                <p className="text-xs text-muted-foreground">
                  Broadcast Lumi on your local network using macOS Bonjour / mDNS
                </p>
              </div>
              <Switch
                checked={companion.config.advertiseBonjour}
                onCheckedChange={(advertiseBonjour) => void lumi.safariSync.updateCompanionConfig({ advertiseBonjour })}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-medium">Auto-Open Received Links</Label>
                <p className="text-xs text-muted-foreground">
                  Open links sent to Inbox immediately in your active Lumi window
                </p>
              </div>
              <Switch
                checked={companion.config.autoOpenReceivedLinks}
                onCheckedChange={(autoOpenReceivedLinks) =>
                  void lumi.safariSync.updateCompanionConfig({ autoOpenReceivedLinks })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Label htmlFor="companion-port" className="text-sm font-medium">
                Server Port
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="companion-port"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value)}
                  className="w-28 h-8 text-xs font-mono"
                />
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleApplyPort}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
