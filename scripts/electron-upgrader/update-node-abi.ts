import { updateNodeAbiDependency } from "./_modules/updater";

const REGISTRY_URL = "https://registry.npmjs.org/node-abi";

interface NpmPackageMetadata {
  "dist-tags"?: {
    latest?: string;
  };
}

export async function runUpdateNodeAbi(): Promise<void> {
  const response = await fetch(REGISTRY_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch node-abi metadata: ${response.status} ${response.statusText}`);
  }

  const meta = (await response.json()) as NpmPackageMetadata;
  const latest = meta["dist-tags"]?.latest;
  if (!latest) {
    throw new Error("npm registry returned no dist-tags.latest for node-abi");
  }

  const range = `^${latest}`;
  updateNodeAbiDependency(range);

  console.log(`Latest node-abi from registry: ${latest}`);
  console.log(`package.json devDependencies.node-abi set to ${range}`);
}

if (import.meta.main) {
  await runUpdateNodeAbi();
}
