/**
 * Main entrypoint after conditions met in index.ts
 */

// Import everything
import "@/controllers";
import "@/ipc";
import "@/modules/content-blocker";
import "@/modules/extensions/main";
import { setupPlatformIntegration } from "@/app/platform";
import { processInitialUrl } from "@/app/urls";
import { setupSecondInstanceHandling } from "@/app/instance";
import { runOnboardingOrInitialWindow } from "@/app/onboarding";
import { setupAppLifecycle } from "@/app/lifecycle";
import { tabPersistenceManager } from "@/saving/tabs";
import { initCursorEdgeMonitor } from "@/controllers/windows-controller/utils/cursor-edge-monitor";
import { cleanupStaleEphemeralProfiles } from "@/controllers/profiles-controller/ephemeral";
import { initTabSync } from "@/controllers/tabs-controller/tab-sync";
import { pinnedTabsController } from "@/controllers/pinned-tabs-controller";
import { downloadsController } from "@/controllers/downloads-controller";
import { setupBasicAuthHandler } from "@/app/basic-auth";

function bootstrapBrowser() {
  // Prioritize onboarding / initial BrowserWindow creation at the front of app.whenReady()
  runOnboardingOrInitialWindow();

  // Handle initial URL (runs asynchronously)
  processInitialUrl();

  // Setup second instance handler & app lifecycle events
  setupSecondInstanceHandling();
  setupAppLifecycle();
  setupBasicAuthHandler();

  // Start tab persistence flush interval (writes dirty tabs to disk every ~2s)
  tabPersistenceManager.start();

  // Load pinned tabs and downloads history from database into memory (synchronous — better-sqlite3)
  pinnedTabsController.loadAll();
  downloadsController.loadAll();

  // Start cursor edge monitor (detects pointer near window edges for floating sidebar)
  initCursorEdgeMonitor();

  // Defer secondary platform dock/task integration and tab sync listener setup off the critical launch tick
  setImmediate(() => {
    initTabSync();
    setupPlatformIntegration();
  });

  // Clean up crashed/leftover ephemeral profiles in the background without blocking startup window paint
  setTimeout(() => {
    void cleanupStaleEphemeralProfiles().catch((error) => {
      console.error("Failed to cleanup stale ephemeral profiles:", error);
    });
  }, 1500);
}

void bootstrapBrowser();
