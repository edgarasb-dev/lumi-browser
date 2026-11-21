import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MousePointerClick,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SettingsGroup, SettingsRow, SettingsSectionHeader } from "@/components/settings/components/setting-row";
import { useSettingsNavigation } from "@/components/settings/settings-layout";
import { cn } from "@/lib/utils";
import type { Profile } from "~/lumi/interfaces/sessions/profiles";
import type { McpAccessMode, McpServerStatus } from "~/types/mcp";

type ClientTabId = "http" | "claude-code" | "claude-desktop";

const ACCESS_TIERS: Array<{
  id: McpAccessMode;
  label: string;
  subtitle: string;
  icon: typeof Lock;
}> = [
  {
    id: "read-only",
    label: "Read Only",
    subtitle: "Inspect tabs, Spaces, Reader Mode text, snapshots, screenshots, history & bookmarks.",
    icon: Eye
  },
  {
    id: "interactive",
    label: "Interactive (Recommended)",
    subtitle: "Read tools plus open/close tabs, switch Spaces, Split View, navigate, click, type & scroll.",
    icon: MousePointerClick
  },
  {
    id: "full",
    label: "Full Automation",
    subtitle: "Interactive tools plus optional page JavaScript evaluation via lumi_evaluate_js.",
    icon: Terminal
  }
];

const CLIENT_TABS: Array<{ id: ClientTabId; label: string }> = [
  { id: "http", label: "Antigravity / Cursor / HTTP" },
  { id: "claude-code", label: "Claude Code CLI" },
  { id: "claude-desktop", label: "Claude Desktop (Stdio)" }
];

function maskToken(token: string): string {
  if (token.length <= 14) return "••••••••••••";
  return `${token.slice(0, 12)}••••••••••••${token.slice(-4)}`;
}

