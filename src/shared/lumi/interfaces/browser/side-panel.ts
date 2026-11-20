import type { IPCListener } from "~/lumi/types";

export interface SidePanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompanionWebState {
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface LumiSidePanelAPI {
  setState: (params: {
    visible: boolean;
    mode: "scratchpad" | "web";
    url?: string;
    bounds?: SidePanelBounds;
  }) => Promise<boolean>;
  navigate: (url: string) => Promise<boolean>;
  goBack: () => Promise<boolean>;
  goForward: () => Promise<boolean>;
  reload: () => Promise<boolean>;
  onStateUpdated: IPCListener<[CompanionWebState]>;
}
