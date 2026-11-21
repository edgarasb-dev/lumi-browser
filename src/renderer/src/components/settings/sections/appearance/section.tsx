import { useSetting } from "@/components/providers/settings-provider";
import { useSettingsNavigation } from "@/components/settings/settings-layout";
import { SettingsGroup, SettingsRow, SettingsSectionHeader } from "@/components/settings/components/setting-row";
import { cn } from "@/lib/utils";
import { Palette, Monitor, Sun, Moon, Command, LayoutPanelTop, Sparkles } from "lucide-react";

type LayoutOption = {
  id: string;
  title: string;
  subtitle: string;
  layout: "sidebar" | "topbar";
  side?: "left" | "right";
};

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: "sidebar-left",
    title: "Left Sidebar",
    subtitle: "Classic vertical spaces & stacked tabs",
    layout: "sidebar",
    side: "left"
  },
  {
    id: "sidebar-right",
    title: "Right Sidebar",
    subtitle: "Vertical rail anchored on the right edge",
    layout: "sidebar",
    side: "right"
  },
  {
    id: "topbar",
    title: "Horizontal Topbar",
    subtitle: "Full-width canvas with compact top tabs",
    layout: "topbar"
  }
];

function LayoutWireframe({ layout, side }: { layout: "sidebar" | "topbar"; side?: "left" | "right" }) {
  return (
    <div className="w-full h-18 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.09] p-1.5 flex gap-1.5 overflow-hidden">
      {layout === "sidebar" && side === "left" && (
        <>
          <div className="w-9 h-full rounded-lg bg-primary/25 border border-primary/35 p-1.5 flex flex-col gap-1 shrink-0">
            <div className="flex gap-0.5">
              <span className="size-1 rounded-full bg-primary/70" />
              <span className="size-1 rounded-full bg-primary/50" />
              <span className="size-1 rounded-full bg-primary/50" />
            </div>
            <div className="h-1.5 w-full rounded-xs bg-primary/45 mt-1" />
            <div className="h-1.5 w-4/5 rounded-xs bg-primary/25" />
            <div className="h-1.5 w-3/4 rounded-xs bg-primary/25" />
          </div>
          <div className="flex-1 h-full rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-black/[0.05] dark:border-white/[0.08]" />
        </>
      )}

      {layout === "sidebar" && side === "right" && (
        <>
          <div className="flex-1 h-full rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-black/[0.05] dark:border-white/[0.08]" />
          <div className="w-9 h-full rounded-lg bg-primary/25 border border-primary/35 p-1.5 flex flex-col gap-1 shrink-0">
            <div className="h-1.5 w-full rounded-xs bg-primary/45 mt-1.5" />
            <div className="h-1.5 w-4/5 rounded-xs bg-primary/25" />
            <div className="h-1.5 w-3/4 rounded-xs bg-primary/25" />
          </div>
        </>
      )}

      {layout === "topbar" && (
        <div className="flex-1 h-full flex flex-col gap-2">
          <div className="h-5 w-full rounded-lg bg-primary/25 border border-primary/35 px-2 flex items-center gap-1.5">
            <div className="h-1.5 w-7 rounded-xs bg-primary/55" />
            <div className="h-1.5 w-7 rounded-xs bg-primary/30" />
            <div className="h-1.5 w-12 rounded-xs bg-white/70 dark:bg-white/25 ml-auto" />
          </div>
          <div className="flex-1 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-black/[0.05] dark:border-white/[0.08]" />
        </div>
      )}
    </div>
  );
}

