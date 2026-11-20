import React from "react";
import { ShortcutAction } from "~/types/shortcuts";
import { ShortcutItem } from "../shortcut-item";
import { SettingsGroup } from "@/components/settings/components/setting-row";

interface CategorySectionProps {
  categoryName: string;
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

export function CategorySection({
  categoryName,
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
}: CategorySectionProps) {
  const modifiedCount = shortcuts.filter((kb) => kb.originalShortcut && kb.shortcut !== kb.originalShortcut).length;

  return (
    <SettingsGroup
      title={categoryName}
      badge={
        modifiedCount > 0 ? (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/12 text-primary">
            {modifiedCount} custom
          </span>
        ) : undefined
      }
    >
      {shortcuts.map((shortcut) => (
        <ShortcutItem
          key={shortcut.id}
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
          isModified={
            !!shortcut.originalShortcut && !!shortcut.shortcut && shortcut.originalShortcut !== shortcut.shortcut
          }
        />
      ))}
    </SettingsGroup>
  );
}
