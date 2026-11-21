import { ThemeProvider } from "@/components/main/theme";
import { PortalsProvider } from "@/components/portal/provider";
import { RouteConfigType } from "@/types/routes";
import { ReactNode } from "react";

export const RouteConfig: RouteConfigType = {
  Providers: ({ children }: { children: ReactNode }) => {
    return (
      <ThemeProvider shouldApplyClass={false}>
        <PortalsProvider minIdlePortals={0}>{children}</PortalsProvider>
      </ThemeProvider>
    );
  }
};
