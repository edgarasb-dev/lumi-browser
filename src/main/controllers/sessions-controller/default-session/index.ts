import { registerProtocolsWithSession } from "../protocols";
import { app, session } from "electron";
import { setupInterceptRules } from "@/controllers/sessions-controller/intercept-rules";
import { registerPreloadScripts } from "@/controllers/sessions-controller/preload-scripts";
import { attachDownloadsToSession } from "@/controllers/downloads-controller";

function initializeDefaultSession() {
  const defaultSession = session.defaultSession;

  registerProtocolsWithSession(defaultSession, ["lumi", "lumi-internal", "lumi-external"]);

  setupInterceptRules(defaultSession);
  registerPreloadScripts(defaultSession);
  attachDownloadsToSession(defaultSession, "default");
}

export let isDefaultSessionReady = false;

export const defaultSessionReady = app.whenReady().then(() => {
  initializeDefaultSession();
  isDefaultSessionReady = true;
});
