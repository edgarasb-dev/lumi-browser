"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { KeyboardIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { ShortcutAction } from "~/types/shortcuts";
import { useShortcuts } from "@/components/providers/shortcuts-provider";
import { useSettingsNavigation } from "@/components/settings/settings-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "./components/empty-state";
import { ModifiedShortcutsSection } from "./components/modified-shortcuts-section";
import { CategorySection } from "./components/category-section";
import { ResetDialog } from "./components/reset-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { useKeyboardNormalizer } from "./hooks/use-keyboard-normalizer";
import { SettingsSectionHeader } from "@/components/settings/components/setting-row";

export function ShortcutsSettings() {
  const { highlightedRowId } = useSettingsNavigation();
  const { shortcuts, isLoading, setShortcut, resetShortcut, resetAllShortcuts, formatShortcutForDisplay } =
    useShortcuts();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [shortcutInputValue, setShortcutInputValue] = useState("");
  const [tempRawShortcut, setTempRawShortcut] = useState("");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLDivElement | null>(null);
  const { processKeyboardEvent } = useKeyboardNormalizer();

  const conflictingAction = useMemo(() => {
    if (!editingActionId || !tempRawShortcut) return null;
    const normalizedCandidate = tempRawShortcut.toLowerCase();
    return (
      shortcuts.find(
        (s) => s.id !== editingActionId && s.shortcut && s.shortcut.toLowerCase() === normalizedCandidate
      ) ?? null
    );
  }, [editingActionId, shortcuts, tempRawShortcut]);

  const handleEditClick = useCallback(
    (action: ShortcutAction) => {
      setEditingActionId(action.id);
      if (typeof action.shortcut === "string") {
        setTempRawShortcut(action.shortcut);
        setShortcutInputValue(formatShortcutForDisplay(action.shortcut));
      } else {
        setTempRawShortcut("");
        setShortcutInputValue("None");
      }
      setIsRecording(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [formatShortcutForDisplay]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingActionId(null);
    setShortcutInputValue("");
    setTempRawShortcut("");
    setIsRecording(false);
  }, []);

  const handleSaveEdit = useCallback(
    async (actionId: string) => {
      try {
        if (!tempRawShortcut) {
          toast.error("Record a valid shortcut first.");
          return;
        }

        const success = await setShortcut(actionId, tempRawShortcut);
        if (success) {
          if (conflictingAction) {
            toast.warning(`Shortcut saved (conflicts with "${conflictingAction.name}").`);
          } else {
            toast.success("Shortcut updated.");
          }
          handleCancelEdit();
        } else {
          toast.error("Failed to update shortcut.");
        }
      } catch (error) {
        console.error("Error saving shortcut:", error);
        toast.error("An error occurred while saving the shortcut.");
      }
    },
    [tempRawShortcut, setShortcut, conflictingAction, handleCancelEdit]
  );

  const handleResetIndividualKeybind = useCallback(
    async (action: ShortcutAction) => {
      try {
        const success = await resetShortcut(action.id);
        if (success) {
          toast.success(`Reset "${action.name}" to default.`);
          if (editingActionId === action.id) {
            handleCancelEdit();
          }
        } else {
          toast.error(`Could not reset "${action.name}".`);
        }
      } catch (error) {
        console.error("Error resetting shortcut:", error);
        toast.error("An error occurred while resetting the shortcut.");
      }
    },
    [editingActionId, resetShortcut, handleCancelEdit]
  );

  const performResetAllKeybinds = useCallback(async () => {
    try {
      await resetAllShortcuts();
      toast.success("All shortcuts reset to defaults.");
    } catch (error) {
      console.error("Failed to reset all keybinds:", error);
      toast.error("Could not reset all shortcuts.");
    }
  }, [resetAllShortcuts]);

  const handleShortcutKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const { key } = event;
      if (key === "Escape") {
        handleCancelEdit();
        return;
      }
      if (key === "Enter" && editingActionId && tempRawShortcut) {
        void handleSaveEdit(editingActionId);
        return;
      }
      if (key === "Backspace" || key === "Delete") {
        setTempRawShortcut("");
        setShortcutInputValue("");
        setIsRecording(true);
        return;
      }

      setIsRecording(true);
      const newRawShortcut = processKeyboardEvent(event);
      if (newRawShortcut) {
        setTempRawShortcut(newRawShortcut);
        setShortcutInputValue(formatShortcutForDisplay(newRawShortcut));
        setIsRecording(false);
      }
    },
    [editingActionId, formatShortcutForDisplay, handleCancelEdit, handleSaveEdit, processKeyboardEvent, tempRawShortcut]
  );

  const { groupedKeybinds, modifiedShortcuts, sortedEntries } = useMemo(() => {
    const q = debouncedSearchTerm.toLowerCase();
    const filtered = shortcuts.filter(
      (kb) =>
        kb.name.toLowerCase().includes(q) ||
        kb.category.toLowerCase().includes(q) ||
        (kb.shortcut && formatShortcutForDisplay(kb.shortcut).toLowerCase().includes(q))
    );

    const grouped = filtered.reduce(
      (acc, kb) => {
        if (!acc[kb.category]) acc[kb.category] = [];
        acc[kb.category].push(kb);
        return acc;
      },
      {} as Record<string, ShortcutAction[]>
    );

    const modified = filtered.filter(
      (kb) => !!kb.originalShortcut && !!kb.shortcut && kb.originalShortcut !== kb.shortcut
    );

    const sorted = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));

    return { groupedKeybinds: grouped, modifiedShortcuts: modified, sortedEntries: sorted };
  }, [debouncedSearchTerm, shortcuts, formatShortcutForDisplay]);

  return (
    <div className="space-y-6 remove-app-drag">
      <SettingsSectionHeader
        title="Keyboard Shortcuts"
        description="Click any binding to record a custom keystroke or reset back to Lumi defaults."
        icon={<KeyboardIcon className="size-4" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => setIsResetDialogOpen(true)} disabled={isLoading}>
            <RotateCcwIcon className="size-3.5" />
            Reset All
          </Button>
        }
      />

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filter shortcuts by action, category, or key..."
          className="pl-8 h-8 text-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <EmptyState type="loading" />
      ) : Object.keys(groupedKeybinds).length === 0 && debouncedSearchTerm ? (
        <EmptyState type="no-results" searchTerm={debouncedSearchTerm} />
      ) : Object.keys(groupedKeybinds).length === 0 ? (
        <EmptyState type="no-shortcuts" />
      ) : (
        <div className="space-y-6">
          {modifiedShortcuts.length > 0 && (
            <ModifiedShortcutsSection
              shortcuts={modifiedShortcuts}
              editingActionId={editingActionId}
              shortcutInputValue={shortcutInputValue}
              isRecording={isRecording}
              conflictName={conflictingAction?.name ?? null}
              highlightedRowId={highlightedRowId}
              inputRef={inputRef}
              formatShortcutForDisplay={formatShortcutForDisplay}
              onEditClick={handleEditClick}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onResetShortcut={handleResetIndividualKeybind}
              onKeyDown={handleShortcutKeyDown}
            />
          )}

          {sortedEntries.map(([category, items]) => (
            <CategorySection
              key={category}
              categoryName={category}
              shortcuts={items}
              editingActionId={editingActionId}
              shortcutInputValue={shortcutInputValue}
              isRecording={isRecording}
              conflictName={conflictingAction?.name ?? null}
              highlightedRowId={highlightedRowId}
              inputRef={inputRef}
              formatShortcutForDisplay={formatShortcutForDisplay}
              onEditClick={handleEditClick}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onResetShortcut={handleResetIndividualKeybind}
              onKeyDown={handleShortcutKeyDown}
            />
          ))}
        </div>
      )}

      <ResetDialog isOpen={isResetDialogOpen} onOpenChange={setIsResetDialogOpen} onConfirm={performResetAllKeybinds} />
    </div>
  );
}
