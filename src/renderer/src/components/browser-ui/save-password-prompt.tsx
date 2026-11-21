import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff, KeyRound, X } from "lucide-react";
import { PortalComponent } from "@/components/portal/portal";
import { useFocusedTabId } from "@/components/providers/tabs-provider";
import { usePasswordPrompts } from "@/components/providers/passwords-prompt-provider";
import { useBoundingRect } from "@/hooks/use-bounding-rect";
import { cn } from "@/lib/utils";
import type { PendingPasswordSavePrompt } from "~/types/passwords";

const PROMPT_WIDTH = 330;
const PROMPT_PADDING = 8;

interface SavePasswordPromptCardProps {
  prompt: PendingPasswordSavePrompt;
  onSave: (username: string, password: string) => void;
  onDismiss: (neverForSite: boolean) => void;
  onResize: (height: number) => void;
}

function SavePasswordPromptCard({ prompt, onSave, onDismiss, onResize }: SavePasswordPromptCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState(prompt.username);
  const [password, setPassword] = useState(prompt.password);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setUsername(prompt.username);
    setPassword(prompt.password);
    setShowPassword(false);
  }, [prompt.promptId, prompt.username, prompt.password]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const report = (entry?: ResizeObserverEntry) => {
      const measured = entry?.borderBoxSize?.[0]?.blockSize;
      onResize(Math.ceil(measured ?? el.getBoundingClientRect().height));
    };
    report();
    const observer = new ResizeObserver((entries) => report(entries[0]));
    observer.observe(el);
    return () => observer.disconnect();
  }, [onResize]);

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "w-full flex flex-col gap-2.5 p-3",
        "bg-neutral-900/95 backdrop-blur-md",
        "border border-white/10 rounded-xl shadow-xl",
        "text-white select-none"
      )}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <KeyRound className="size-4 text-indigo-300 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">
              {prompt.mode === "update" ? "Update password?" : "Save password?"}
            </p>
            <p className="text-[11px] text-white/60 truncate">{prompt.host}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(false)}
          aria-label="Close password prompt"
          className="p-1 rounded-md text-white/65 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-1.5">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username or email"
          className="w-full h-8 px-2.5 rounded-lg bg-white/[0.08] border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-400/60"
        />
        <div className="relative flex items-center">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full h-8 pl-2.5 pr-8 rounded-lg bg-white/[0.08] border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-indigo-400/60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1.5 p-1 rounded text-white/60 hover:text-white"
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onDismiss(true)}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          Never
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onDismiss(false)}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium text-white/75 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => onSave(username, password)}
            disabled={!password}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:opacity-45 text-white transition-colors cursor-pointer"
          >
            {prompt.mode === "update" ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function SavePasswordPrompt({ anchorRef }: { anchorRef: React.RefObject<HTMLDivElement | null> }) {
  const focusedTabId = useFocusedTabId();
  const { pendingPrompts, acceptPrompt, dismissPrompt } = usePasswordPrompts();
  const anchorRect = useBoundingRect(anchorRef);
  const [heights, setHeights] = useState<Record<number, number>>({});

  const handleResize = useCallback((tabId: number, height: number) => {
    setHeights((prev) => (prev[tabId] === height ? prev : { ...prev, [tabId]: height }));
  }, []);

  if (!anchorRect || pendingPrompts.length === 0) return null;

  return (
    <>
      {pendingPrompts.map((prompt) => {
        const height = heights[prompt.tabId];
        const portalStyle: React.CSSProperties = {
          top: anchorRect.y + PROMPT_PADDING,
          right: window.innerWidth - anchorRect.right + PROMPT_PADDING,
          width: PROMPT_WIDTH,
          ...(height !== undefined ? { height } : {})
        };

        return (
          <PortalComponent
            key={prompt.promptId}
            visible={prompt.tabId === focusedTabId}
            layerType="passkeyConditionalUI"
            className="fixed"
            style={portalStyle}
          >
            <SavePasswordPromptCard
              prompt={prompt}
              onSave={(u, p) => void acceptPrompt(prompt.promptId, u, p)}
              onDismiss={(never) => void dismissPrompt(prompt.promptId, never)}
              onResize={(h) => handleResize(prompt.tabId, h)}
            />
          </PortalComponent>
        );
      })}
    </>
  );
}
