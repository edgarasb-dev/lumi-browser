import { profilesController } from "@/controllers/profiles-controller";

const sessionEphemeralProfileIds = new Set<string>();

profilesController.on("profile-created", (profileId, profileData) => {
  if (profileData.ephemeral) {
    sessionEphemeralProfileIds.add(profileId);
  }
});

/**
 * Removes stale ephemeral profiles from disk (e.g. after an app crash or force quit).
 * A profile is considered stale if it has ephemeral: true and was not created in this session.
 */
export async function cleanupStaleEphemeralProfiles() {
  const profiles = await profilesController.getAll();
  const staleProfileIds = profiles
    .filter((profile) => profile.ephemeral && !sessionEphemeralProfileIds.has(profile.id))
    .map((profile) => profile.id);

  const cleanupPromises = staleProfileIds.map(async (profileId) => {
    await profilesController.delete(profileId);
  });
  await Promise.all(cleanupPromises);
}
