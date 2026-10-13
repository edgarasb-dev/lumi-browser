export async function waitForElectronComponentsToBeReady(timeoutMs = 1500): Promise<boolean> {
  const electron = await import("electron");

  if ("components" in electron) {
    const { components } = electron;

    // @ts-ignore: This is defined in Widevine Electron, but not in the stock Electron
    const whenReady = components
      .whenReady()
      .then(() => true)
      .catch(() => false);

    const timeout = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), timeoutMs);
    });

    return Promise.race([whenReady, timeout]);
  }

  return false;
}
