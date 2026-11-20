import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckSquare,
  ExternalLink,
  Eye,
  Globe,
  Link2,
  Pencil,
  RotateCw,
  Square,
  StickyNote,
  X
} from "lucide-react";
import { useSpaces } from "@/components/providers/spaces-provider";
import { useFocusedTab } from "@/components/providers/tabs-provider";
import { useFocusMode } from "@/components/providers/focus-mode-provider";
import { useSidePanel } from "@/components/providers/side-panel-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SidePanelBounds } from "~/lumi/interfaces/browser/side-panel";

function renderInteractiveMarkdown(
  markdown: string,
  onToggleCheckbox: (lineIndex: number) => void,
  onOpenLink: (url: string) => void
) {
  const lines = markdown.split("\n");
  if (lines.length === 1 && lines[0] === "") {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        Nothing in this Space Scratchpad yet. Switch to Edit or clip a tab URL above.
      </div>
    );
  }

  return lines.map((line, index) => {
    const uncheckedMatch = line.match(/^\s*-\s+\[\s\]\s+(.*)$/);
    const checkedMatch = line.match(/^\s*-\s+\[[xX]\]\s+(.*)$/);
    if (uncheckedMatch || checkedMatch) {
      const checked = Boolean(checkedMatch);
      const label = (checkedMatch?.[1] ?? uncheckedMatch?.[1] ?? "").trim();
      return (
        <button
          key={index}
          type="button"
          onClick={() => onToggleCheckbox(index)}
          className="flex w-full items-start gap-2 rounded-lg px-2 py-1 text-left text-xs transition hover:bg-black/5 dark:hover:bg-white/6"
        >
          {checked ? (
            <CheckSquare className="mt-0.5 size-3.5 shrink-0 text-primary" />
          ) : (
            <Square className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("flex-1 leading-relaxed", checked && "text-muted-foreground line-through")}>{label}</span>
        </button>
      );
    }

    const linkMatch = line.match(/^\s*(?:[-*]\s+)?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\s*$/);
    if (linkMatch) {
      return (
        <button
          key={index}
          type="button"
          onClick={() => onOpenLink(linkMatch[2])}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3 shrink-0" />
          <span className="truncate">{linkMatch[1]}</span>
        </button>
      );
    }

    if (line.startsWith("# ")) {
      return (
        <h3 key={index} className="mt-2 px-1 text-sm font-semibold text-foreground first:mt-0">
          {line.slice(2)}
        </h3>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h4 key={index} className="mt-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {line.slice(3)}
        </h4>
      );
    }

    if (!line.trim()) {
      return <div key={index} className="h-2" />;
    }

    return (
      <p key={index} className="px-1 text-xs leading-relaxed text-foreground/90">
        {line}
      </p>
    );
  });
}

