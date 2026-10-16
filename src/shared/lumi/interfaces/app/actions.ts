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
}
