import { IPCListener } from "~/lumi/types";

export interface FindInPageResult {
  activeMatchOrdinal: number;
  matches: number;
}

export interface LumiFindInPageAPI {
  find: (text: string, options?: { forward?: boolean; findNext?: boolean }) => void;
  stop: (action: "clearSelection" | "keepSelection" | "activateSelection") => void;
  onResult: IPCListener<[FindInPageResult]>;
  onToggle: IPCListener<[void]>;
}
