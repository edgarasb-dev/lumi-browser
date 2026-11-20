import React from "react";
import { ShortcutAction } from "~/types/shortcuts";
import { ShortcutItem } from "../shortcut-item";
import { SettingsGroup } from "@/components/settings/components/setting-row";

interface ModifiedShortcutsSectionProps {
  shortcuts: ShortcutAction[];
  editingActionId: string | null;
  shortcutInputValue: string;
  isRecording: boolean;
  conflictName?: string | null;
  highlightedRowId?: string | null;
  inputRef: React.RefObject<HTMLDivElement | null>;
  formatShortcutForDisplay: (shortcut: string | null) => string;
  onEditClick: (action: ShortcutAction) => void;
  onSaveEdit: (actionId: string) => void;
  onCancelEdit: () => void;
  onResetShortcut: (action: ShortcutAction) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

export function ModifiedShortcutsSection({
  shortcuts,
  editingActionId,
  shortcutInputValue,
  isRecording,
  conflictName,
  highlightedRowId,
  inputRef,
  formatShortcutForDisplay,
  onEditClick,
  onSaveEdit,
  onCancelEdit,
  onResetShortcut,
  onKeyDown
}: ModifiedShortcutsSectionProps) {
  if (shortcuts.length === 0) return null;

  return (
    <SettingsGroup title={`Custom Shortcuts (${shortcuts.length})`}>
      {shortcuts.map((shortcut) => (
        <ShortcutItem
          key={`modified-${shortcut.id}`}
          shortcut={shortcut}
          isEditing={editingActionId === shortcut.id}
          shortcutInputValue={editingActionId === shortcut.id ? shortcutInputValue : ""}
          isRecording={isRecording}
          conflictName={editingActionId === shortcut.id ? conflictName : null}
          highlighted={highlightedRowId === `shortcut-${shortcut.id}`}
          onEdit={() => onEditClick(shortcut)}
          onSave={() => onSaveEdit(shortcut.id)}
          onCancel={onCancelEdit}
          onReset={() => onResetShortcut(shortcut)}
          onKeyDown={onKeyDown}
          inputRef={inputRef}
          formatShortcutForDisplay={formatShortcutForDisplay}
          isModified={true}
        />
      ))}
    </SettingsGroup>
  );
}
