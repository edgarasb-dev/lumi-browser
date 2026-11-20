import { IPCListener } from "~/lumi/types";

// API //
export interface LumiActionsAPI {
  /**
   * Listen for copy link action
   */
  onCopyLink: IPCListener<[]>;

  /**
   * Listen for generic incoming actions
   */
  onIncomingAction: IPCListener<[string]>;

  /**
   * Dispatches a workspace action to the focused browser window
   */
  emitAction: (action: string) => void;
}
