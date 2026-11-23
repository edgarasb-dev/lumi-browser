// Ephemeral Data Store
// Store data such as Pending Update (for use after app restart)

import { getDatastore } from "./datastore";

const EphemeralDataStore = getDatastore("ephemeral");
const PRESERVE_SESSION_KEY = "preserveSessionOnNextLaunch";

export async function markUpdateStarted(currentAppVersion: string): Promise<boolean> {
  await EphemeralDataStore.set("appUpdatedFromVersion", currentAppVersion);
  return true;
}

export async function markPreserveSessionForRestart(): Promise<boolean> {
  await EphemeralDataStore.set(PRESERVE_SESSION_KEY, true);
  return true;
}

export async function consumePreserveSessionForRestart(): Promise<boolean> {
  const preserve = await EphemeralDataStore.get<boolean>(PRESERVE_SESSION_KEY);
  if (preserve !== undefined) {
    await EphemeralDataStore.remove(PRESERVE_SESSION_KEY);
  }
  return preserve === true;
}

export async function getVersionUpdatedFrom(): Promise<string | undefined> {
  const updatedFromVersion = await EphemeralDataStore.get<string>("appUpdatedFromVersion");
  if (updatedFromVersion !== undefined) {
    await EphemeralDataStore.remove("appUpdatedFromVersion");
  }
  if (typeof updatedFromVersion === "string") {
    return updatedFromVersion;
  }
  return undefined;
}
