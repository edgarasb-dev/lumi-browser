import { ThemeProvider } from "@/components/main/theme";
import { RouteConfigType } from "@/types/routes";
import type { ReactNode } from "react";

export const RouteConfig: RouteConfigType = {
  Providers: ({ children }: { children: ReactNode }) => {
    return <ThemeProvider forceTheme="dark">{children}</ThemeProvider>;
  }
};