function ThemePreviewSwatch({ mode }: { mode: "system" | "light" | "dark" }) {
  if (mode === "system") {
    return (
      <div className="h-20 w-full rounded-lg overflow-hidden border border-black/[0.08] dark:border-white/[0.1] grid grid-cols-2">
        <div className="bg-zinc-100 p-2 flex flex-col gap-1.5">
          <div className="h-1.5 w-6 rounded-full bg-zinc-300" />
          <div className="flex-1 rounded-sm bg-white border border-zinc-200/80" />
        </div>
        <div className="bg-zinc-900 p-2 flex flex-col gap-1.5">
          <div className="h-1.5 w-6 rounded-full bg-zinc-700" />
          <div className="flex-1 rounded-sm bg-zinc-800 border border-white/10" />
        </div>
      </div>
    );
  }
  const isLight = mode === "light";
  return (
    <div
      className={cn(
        "h-20 w-full rounded-lg overflow-hidden border p-2 flex gap-1.5",
        isLight ? "bg-zinc-100 border-zinc-200" : "bg-zinc-950 border-white/10"
      )}
    >
      <div className={cn("w-5 h-full rounded-sm", isLight ? "bg-zinc-200/90" : "bg-zinc-900")} />
      <div
        className={cn(
          "flex-1 h-full rounded-sm border",
          isLight ? "bg-white border-zinc-200/70" : "bg-zinc-900/90 border-white/10"
        )}
      />
    </div>
  );
}

