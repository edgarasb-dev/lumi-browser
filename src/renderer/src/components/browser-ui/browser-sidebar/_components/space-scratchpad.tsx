import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpaces } from "@/components/providers/spaces-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/portal/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotebookPen, Copy, Check, Trash2 } from "lucide-react";

export const SpaceScratchpad = memo(function SpaceScratchpad() {
  const { currentSpace, isCurrentSpaceLight } = useSpaces();
  const currentSpaceId = currentSpace?.id;
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [hasNotes, setHasNotes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const spaceInjectedClasses = cn(isCurrentSpaceLight ? "" : "dark");

  // Load notes for current space
  useEffect(() => {
    if (!currentSpaceId) return;

    flow.spaces.getSpaceNotes(currentSpaceId).then((savedNotes) => {
      setContent(savedNotes || "");
      setHasNotes(!!savedNotes && savedNotes.trim().length > 0);
    });
  }, [currentSpaceId]);

  // Debounced auto-save
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setContent(newText);
      setHasNotes(newText.trim().length > 0);
      setIsSaving(true);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (currentSpaceId) {
          await flow.spaces.saveSpaceNotes(currentSpaceId, newText);
          setIsSaving(false);
        }
      }, 400);
    },
    [currentSpaceId]
  );

  const handleCopy = useCallback(() => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  const handleClear = useCallback(async () => {
    if (!currentSpaceId || !content) return;
    setContent("");
    setHasNotes(false);
    await flow.spaces.saveSpaceNotes(currentSpaceId, "");
  }, [currentSpaceId, content]);

  // Calculate statistics
  const wordCount = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [content]);

  const charCount = content.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Button
        size="icon"
        className={cn(
          "size-8 bg-transparent hover:bg-black/10 dark:hover:bg-white/10 relative transition-colors",
          hasNotes && "text-primary"
        )}
        asChild
        title={`Scratchpad for ${currentSpace?.name || "Space"}`}
      >
        <PopoverTrigger nativeButton={true}>
          <NotebookPen strokeWidth={2} className="w-4 h-4 text-black/80 dark:text-white/80" />
          {hasNotes && (
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-blue-500 ring-2 ring-background" />
          )}
        </PopoverTrigger>
      </Button>

      <PopoverContent
        variant="translucent"
        className={cn(
          "w-84 select-none p-3.5 flex flex-col gap-2.5 font-sans rounded-2xl shadow-2xl backdrop-blur-xl border border-black/10 dark:border-white/15",
          "h-96"
        )}
        positionerClassName={spaceInjectedClasses}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-6 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <NotebookPen className="size-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-black dark:text-white truncate">
                {currentSpace?.name || "Space"} Scratchpad
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="size-7 rounded-lg text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
              onClick={handleCopy}
              disabled={!content}
              title="Copy notes to clipboard"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 rounded-lg text-black/60 dark:text-white/60 hover:text-red-500 dark:hover:text-red-400"
              onClick={handleClear}
              disabled={!content}
              title="Clear notes"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Textarea Editor */}
        <div className="flex-1 min-h-0 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            placeholder={`Notes, links, code snippets, or thoughts for ${currentSpace?.name || "this space"}...\n\nAuto-saved continuously.`}
            className={cn(
              "w-full h-full resize-none bg-transparent outline-none border-0 p-1 text-xs",
              "text-black/90 dark:text-white/90 placeholder:text-black/40 dark:placeholder:text-white/40",
              "font-mono leading-relaxed selection:bg-blue-500/30"
            )}
            spellCheck={false}
          />
        </div>

        {/* Footer info & stats */}
        <div className="pt-2 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[10px] text-black/50 dark:text-white/50 shrink-0">
          <span>
            {wordCount} {wordCount === 1 ? "word" : "words"} • {charCount} chars
          </span>
          <span className="flex items-center gap-1 font-medium">
            {isSaving ? (
              <span className="text-amber-500">Saving...</span>
            ) : (
              <span className="text-emerald-500/80">✓ Saved</span>
            )}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
});
