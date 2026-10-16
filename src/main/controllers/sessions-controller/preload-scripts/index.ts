import { PATHS } from "@/modules/paths";
import type { Session } from "electron";

export function registerPreloadScripts(session: Session) {
  session.registerPreloadScript({
    id: "lumi-preload",
    type: "frame",
    filePath: PATHS.PRELOAD
  });
}
