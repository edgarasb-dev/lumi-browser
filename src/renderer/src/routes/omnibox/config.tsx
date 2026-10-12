import { SettingsProvider } from "@/components/providers/settings-provider";
import { SearchEnginesProvider } from "@/components/providers/search-engines-provider";
import { SpacesProvider } from "@/components/providers/spaces-provider";
import { ThemeProvider } from "@/components/main/theme";
import { RouteConfigType } from "@/types/routes";
import { ReactNode } from "react";

export const RouteConfig: RouteConfigType = {
  Providers: ({ children }: { children: ReactNode }) => {
    return (
      <ThemeProvider>
        <SettingsProvider>
          <SearchEnginesProvider>
            <SpacesProvider windowType="none">{children}</SpacesProvider>
          </SearchEnginesProvider>
        </SettingsProvider>
      </ThemeProvider>
    );
  }
};
