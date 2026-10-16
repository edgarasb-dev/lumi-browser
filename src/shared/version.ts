/**
 * Spectrum Release Codenames taxonomy for Lumi Browser milestones.
 */
export const LUMI_RELEASE_CODENAMES: Record<string, string> = {
  "0.1.0": "Spark",
  "0.1.1": "Spark",
  "0.1.2": "Spark",
  "0.2.0": "Glow",
  "0.3.0": "Prism",
  "0.4.0": "Flare",
  "0.5.0": "Aurora",
  "1.0.0": "Lumina",
  "2.0.0": "Sol"
};

/**
 * Returns the release codename for a given version string, or undefined if unassigned.
 * Patch releases inherit their minor milestone codename (e.g., 0.1.1 -> Spark).
 */
export function getReleaseCodename(version: string): string | undefined {
  const cleanVersion = version.replace(/^v/, "").split("-")[0];
  if (LUMI_RELEASE_CODENAMES[cleanVersion]) {
    return LUMI_RELEASE_CODENAMES[cleanVersion];
  }
  const parts = cleanVersion.split(".");
  if (parts.length >= 2) {
    const baseVersion = `${parts[0]}.${parts[1]}.0`;
    return LUMI_RELEASE_CODENAMES[baseVersion];
  }
  return undefined;
}