export function AppearanceSettings() {
  const { highlightedRowId } = useSettingsNavigation();
  const [interfaceTheme = "system", setInterfaceTheme] = useSetting<"system" | "light" | "dark">("interfaceTheme");
  const [navigationLayout = "sidebar", setNavigationLayout] = useSetting<"sidebar" | "topbar">("navigationLayout");
  const [sidebarSide = "left", setSidebarSide] = useSetting<"left" | "right">("sidebarSide");
  const [paletteOpacity = "tinted", setPaletteOpacity] = useSetting<"solid" | "tinted" | "glassy">(
    "commandPaletteOpacity"
  );
  const [newTabMode = "omnibox", setNewTabMode] = useSetting<"omnibox" | "tab">("newTabMode");

  const activeLayoutId = navigationLayout === "topbar" ? "topbar" : `sidebar-${sidebarSide}`;

  const handleLayoutSelect = async (option: LayoutOption) => {
    await setNavigationLayout(option.layout);
    if (option.side) {
      await setSidebarSide(option.side);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Appearance & Layout"
        description="Tune native translucency, window chrome geometry, and new tab ergonomics."
        icon={<Palette className="size-4" />}
        className="mb-3"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Interface Appearance */}
        <SettingsGroup title="Interface Appearance" className="lg:col-span-5 flex flex-col" contentClassName="flex-1">
          <div
            data-setting-id="themeMode"
            className={cn(
              "p-3.5 space-y-3 h-full flex flex-col justify-between",
              highlightedRowId === "themeMode" && "lumi-highlight-pulse"
            )}
          >
            <div>
              <div className="text-sm font-medium text-foreground">Appearance Mode</div>
              <p className="text-xs text-muted-foreground">
                Synchronizes chrome, Settings, Command Palette &amp; pages.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "system", label: "System", icon: <Monitor className="size-3.5" /> },
                  { id: "light", label: "Light", icon: <Sun className="size-3.5" /> },
                  { id: "dark", label: "Dark", icon: <Moon className="size-3.5" /> }
                ] as const
              ).map((item) => {
                const selected = interfaceTheme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void setInterfaceTheme(item.id)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border p-2 text-left transition-all cursor-pointer",
                      selected
                        ? "border-primary bg-primary/10 dark:bg-primary/15 shadow-xs ring-1 ring-primary/30"
                        : "border-black/[0.07] dark:border-white/[0.08] bg-black/[0.025] dark:bg-white/[0.03] hover:bg-black/[0.045] dark:hover:bg-white/[0.06]"
                    )}
                  >
                    <ThemePreviewSwatch mode={item.id} />
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-semibold",
                        selected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </SettingsGroup>

        {/* Command Palette & New Tab */}
        <SettingsGroup title="Command Palette & New Tab" className="lg:col-span-7">
          <div
            data-setting-id="commandPaletteOpacity"
            className={cn("p-3.5 space-y-2.5", highlightedRowId === "commandPaletteOpacity" && "lumi-highlight-pulse")}
          >
            <div>
              <div className="text-sm font-medium text-foreground">Command Palette Material</div>
              <p className="text-xs text-muted-foreground">
                Adjust translucent depth behind the Cmd+K / Cmd+L floating Omnibox.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    id: "solid",
                    label: "Solid",
                    desc: "High contrast matte",
                    previewClass: "bg-zinc-100 dark:bg-zinc-900 border-border"
                  },
                  {
                    id: "tinted",
                    label: "Tinted",
                    desc: "Balanced Liquid Glass",
                    previewClass: "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border-primary/30"
                  },
                  {
                    id: "glassy",
                    label: "Glassy",
                    desc: "Airy clear frost",
                    previewClass: "bg-white/40 dark:bg-white/15 backdrop-blur-xl border-white/40"
                  }
                ] as const
              ).map((mat) => {
                const selected = paletteOpacity === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => void setPaletteOpacity(mat.id)}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-xl border p-2.5 text-left transition-all cursor-pointer",
                      selected
                        ? "border-primary bg-primary/10 dark:bg-primary/15 ring-1 ring-primary/30"
                        : "border-black/[0.07] dark:border-white/[0.08] bg-black/[0.025] dark:bg-white/[0.03] hover:bg-black/[0.045] dark:hover:bg-white/[0.06]"
                    )}
                  >
                    <div
                      className="h-8 w-full rounded-lg overflow-hidden relative flex items-center justify-center p-1"
                      style={{
                        background: "linear-gradient(135deg, oklch(0.58 0.2 258 / 45%), oklch(0.62 0.22 300 / 40%))"
                      }}
                    >
                      <div className={cn("h-4.5 w-4/5 rounded-md border shadow-xs", mat.previewClass)} />
                    </div>
                    <div>
                      <div className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>
                        {mat.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">{mat.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <SettingsRow
            id="newTabMode"
            highlighted={highlightedRowId === "newTabMode"}
            icon={<Sparkles className="size-4" />}
            label="New Tab Action"
            description="Opened on Cmd/Ctrl + T"
            className="py-2.5"
          >
            <div className="inline-flex rounded-xl p-0.5 bg-black/[0.05] dark:bg-white/[0.07] border border-black/[0.06] dark:border-white/[0.08]">
              {(
                [
                  { id: "omnibox", label: "Command Bar", icon: <Command className="size-3" /> },
                  { id: "tab", label: "Start Page", icon: <LayoutPanelTop className="size-3" /> }
                ] as const
              ).map((opt) => {
                const active = newTabMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => void setNewTabMode(opt.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[9px] text-xs font-medium transition-all cursor-pointer",
                      active
                        ? "bg-white/95 dark:bg-white/15 text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </SettingsRow>
        </SettingsGroup>
      </div>

      {/* Navigation Layout Wireframes */}
      <SettingsGroup title="Navigation Architecture">
        <div
          data-setting-id="navigationLayout"
          className={cn(
            "p-3.5 space-y-2.5",
            (highlightedRowId === "navigationLayout" || highlightedRowId === "sidebarSide") && "lumi-highlight-pulse"
          )}
        >
          <div>
            <div className="text-sm font-medium text-foreground">Browser Chrome Layout</div>
            <p className="text-xs text-muted-foreground">
              Changes take effect immediately across all active browser windows.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LAYOUT_OPTIONS.map((option) => {
              const selected = activeLayoutId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void handleLayoutSelect(option)}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-3 text-left transition-all cursor-pointer",
                    selected
                      ? "border-primary bg-primary/10 dark:bg-primary/15 shadow-xs ring-1 ring-primary/30"
                      : "border-black/[0.07] dark:border-white/[0.08] bg-black/[0.025] dark:bg-white/[0.03] hover:bg-black/[0.045] dark:hover:bg-white/[0.06]"
                  )}
                >
                  <LayoutWireframe layout={option.layout} side={option.side} />
                  <div>
                    <div className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>
                      {option.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{option.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SettingsGroup>
    </div>
  );
}
