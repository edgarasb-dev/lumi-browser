import { ipcMain } from "electron";
import { contentBlocker } from "@/modules/content-blocker";

ipcMain.handle("content-blocker:get-tab-stats", async (_event, tabId: number) => {
  return contentBlocker.getTabStats(tabId);
});

ipcMain.handle("content-blocker:toggle-domain", async (_event, domain: string, whitelisted?: boolean) => {
  return await contentBlocker.toggleDomainWhitelist(domain, whitelisted);
});

ipcMain.handle("content-blocker:get-whitelisted-domains", async () => {
  return await contentBlocker.getWhitelistedDomains();
});

ipcMain.handle("content-blocker:is-domain-whitelisted", async (_event, domain: string) => {
  await contentBlocker.loadData();
  return contentBlocker.isDomainWhitelisted(domain);
});

ipcMain.handle("content-blocker:get-total-blocked", async () => {
  return await contentBlocker.getTotalBlocked();
});
