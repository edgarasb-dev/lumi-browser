import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save, Settings, Trash2, PaintBucket, Check } from "lucide-react";
import type { Space } from "~/lumi/interfaces/sessions/spaces";
import { BasicSettingsTab, ThemeSettingsTab } from "./editor-tabs";
import { DeleteConfirmDialog } from "./space-dialogs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpaceIcon } from "@/lib/phosphor-icons";

interface SpaceEditorProps {
  space: Space;
  onClose: () => void;
  onDelete: () => void;
  onSpacesUpdate: () => void;
}

export function SpaceEditor({ space, onClose, onDelete, onSpacesUpdate }: SpaceEditorProps) {
  const [editedSpace, setEditedSpace] = useState<Space>({ ...space });
  const [activeTab, setActiveTab] = useState("theme");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateEditedSpace = (updates: Partial<Space>) => {
    setEditedSpace((prev) => ({ ...prev, ...updates }));
  };

  const hasChanges =
    editedSpace.name !== space.name ||
    editedSpace.bgStartColor !== space.bgStartColor ||
    editedSpace.bgEndColor !== space.bgEndColor ||
    editedSpace.icon !== space.icon;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updatedFields: Partial<Space> = {};
      if (editedSpace.name !== space.name) updatedFields.name = editedSpace.name;
      if (editedSpace.bgStartColor !== space.bgStartColor) updatedFields.bgStartColor = editedSpace.bgStartColor;
      if (editedSpace.bgEndColor !== space.bgEndColor) updatedFields.bgEndColor = editedSpace.bgEndColor;
      if (editedSpace.icon !== space.icon) updatedFields.icon = editedSpace.icon;

      if (Object.keys(updatedFields).length > 0) {
        await lumi.spaces.updateSpace(space.profileId, space.id, updatedFields);
        onSpacesUpdate();
        setSaveSuccess(true);
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        onClose();
      }
    } catch (error) {
      console.error("Failed to update space:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await lumi.spaces.deleteSpace(space.profileId, space.id);
      onDelete();
      onClose();
    } catch (error) {
      console.error("Failed to delete space:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 remove-app-drag">
      {/* Editor Header */}
      <div className="lumi-glass-panel rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} className="size-8 shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
          <div
            className="size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
            style={{
              background:
                editedSpace.bgStartColor && editedSpace.bgEndColor
                  ? `linear-gradient(135deg, ${editedSpace.bgStartColor}, ${editedSpace.bgEndColor})`
                  : "var(--muted)"
            }}
          >
            <SpaceIcon id={editedSpace.icon} className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">{editedSpace.name || "Untitled Space"}</h2>
            <p className="text-xs text-muted-foreground">Customize identity, colors &amp; space icon</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          {saveSuccess ? (
            <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-600">
              <Check className="size-3.5" />
              Saved
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Horizontal Segmented Tabs (No nested sidebars!) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="theme" className="text-xs gap-1.5">
            <PaintBucket className="size-3.5" />
            Theme &amp; Preview
          </TabsTrigger>
          <TabsTrigger value="basic" className="text-xs gap-1.5">
            <Settings className="size-3.5" />
            Details &amp; IDs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="theme" className="m-0">
          <ThemeSettingsTab editedSpace={editedSpace} updateEditedSpace={updateEditedSpace} />
        </TabsContent>

        <TabsContent value="basic" className="m-0">
          <BasicSettingsTab
            space={space}
            editedSpace={editedSpace}
            handleNameChange={(e) => setEditedSpace({ ...editedSpace, name: e.target.value })}
          />
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={setDeleteDialogOpen}
        spaceName={space.name}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
