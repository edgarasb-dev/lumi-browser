const SW_START_DEBUG = false;

const SW_START_TIMEOUT_MS = 10000;
const SW_INITIAL_DELAY_MS = 100;
const SW_MAX_DELAY_MS = 1000;
async function tryStartServiceWorker(session: Electron.Session, extension: Electron.Extension) {
  if (extension.manifest.manifest_version === 3 && extension.manifest.background?.service_worker) {
    const extensionId = extension.id;
    const scope = `chrome-extension://${extensionId}`;
    return await session.serviceWorkers
      .startWorkerForScope(scope)
      .then(() => true)
      .catch(() => {
        if (SW_START_DEBUG) {
          console.error(`Failed to start worker for extension ${extensionId}`);
        }
        return false;
      });
  }
  // No service worker to start
  return true;
}
export async function startExtensionServiceWorker(session: Electron.Session, extension: Electron.Extension) {
  const deadline = Date.now() + SW_START_TIMEOUT_MS;
  let tries = 0;
  let delayMs = SW_INITIAL_DELAY_MS;
  while (Date.now() < deadline) {
    tries++;
    const success = await tryStartServiceWorker(session, extension);
    if (success) {
      return { success: true, tries };
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, remaining)));
    delayMs = Math.min(SW_MAX_DELAY_MS, Math.round(delayMs * 1.6));
  }
  return { success: false, tries };
}