export function SidePanel() {
  const { currentSpace, isCurrentSpaceLight } = useSpaces();
  const focusedTab = useFocusedTab();
  const { isZenMode } = useFocusMode();
  const {
    isOpen,
    setOpen,
    activeMode,
    setActiveMode,
    panelWidth,
    setPanelWidth,
    companionUrl,
    setCompanionUrl,
    companionState
  } = useSidePanel();

  // Scratchpad state
  const [notes, setNotes] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Companion web URL bar state
  const [urlInput, setUrlInput] = useState(companionUrl);
  const webHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentSpace?.id) return;
    let active = true;
    void lumi.spaces.getSpaceNotes(currentSpace.id).then((content) => {
      if (active) setNotes(content || "");
    });
    return () => {
      active = false;
    };
  }, [currentSpace?.id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setUrlInput(companionState.url || companionUrl);
  }, [companionState.url, companionUrl]);

  const persistNotes = useCallback(
    (nextValue: string) => {
      setNotes(nextValue);
      if (!currentSpace?.id) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void lumi.spaces.saveSpaceNotes(currentSpace.id, nextValue).then(() => {
          setSavedNotice(true);
          setTimeout(() => setSavedNotice(false), 1200);
        });
      }, 300);
    },
    [currentSpace?.id]
  );

  const handleInsertChecklist = () => {
    const prefix = notes && !notes.endsWith("\n") ? "\n" : "";
    persistNotes(`${notes}${prefix}- [ ] `);
    setPreviewMode(false);
  };

  const handleClipActiveTab = () => {
    if (!focusedTab?.url) return;
    const label = (focusedTab.title || focusedTab.url).replace(/[[\]]/g, "");
    const prefix = notes && !notes.endsWith("\n") ? "\n" : "";
    persistNotes(`${notes}${prefix}- [${label}](${focusedTab.url})`);
  };

  const handleToggleChecklistLine = (lineIndex: number) => {
    const lines = notes.split("\n");
    const target = lines[lineIndex];
    if (!target) return;
    if (/^\s*-\s+\[\s\]\s+/.test(target)) {
      lines[lineIndex] = target.replace(/-\s+\[\s\]\s+/, "- [x] ");
    } else if (/^\s*-\s+\[[xX]\]\s+/.test(target)) {
      lines[lineIndex] = target.replace(/-\s+\[[xX]\]\s+/, "- [ ] ");
    }
    persistNotes(lines.join("\n"));
  };

  // Report measured viewport bounds to SidePanelController when in Web mode
  useLayoutEffect(() => {
    if (!isOpen || isZenMode || activeMode !== "web") return;
    const hostEl = webHostRef.current;
    if (!hostEl) return;

    const reportBounds = () => {
      const rect = hostEl.getBoundingClientRect();
      const bounds: SidePanelBounds = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
      void lumi.sidePanel.setState({
        visible: true,
        mode: "web",
        url: companionUrl,
        bounds
      });
    };

    reportBounds();
    const ro = new ResizeObserver(reportBounds);
    ro.observe(hostEl);
    window.addEventListener("resize", reportBounds);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", reportBounds);
    };
  }, [isOpen, isZenMode, activeMode, companionUrl, panelWidth]);

  // Drag resize handler
  const handleStartResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMove = (moveEvt: PointerEvent) => {
      const delta = startX - moveEvt.clientX;
      setPanelWidth(startWidth + delta);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleNavigateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = urlInput.trim();
    if (!target) return;
    setCompanionUrl(target);
    void lumi.sidePanel.navigate(target);
  };

  if (!isOpen || isZenMode) {
    return null;
  }

  return (
    <div
      className={cn(
        !isCurrentSpaceLight && "dark",
        "relative flex h-full shrink-0 items-stretch remove-app-drag select-none"
      )}
      style={{ width: panelWidth + 10 }}
    >
      {/* Left resize divider pill */}
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={handleStartResize}
        className="group flex w-2.5 shrink-0 cursor-col-resize items-center justify-center py-6"
        title="Drag to resize side panel"
      >
        <div className="h-12 w-1 rounded-full bg-black/15 transition-all group-hover:h-20 group-hover:bg-primary/65 dark:bg-white/20" />
      </div>

      {/* Side Panel Liquid Glass Container */}
      <aside className="lumi-glass-panel flex min-w-0 flex-1 flex-col overflow-hidden bg-background/85 text-foreground shadow-xl backdrop-blur-2xl">
        {/* Top Segmented Switcher */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/8 px-3 py-2 dark:border-white/10">
          <div className="flex flex-1 items-center gap-1 rounded-xl border border-black/8 bg-black/4 p-0.5 dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setActiveMode("scratchpad")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-medium transition",
                activeMode === "scratchpad"
                  ? "bg-white text-foreground shadow-xs dark:bg-white/15 dark:text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <StickyNote className="size-3.5" />
              Scratchpad
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("web")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-medium transition",
                activeMode === "web"
                  ? "bg-white text-foreground shadow-xs dark:bg-white/15 dark:text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Globe className="size-3.5" />
              Web View
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setOpen(false)}
            title="Close Side Panel (Cmd+Shift+.)"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {activeMode === "scratchpad" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-1 border-b border-black/6 px-3 py-1.5 dark:border-white/8">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={handleInsertChecklist}
                >
                  <CheckSquare className="size-3" />
                  Task
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={handleClipActiveTab}
                  disabled={!focusedTab?.url}
                  title="Append current tab URL to Space notes"
                >
                  <Link2 className="size-3" />
                  Clip URL
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                {savedNotice && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3" />
                    Saved
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={() => setPreviewMode((prev) => !prev)}
                >
                  {previewMode ? <Pencil className="size-3" /> : <Eye className="size-3" />}
                  {previewMode ? "Edit" : "Preview"}
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {previewMode ? (
                <div className="space-y-1">
                  {renderInteractiveMarkdown(notes, handleToggleChecklistLine, (url) => {
                    void lumi.tabs.newTab(url, true);
                  })}
                </div>
              ) : (
                <textarea
                  value={notes}
                  onChange={(e) => persistNotes(e.target.value)}
                  placeholder={`# ${currentSpace?.name ?? "Space"} Notes\n\n- [ ] Capture research links\n- [ ] Draft key takeaways...`}
                  className="h-full w-full resize-none bg-transparent text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <form
              onSubmit={handleNavigateSubmit}
              className="flex shrink-0 items-center gap-1 border-b border-black/6 px-2.5 py-1.5 dark:border-white/8"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                disabled={!companionState.canGoBack}
                onClick={() => void lumi.sidePanel.goBack()}
                title="Back"
              >
                <ArrowLeft className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                disabled={!companionState.canGoForward}
                onClick={() => void lumi.sidePanel.goForward()}
                title="Forward"
              >
                <ArrowRight className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => void lumi.sidePanel.reload()}
                title="Reload"
              >
                <RotateCw className={cn("size-3.5", companionState.isLoading && "animate-spin text-primary")} />
              </Button>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Companion URL..."
                className="h-7 min-w-0 flex-1 rounded-lg border border-black/10 bg-black/4 px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none dark:border-white/10 dark:bg-white/6"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => {
                  if (companionState.url) {
                    void lumi.tabs.newTab(companionState.url, true);
                  }
                }}
                title="Open in Main Tab"
              >
                <ExternalLink className="size-3.5" />
              </Button>
            </form>

            {/* Quick Presets */}
            <div className="flex shrink-0 items-center gap-1 border-b border-black/6 px-2.5 py-1 text-[10px] dark:border-white/8">
              {[
                { label: "Search", url: "https://duckduckgo.com" },
                { label: "DevDocs", url: "https://devdocs.io" },
                { label: "Wikipedia", url: "https://en.m.wikipedia.org" }
              ].map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => {
                    setCompanionUrl(preset.url);
                    setUrlInput(preset.url);
                    void lumi.sidePanel.navigate(preset.url);
                  }}
                  className="rounded-md bg-black/5 px-2 py-0.5 font-medium text-muted-foreground transition hover:bg-black/10 hover:text-foreground dark:bg-white/6 dark:hover:bg-white/12"
                >
                  {preset.label}
                </button>
              ))}
              {focusedTab?.url && focusedTab.url.startsWith("http") && (
                <button
                  type="button"
                  onClick={() => {
                    setCompanionUrl(focusedTab.url);
                    setUrlInput(focusedTab.url);
                    void lumi.sidePanel.navigate(focusedTab.url);
                  }}
                  className="ml-auto rounded-md bg-primary/12 px-2 py-0.5 font-medium text-primary transition hover:bg-primary/20"
                >
                  Load Current Tab
                </button>
              )}
            </div>

            {/* Viewport placeholder measured for Chromium WebContentsView */}
            <div
              ref={webHostRef}
              className="m-2 flex-1 overflow-hidden rounded-xl border border-black/8 bg-white/40 dark:border-white/10 dark:bg-black/25"
            />
          </div>
        )}
      </aside>
    </div>
  );
}
