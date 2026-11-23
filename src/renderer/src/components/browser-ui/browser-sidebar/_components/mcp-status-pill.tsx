import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { McpServerStatus } from "~/types/mcp";

const RECENT_ALERT_WINDOW_MS = 5 * 60_000;

export function McpStatusPill() {
  const [status, setStatus] = useState<McpServerStatus | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof lumi?.mcp?.getStatus !== "function") return;
    let mounted = true;
    void lumi.mcp
      .getStatus()
      .then((next) => {
        if (mounted) setStatus(next);
      })
      .catch(() => undefined);

    const unsubscribe = lumi.mcp.onStatusChanged((next) => {
      if (mounted) setStatus(next);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (!status?.config.enabled || !status.running) {
    return null;
  }

  const now = Date.now();
  const recentAlerts = status.activity.filter(
    (entry) => entry.status !== "ok" && now - entry.timestamp < RECENT_ALERT_WINDOW_MS
  );
  const hasVisibleActivity = status.activeSessions > 0 || recentAlerts.length > 0;

  if (!hasVisibleActivity) {
    return null;
  }

  const leftLabel =
    recentAlerts.length > 0 ? `${recentAlerts.length} ${recentAlerts.length === 1 ? "alert" : "alerts"}` : "MCP active";
  const rightCount = `${status.activeSessions} ${status.activeSessions === 1 ? "agent" : "agents"}`;
  const recentEntries = status.activity.slice(0, 3);

  return (
    <div className="shrink-0 mt-1.5 mb-1">
      <div
        className={cn(
          "w-full rounded-xl border border-black/[0.08] dark:border-white/[0.12]",
          "bg-black/[0.05] dark:bg-white/[0.08] overflow-hidden"
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
          title="Local MCP Server Activity"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "size-2 rounded-full shrink-0",
                recentAlerts.length > 0
                  ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]"
                  : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
              )}
            />
            <span className="truncate text-[12px] font-medium text-black/85 dark:text-white/90">{leftLabel}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-[11px] text-black/55 dark:text-white/60">
            <span className="tabular-nums">{rightCount}</span>
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.16 }}
              className="border-t border-black/[0.07] dark:border-white/[0.09] px-2.5 py-2 space-y-1.5"
            >
              {recentEntries.length === 0 ? (
                <p className="text-[11px] text-black/50 dark:text-white/50">Waiting for MCP tool calls...</p>
              ) : (
                <div className="space-y-1">
                  {recentEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-2 text-[11px] min-w-0">
                      <span className="truncate font-medium text-black/80 dark:text-white/85">
                        {entry.toolName || entry.method}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] font-medium",
                          entry.status === "ok"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {entry.status === "ok" ? `${entry.durationMs}ms` : entry.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => void lumi.tabs.newTab("lumi://settings?section=mcp", true)}
                className="w-full flex items-center justify-between rounded-lg px-2 py-1 text-[11px] font-medium text-black/70 dark:text-white/75 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-pointer"
              >
                <span>Open MCP Settings</span>
                <ExternalLink className="size-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
