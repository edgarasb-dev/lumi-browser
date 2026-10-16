import { transformPathForRequest } from "../../utils";
import { type Protocol } from "electron";
import { Hono } from "hono/tiny";
import { registerStaticDomainsRoutes } from "../../static-domains";

// Create Hono App
const app = new Hono({
  getPath: transformPathForRequest
});
export type HonoApp = typeof app;

// Register Routes
// None currently

// Catch-all Routes
registerStaticDomainsRoutes("lumi-external", app);

// Export Protocol Handler
export function registerLumiExternalProtocol(protocol: Protocol) {
  protocol.handle("lumi-external", async (request) => {
    return app.fetch(request);
  });
}
