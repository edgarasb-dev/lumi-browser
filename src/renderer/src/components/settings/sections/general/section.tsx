import { useSettingsNavigation } from "@/components/settings/settings-layout";
import { BasicSettingsCards } from "@/components/settings/sections/general/basic-settings-cards";
import { SettingsSectionHeader } from "@/components/settings/components/setting-row";
import { SlidersHorizontal } from "lucide-react";

export function GeneralSettings() {
  const { highlightedRowId } = useSettingsNavigation();

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        title="General"
        description="Manage updates, default browser status, background tab performance, and experimental tools."
        icon={<SlidersHorizontal className="size-4" />}
      />

      <BasicSettingsCards highlightedRowId={highlightedRowId} />
    </div>
  );
}
