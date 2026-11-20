import React from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, Edit3Icon, RotateCcwIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShortcutAction } from "~/types/shortcuts";

function ShortcutKeycaps({ formatted }: { formatted: string }) {
  if (!formatted || formatted === "None") {
    return <span className="text-xs italic text-muted-foreground px-2">Unassigned</span>;
  }

  const tokens = formatted
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className="inline-flex items-center gap-1">
      {tokens.map((token, idx) => (
        <kbd key={`${token}-${idx}`} className="lumi-kbd">
          {token}
        </kbd>
      ))}
    </div>
  );
}

interface ShortcutItemProps {
  shortcut: ShortcutAction;
  isEditing: boolean;
  shortcutInputValue: string;
  isRecording: boolean;
  conflictName?: string | null;
  highlighted?: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  inputRef: React.RefObject<HTMLDivElement | null>;
  formatShortcutForDisplay: (shortcut: string | null) => string;
  isModified: boolean;
}

export function ShortcutItem({
  shortcut,
  isEditing,
  shortcutInputValue,
  isRecording,
  conflictName,
  highlighted = false,
  onEdit,
  onSave,
  onCancel,
  onReset,
  onKeyDown,
  inputRef,
  formatShortcutForDisplay,
  isModified
}: ShortcutItemProps) {
  return (
    <div
      data-setting-id={`shortcut-${shortcut.id}`}
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 transition-colors",
        isModified && "bg-primary/[0.04]",
        isEditing && "bg-primary/[0.06]",
        highlighted && "lumi-highlight-pulse"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{shortcut.name}</span>
          {isModified && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/12 text-primary border border-primary/20">
              Custom
            </span>
          )}
        </div>
        {isEditing && conflictName && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
            Already assigned to &ldquo;{conflictName}&rdquo;. Saving will create a conflict.
          </p>
        )}
      </div>

      {isEditing ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            ref={inputRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            className={cn(
              "h-8 min-w-[140px] px-2.5 rounded-lg border bg-white/90 dark:bg-zinc-900/90 text-xs font-mono flex items-center justify-center cursor-text outline-none",
              "focus:ring-2 focus:ring-primary/35 focus:border-primary",
              isRecording ? "border-primary text-primary animate-pulse" : "border-border",
              conflictName && "border-amber-500/60"
            )}
          >
            {isRecording ? (
              <span className="text-muted-foreground italic">Press shortcut...</span>
            ) : shortcutInputValue ? (
              <ShortcutKeycaps formatted={shortcutInputValue} />
            ) : (
              <span className="text-muted-foreground italic">Type keys...</span>
            )}
          </div>
          <Button
            variant="default"
            size="icon"
            className="size-7"
            onClick={onSave}
            title="Save shortcut"
            disabled={!shortcutInputValue}
          >
            <CheckIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={onCancel} title="Cancel">
            <XIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={onReset} title="Reset to default">
            <RotateCcwIcon className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <div onClick={onEdit} className="cursor-pointer" title="Click to edit shortcut">
            <ShortcutKeycaps formatted={formatShortcutForDisplay(shortcut.shortcut)} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 opacity-65 hover:opacity-100 hover:text-primary"
            onClick={onEdit}
            title="Edit shortcut"
          >
            <Edit3Icon className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
