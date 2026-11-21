import { useSettings } from "@/components/providers/settings-provider";
import { BasicSettingCard } from "~/types/settings";
import { SettingsInput } from "@/components/settings/components/setting-input";
import { ResetOnboardingCard } from "@/components/settings/sections/general/reset-onboarding-card";
import { UpdateCard } from "@/components/settings/sections/general/update-card";
import { SetAsDefaultBrowserSetting } from "@/components/settings/sections/general/set-as-default-browser-setting";
import { SettingsGroup, SettingsRow } from "@/components/settings/components/setting-row";
import { cn } from "@/lib/utils";
import { Archive, Cpu, FileText, FlaskConical, RefreshCw, Layers } from "lucide-react";

export { SettingsInput };

export function BasicSettingsCard({ card, transparent }: { card: BasicSettingCard; transparent?: boolean }) {
  const { settings } = useSettings();

  if (card.title === "INTERNAL_UPDATE") return <UpdateCard />;
  if (card.title === "INTERNAL_ONBOARDING") return <ResetOnboardingCard />;

  return (
    <SettingsGroup
      title={card.title}
      description={card.subtitle}
      contentClassName={cn(transparent && "bg-white/10 dark:bg-white/[0.06] border-white/15")}
    >
      {card.settings.map((settingId) => {
        if (settingId === "internal_setAsDefaultBrowser") {
          return <SetAsDefaultBrowserSetting key={settingId} />;
        }
        const setting = settings.find((s) => s.id === settingId);
        if (!setting) return null;
        return (
          <SettingsRow key={setting.id} id={setting.id} label={setting.name} description={setting.description}>
            <SettingsInput setting={setting} />
          </SettingsRow>
        );
      })}
    </SettingsGroup>
  );
}

function BasicSettingRowItem({
  settingId,
  icon,
  highlightedRowId
}: {
  settingId: string;
  icon?: React.ReactNode;
  highlightedRowId?: string | null;
}) {
  const { settings } = useSettings();
  const setting = settings.find((s) => s.id === settingId);
  if (!setting) return null;

  return (
    <SettingsRow
      id={setting.id}
      label={setting.name}
      description={setting.description}
      icon={icon}
      highlighted={highlightedRowId === setting.id}
    >
      <SettingsInput setting={setting} />
    </SettingsRow>
  );
}

export function BasicSettingsCards({ highlightedRowId }: { highlightedRowId?: string | null }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <SettingsGroup title="Application & Updates">
        <UpdateCard highlighted={highlightedRowId === "internal_updateCheck"} />
        <BasicSettingRowItem
          settingId="autoUpdate"
          icon={<RefreshCw className="size-4" />}
          highlightedRowId={highlightedRowId}
        />
        <SetAsDefaultBrowserSetting highlighted={highlightedRowId === "internal_setAsDefaultBrowser"} />
        <BasicSettingRowItem
          settingId="syncTabsAcrossWindows"
          icon={<Layers className="size-4" />}
          highlightedRowId={highlightedRowId}
        />
      </SettingsGroup>

      <div className="space-y-6">
        <SettingsGroup
          title="Tabs & Memory Optimization"
          description="Balance responsiveness with background battery and RAM savings."
        >
          <BasicSettingRowItem
            settingId="archiveTabAfter"
            icon={<Archive className="size-4" />}
            highlightedRowId={highlightedRowId}
          />
          <BasicSettingRowItem
            settingId="sleepTabAfter"
            icon={<Cpu className="size-4" />}
            highlightedRowId={highlightedRowId}
          />
        </SettingsGroup>

        <SettingsGroup
          title="Experimental & Troubleshooting"
          description="Optional capabilities and workspace reset tools."
        >
          <BasicSettingRowItem
            settingId="enableLumiPdfViewer"
            icon={<FileText className="size-4" />}
            highlightedRowId={highlightedRowId}
          />
          <BasicSettingRowItem
            settingId="enableMv2Extensions"
            icon={<FlaskConical className="size-4" />}
            highlightedRowId={highlightedRowId}
          />
          <ResetOnboardingCard highlighted={highlightedRowId === "internal_resetOnboarding"} />
        </SettingsGroup>
      </div>
    </div>
  );
}