export function McpSettings() {
  const { highlightedRowId } = useSettingsNavigation();
  const [status, setStatus] = useState<McpServerStatus | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [portDraft, setPortDraft] = useState("47321");
  const [showToken, setShowToken] = useState(false);
  const [clientTab, setClientTab] = useState<ClientTabId>("http");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void lumi.mcp.getStatus().then((initial) => {
      setStatus(initial);
      setPortDraft(String(initial.config.port));
    });
    void lumi.profiles.getProfiles().then((list) => {
      setProfiles(list.filter((p) => !p.internal));
    });
    const unsubscribe = lumi.mcp.onStatusChanged((next) => {
      setStatus(next);
    });
    return unsubscribe;
  }, []);

  const copyText = async (id: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      toast.success(`${label} copied to clipboard`);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    setBusy(true);
    try {
      const next = await lumi.mcp.setEnabled(enabled);
      setStatus(next);
      toast.success(next.running ? `MCP server listening on ${next.listeningUrl}` : "MCP server stopped");
    } finally {
      setBusy(false);
    }
  };

  const applyPort = async () => {
    const parsed = Number(portDraft.trim());
    if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535) {
      toast.error("Port must be an integer between 1024 and 65535");
      return;
    }
    setBusy(true);
    try {
      const next = await lumi.mcp.updateConfig({ port: parsed });
      setStatus(next);
      setPortDraft(String(next.config.port));
      toast.success(`Updated MCP loopback port to ${next.config.port}`);
    } finally {
      setBusy(false);
    }
  };

  const updateAccessMode = async (accessMode: McpAccessMode) => {
    const next = await lumi.mcp.updateConfig({
      accessMode,
      allowExternalJs: accessMode === "full" ? status?.config.allowExternalJs : false
    });
    setStatus(next);
  };

  const rotateToken = async () => {
    const next = await lumi.mcp.rotateToken();
    setStatus(next);
    toast.success("Generated new MCP Bearer token and reset active sessions");
  };

  if (!status) {
    return (
      <div className="space-y-5">
        <SettingsSectionHeader
          title="Local MCP Server"
          description="Loading MCP runtime configuration..."
          icon={<PlugZap className="size-4.5" />}
        />
      </div>
    );
  }

  const activeSnippet =
    clientTab === "http"
      ? status.snippets.httpJson
      : clientTab === "claude-code"
        ? status.snippets.claudeCodeCommand
        : status.snippets.claudeDesktopJson;

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        title="Local MCP Server"
        description="Expose your live Lumi workspace (tabs, Spaces, Reader View, screenshots, history & bookmarks) to external AI agents over local Model Context Protocol — disabled by default."
        icon={<PlugZap className="size-4.5" />}
        actions={
          <div className="flex items-center gap-3 rounded-xl border border-black/[0.07] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.04] px-3 py-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <span
                className={cn(
                  "size-2 rounded-full",
                  status.running
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)] animate-pulse"
                    : status.error
                      ? "bg-rose-500"
                      : "bg-zinc-400"
                )}
              />
              {status.running ? `Live · :${status.config.port}` : status.error ? "Error" : "Stopped"}
            </span>
            <Switch checked={status.config.enabled} disabled={busy} onCheckedChange={toggleEnabled} />
          </div>
        }
      />

      {status.error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-300">
          <strong>Server error:</strong> {status.error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Server Scope & Security */}
        <div className="lg:col-span-6 space-y-5">
          <SettingsGroup
            title="Access Tier & Scoping"
            description="Choose which actions external MCP agents are permitted to run."
          >
            <div className="p-3.5 space-y-2">
              {ACCESS_TIERS.map((tier) => {
                const Icon = tier.icon;
                const selected = status.config.accessMode === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => updateAccessMode(tier.id)}
                    className={cn(
                      "w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer",
                      selected
                        ? "border-primary/50 bg-primary/10 ring-1 ring-primary/25"
                        : "border-black/[0.06] dark:border-white/[0.08] bg-black/[0.015] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-black/5 dark:bg-white/8 text-muted-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">{tier.label}</span>
                        {selected && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{tier.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <SettingsRow
              id="mcpProfileScope"
              highlighted={highlightedRowId === "mcpProfileScope"}
              label="Allowed Profile"
              description="Lock MCP tools to one isolated Lumi Profile or allow all non-internal profiles."
            >
              <Select
                value={status.config.allowedProfileId}
                onValueChange={(value) => void lumi.mcp.updateConfig({ allowedProfileId: value })}
              >
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Profiles</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              id="mcpAllowJs"
              highlighted={highlightedRowId === "mcpAllowJs"}
              label="Allow Script Execution (lumi_evaluate_js)"
              description="Explicitly opt in to executing JavaScript inside tabs (requires Full Automation tier)."
            >
              <Switch
                checked={status.config.allowExternalJs}
                disabled={status.config.accessMode !== "full"}
                onCheckedChange={(checked) => void lumi.mcp.updateConfig({ allowExternalJs: checked })}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup
            title="Authentication & Loopback Guard"
            description="Bound strictly to 127.0.0.1 with web Origin blocking to prevent browser CSRF attacks."
          >
            <SettingsRow
              id="mcpPort"
              highlighted={highlightedRowId === "mcpPort"}
              label="Loopback Port"
              description="Local Streamable HTTP endpoint (127.0.0.1 only)."
            >
              <div className="flex items-center gap-1.5">
                <Input
                  value={portDraft}
                  onChange={(e) => setPortDraft(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-24 h-8 text-xs font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs cursor-pointer"
                  onClick={() => void applyPort()}
                  disabled={busy || Number(portDraft) === status.config.port}
                >
                  Apply
                </Button>
              </div>
            </SettingsRow>

            <SettingsRow
              id="mcpToken"
              highlighted={highlightedRowId === "mcpToken"}
              label="Bearer Token"
              description="Required in Authorization header for every MCP client request."
            >
              <div className="flex items-center gap-1.5">
                <code className="max-w-[140px] truncate rounded-md border border-black/[0.07] dark:border-white/[0.1] bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1 font-mono text-[11px]">
                  {showToken ? status.config.token : maskToken(status.config.token)}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 cursor-pointer"
                  onClick={() => setShowToken((prev) => !prev)}
                  title={showToken ? "Hide token" : "Reveal token"}
                >
                  {showToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 cursor-pointer"
                  onClick={() => void copyText("token", status.config.token, "MCP token")}
                  title="Copy Bearer token"
                >
                  {copiedId === "token" ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 cursor-pointer"
                  onClick={() => void rotateToken()}
                  title="Rotate token"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              </div>
            </SettingsRow>

            <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 font-medium">
                <ShieldCheck className="size-3" /> Loopback Only
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                <KeyRound className="size-3" /> Constant-Time Bearer Auth
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] dark:bg-white/[0.08] px-2 py-0.5 font-medium">
                Web Origin Blocked
              </span>
            </div>
          </SettingsGroup>
        </div>

        {/* Right Column: Client Config Snippets & Live Activity Log */}
        <div className="lg:col-span-6 space-y-5">
          <SettingsGroup
            title="Connect External Agents"
            description="Paste into your editor or AI client config while Lumi is running."
          >
            <div className="p-3.5 space-y-3">
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.03] p-1">
                {CLIENT_TABS.map((tab) => {
                  const active = clientTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setClientTab(tab.id)}
                      className={cn(
                        "relative flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap",
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="mcp-client-tab"
                          className="absolute inset-0 rounded-lg bg-background shadow-xs border border-black/[0.07] dark:border-white/[0.1]"
                          transition={{ type: "spring", stiffness: 460, damping: 34 }}
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-zinc-950/95 p-3.5 text-zinc-100">
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute right-2.5 top-2.5 h-7 gap-1.5 text-[11px] cursor-pointer"
                  onClick={() => void copyText(`snippet-${clientTab}`, activeSnippet, "Client config")}
                >
                  {copiedId === `snippet-${clientTab}` ? (
                    <>
                      <Check className="size-3 text-emerald-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy
                    </>
                  )}
                </Button>
                <pre className="overflow-x-auto pr-20 font-mono text-[11px] leading-relaxed text-sky-100/95">
                  {activeSnippet}
                </pre>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>Active sessions: {status.activeSessions}</span>
                <span>Total MCP calls: {status.totalRequests}</span>
              </div>
            </div>
          </SettingsGroup>

          <SettingsGroup
            title="Live Agent Activity"
            description="Real-time audit trail of incoming MCP requests."
            actions={
              status.activity.length > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs cursor-pointer"
                  onClick={() => void lumi.mcp.clearActivity()}
                >
                  <Trash2 className="size-3" /> Clear
                </Button>
              ) : undefined
            }
          >
            <div className="max-h-72 overflow-y-auto divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {status.activity.length === 0 ? (
                <div className="px-4 py-8 text-center space-y-1">
                  <Activity className="size-5 mx-auto text-muted-foreground/60" />
                  <p className="text-xs font-medium text-foreground">No MCP activity yet</p>
                  <p className="text-[11px] text-muted-foreground">
                    Enable the server above and connect Antigravity, Claude Code, Claude Desktop, or Cursor.
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {status.activity.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.16 }}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-foreground truncate">
                            {entry.toolName ?? entry.method}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              entry.status === "ok" && "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
                              entry.status === "denied" && "bg-amber-500/12 text-amber-600 dark:text-amber-400",
                              entry.status === "error" && "bg-rose-500/12 text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {entry.status}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">{entry.summary}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                        {entry.durationMs}ms
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </SettingsGroup>
        </div>
      </div>
    </div>
  );
}
