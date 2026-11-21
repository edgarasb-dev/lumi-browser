import { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import type { Space } from "~/lumi/interfaces/sessions/spaces";
import { BackgroundGradientEditor } from "@/components/settings/sections/spaces/theme-editors/background-gradient";
import { SettingsGroup, SettingsRow } from "@/components/settings/components/setting-row";

interface BasicSettingsTabProps {
  space: Space;
  editedSpace: Space;
  handleNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function BasicSettingsTab({ space, editedSpace, handleNameChange }: BasicSettingsTabProps) {
  return (
    <div className="space-y-4">
      <SettingsGroup title="Space Identity">
        <SettingsRow label="Space Name" description="Displayed in the space switcher and window accents.">
          <Input
            id="space-name"
            value={editedSpace.name}
            onChange={handleNameChange}
            placeholder="Enter space name"
            className="w-56 h-8 text-xs"
          />
        </SettingsRow>
        <SettingsRow label="Space ID" description="Unique internal identifier.">
          <code className="text-[11px] font-mono text-muted-foreground bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1 rounded-md border border-black/[0.05] dark:border-white/[0.08]">
            {space.id}
          </code>
        </SettingsRow>
        <SettingsRow label="Profile ID" description="Browser profile owning this space.">
          <code className="text-[11px] font-mono text-muted-foreground bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1 rounded-md border border-black/[0.05] dark:border-white/[0.08]">
            {space.profileId}
          </code>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}

interface ThemeSettingsTabProps {
  editedSpace: Space;
  updateEditedSpace: (updates: Partial<Space>) => void;
}

export function ThemeSettingsTab({ editedSpace, updateEditedSpace }: ThemeSettingsTabProps) {
  return (
    <div className="lumi-glass-panel rounded-2xl p-5">
      <BackgroundGradientEditor editedSpace={editedSpace} updateEditedSpace={updateEditedSpace} />
    </div>
  );
}
