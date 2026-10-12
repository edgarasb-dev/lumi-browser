import { findLatestCurrentMajorVersion, getCommitHashForTag } from "./_modules/github";
import { runBunInstall, updatePackageJson } from "./_modules/updater";
import { runUpdateNodeAbi } from "./update-node-abi";

// GRAB RELEASE FROM GITHUB //
const latestCurrentVersion = await findLatestCurrentMajorVersion();

if (!latestCurrentVersion) {
  throw new Error("No version found in current major version");
}

const commitHash = await getCommitHashForTag(latestCurrentVersion);

if (!commitHash) {
  throw new Error("No commit hash found");
}

console.log(`Latest version in current major version: ${latestCurrentVersion}`);
console.log(`Commit hash: ${commitHash}`);

// UPDATE PACKAGE.JSON //
updatePackageJson(latestCurrentVersion);

console.log("package.json updated!");

await runUpdateNodeAbi();

runBunInstall();

console.log("bun install completed (lockfile synced).");
