import { Space } from "~/lumi/interfaces/sessions/spaces";
import { SpaceIconPicker } from "../icon-picker";
import { Shapes } from "lucide-react";

type SpaceIconEditorProps = {
  editedSpace: Space;
  updateEditedSpace: (updates: Partial<Space>) => void;
};

export function SpaceIconEditor({ editedSpace, updateEditedSpace }: SpaceIconEditorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shapes className="size-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Space Icon</h4>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">{editedSpace.icon || "Globe"}</span>
      </div>
      <SpaceIconPicker
        selectedIcon={editedSpace.icon || "Globe"}
        onSelectIcon={(iconId) => updateEditedSpace({ icon: iconId })}
      />
    </div>
  );
}
