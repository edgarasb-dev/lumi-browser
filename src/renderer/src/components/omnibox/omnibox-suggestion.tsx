import { ArrowLeftRight, ArrowRight, Calculator, Clock, Copy, Globe, Palette, QrCode, Search } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import type { OmniboxSuggestion } from "@/lib/omnibox-new/types";
import { WebsiteFavicon } from "@/components/main/website-favicon";
import { QrCodeSvg } from "@/components/ui/qr-code";
import { cn } from "@/lib/utils";
import { PedalGlyph } from "@/components/omnibox/pedal-glyph";
import { generateTitleFromUrl } from "@/lib/omnibox-new/helpers";

function pageUrlForFavicon(suggestion: OmniboxSuggestion): string | null {
  switch (suggestion.type) {
    case "website":
    case "open-tab":
      return suggestion.url;
    default:
      return null;
  }
}

function primaryLabel(suggestion: OmniboxSuggestion): string {
  switch (suggestion.type) {
    case "search":
      return suggestion.query;
    case "website":
    case "open-tab":
    case "pedal":
    case "instant-answer":
      return suggestion.title;
  }
}

function actionHint(suggestion: OmniboxSuggestion): { label: string; show: boolean } {
  switch (suggestion.type) {
    case "open-tab":
      return { label: "Switch Tab", show: true };
    case "pedal":
      return { label: "Command", show: true };
    case "instant-answer":
      return {
        label: suggestion.kind === "qr" ? "Copy Link" : "Copy",
        show: true
      };
    default:
      return { label: "", show: false };
  }
}

interface SuggestionIconProps {
  suggestion: OmniboxSuggestion;
  selected: boolean;
  faviconUrl: string | null;
  setHasLoadedFavicon: (loaded: boolean) => void;
  className?: string;
}
function SuggestionIcon({
  suggestion,
  selected,
  faviconUrl,
  setHasLoadedFavicon,
  className
}: SuggestionIconProps): React.ReactNode {
  if (suggestion.type === "instant-answer") {
    if (suggestion.hexPreview) {
      return (
        <span
          className="size-5 rounded-md border border-black/15 shadow-xs dark:border-white/25"
          style={{ backgroundColor: suggestion.hexPreview }}
          aria-hidden
        />
      );
    }
    const iconClass = cn("size-4", selected ? "text-primary" : "text-zinc-600 dark:text-zinc-300", className);
    switch (suggestion.kind) {
      case "math":
        return <Calculator className={iconClass} strokeWidth={2} />;
      case "unit":
        return <ArrowLeftRight className={iconClass} strokeWidth={2} />;
      case "timezone":
        return <Clock className={iconClass} strokeWidth={2} />;
      case "qr":
        return <QrCode className={iconClass} strokeWidth={2} />;
      case "color":
        return <Palette className={iconClass} strokeWidth={2} />;
    }
  }
  if (suggestion.type === "pedal") {
    return <PedalGlyph className={className} action={suggestion.action} selected={selected} />;
  }
  if (suggestion.type === "search") {
    return (
      <Search
        className={cn("size-3.5", selected ? "text-primary" : "text-zinc-500 dark:text-zinc-300", className)}
        strokeWidth={2.2}
      />
    );
  }
  if (faviconUrl) {
    return (
      <WebsiteFavicon
        url={faviconUrl}
        className={cn("size-4 object-cover rounded-[3px] text-zinc-600 dark:text-zinc-100", className)}
        cacheOnly
        onLoadedChange={setHasLoadedFavicon}
      />
    );
  }
  return <Globe className={cn("size-3.5 text-zinc-500 dark:text-zinc-300", className)} strokeWidth={2} />;
}

export type OmniboxSuggestionRowProps = {
  suggestion: OmniboxSuggestion;
  index: number;
  selected: boolean;
  highlightLayoutId?: string;
  onSelect: (suggestion: OmniboxSuggestion) => void;
};

export function OmniboxSuggestionRow({
  suggestion,
  index,
  selected,
  highlightLayoutId = "omnibox-active-row",
  onSelect
}: OmniboxSuggestionRowProps) {
  const [hasLoadedFavicon, setHasLoadedFavicon] = useState(false);
  const faviconUrl = pageUrlForFavicon(suggestion);
  const title = primaryLabel(suggestion);
  const { label: actionLabel, show: showAction } = actionHint(suggestion);

  const generatedUrlTitle = suggestion.type === "website" ? generateTitleFromUrl(suggestion.url) : null;
  return (
    <div
      id={`omnibox-option-${index}`}
      role="option"
      aria-selected={selected}
      data-index={index}
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={() => {
        onSelect(suggestion);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(suggestion);
        }
      }}
      className="cursor-default outline-none"
    >
      <div
        className={cn(
          "relative flex w-full items-center gap-3 rounded-xl text-left transition-colors duration-100",
          suggestion.type === "instant-answer" ? "px-3 py-2.5" : "px-2.5 py-2.5",
          !selected && "bg-transparent hover:bg-black/4 dark:hover:bg-white/5"
        )}
      >
        {selected && (
          <motion.div
            layoutId={highlightLayoutId}
            transition={{ type: "spring", stiffness: 520, damping: 38 }}
            className="pointer-events-none absolute inset-0 rounded-xl bg-primary/14 ring-1 ring-primary/28 dark:bg-primary/22 dark:ring-primary/35"
          />
        )}
        <motion.span
          animate={{ scale: selected ? 1.08 : 1 }}
          transition={{ type: "spring", stiffness: 480, damping: 28 }}
          className={cn(
            "relative z-10 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg",
            selected && hasLoadedFavicon
              ? "bg-white shadow-xs"
              : suggestion.type === "instant-answer" || suggestion.type === "pedal"
                ? "bg-black/5 dark:bg-white/8"
                : "bg-transparent"
          )}
        >
          <SuggestionIcon
            suggestion={suggestion}
            selected={selected}
            faviconUrl={faviconUrl}
            setHasLoadedFavicon={setHasLoadedFavicon}
          />
        </motion.span>

        <div className="relative z-10 min-w-0 flex-1">
          <div className="truncate font-sans text-[14px] font-medium leading-tight">
            <span className={cn(selected ? "text-zinc-950 dark:text-white" : "text-zinc-800 dark:text-zinc-100")}>
              {title}
            </span>
            {suggestion.type === "website" && title !== generatedUrlTitle && (
              <span className={cn(selected ? "text-zinc-600 dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-400")}>
                {` — ${generatedUrlTitle}`}
              </span>
            )}
          </div>
          {suggestion.type === "instant-answer" && (
            <div className="mt-0.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400">{suggestion.subtitle}</div>
          )}
        </div>

        {suggestion.type === "instant-answer" && suggestion.qrValue && (
          <div className="relative z-10 shrink-0 rounded-lg border border-black/10 bg-white p-1 shadow-xs dark:border-white/15">
            <QrCodeSvg value={suggestion.qrValue} size={68} />
          </div>
        )}

        {showAction ? (
          <span className="relative z-10 flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "hidden font-sans text-[11px] font-medium sm:inline",
                selected ? "text-primary dark:text-blue-300" : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              {actionLabel}
            </span>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-md transition-all duration-150",
                selected
                  ? "bg-primary text-primary-foreground shadow-xs translate-x-0.5"
                  : "bg-black/6 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
              )}
            >
              {suggestion.type === "instant-answer" ? (
                <Copy className="size-3.5" strokeWidth={2.2} aria-hidden />
              ) : (
                <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden />
              )}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
