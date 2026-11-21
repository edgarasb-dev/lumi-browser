import { useSettings } from "@/components/providers/settings-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { BasicSetting } from "~/types/settings";

/**
 * Lightweight control renderer for a single boolean or enum BasicSetting.
 * Kept isolated from `basic-settings-cards` so chrome surfaces like `UpdateBanner`
 * do not pull the full Settings card tree into main browser windows.
 */
export function SettingsInput({ setting }: { setting: BasicSetting }) {
  const { getSetting, setSetting } = useSettings();

  const handleSettingChange = (value: BasicSetting["defaultValue"]) => {
    void setSetting(setting.id, value);
  };

  if (setting.type === "enum") {
    const settingValue = getSetting<string>(setting.id);
    return (
      <Select value={settingValue} onValueChange={handleSettingChange}>
        <SelectTrigger className="w-[155px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="remove-app-drag z-popover">
          {setting.options.map((option) => (
            <SelectItem key={option.id} value={option.id} className="text-xs">
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (setting.type === "boolean") {
    const settingValue = getSetting<boolean>(setting.id);
    return <Switch id={setting.id} checked={Boolean(settingValue)} onCheckedChange={handleSettingChange} />;
  }

  return null;
}
