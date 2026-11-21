import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { BasicSetting, BasicSettingCard } from "~/types/settings";

interface SettingsContextValue {
  settings: BasicSetting[];
  cards: BasicSettingCard[];
  getSetting: <T>(settingId: string) => T;
  setSetting: (settingId: string, value: unknown) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

export function useSetting<T>(settingId: string): [T, (value: T) => Promise<boolean>] {
  const { getSetting, setSetting } = useSettings();
  const value = getSetting<T>(settingId);
  const set = useCallback((newValue: T) => setSetting(settingId, newValue), [settingId, setSetting]);
  return [value, set];
}

interface SettingsProviderProps {
  children: React.ReactNode;
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const [settings, setSettings] = useState<BasicSetting[]>([]);
  const [cards, setCards] = useState<BasicSettingCard[]>([]);
  const [settingsValues, setSettingsValues] = useState<Record<string, unknown>>({});

  const fetchSettings = useCallback(async () => {
    if (!lumi) return;

    const { settings: fetchedSettings, cards: fetchedCards, values } = await lumi.settings.getBasicSettings();
    setSettings(fetchedSettings);
    setCards(fetchedCards);
    setSettingsValues(values);
  }, []);

  const revalidate = useCallback(async () => {
    if (!lumi) return;
    const values = await lumi.settings.getAllSettings();
    setSettingsValues(values);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const unsub = lumi.settings.onSettingsChanged(() => {
      void revalidate();
    });
    return () => unsub();
  }, [revalidate]);

  const getSetting = useCallback(
    (settingId: string) => {
      return settingsValues[settingId];
    },
    [settingsValues]
  );

  const setSetting = useCallback((settingId: string, value: unknown) => {
    return lumi.settings.setSetting(settingId, value);
  }, []);

  const contextValue = useMemo<SettingsContextValue>(
    () => ({
      settings,
      cards,
      getSetting: getSetting as <T>(settingId: string) => T,
      setSetting
    }),
    [settings, cards, getSetting, setSetting]
  );

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
};
