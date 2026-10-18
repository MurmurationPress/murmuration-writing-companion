import type { StoryWorldEntityRecord } from "./StoryWorldIndex";

/** Optimistic property guard: unrelated author edits are preserved. */
export function changeCharacterPov(
  properties: Record<string, unknown>,
  expected: unknown,
  profile: StoryWorldEntityRecord | null
): void {
  if (JSON.stringify(properties.pov_profile) !== JSON.stringify(expected)) {
    throw new Error("The POV association changed elsewhere. Reopen the character and try again.");
  }
  if (profile && profile.entityType.trim().toLowerCase() !== "pov-profile") {
    throw new Error("Choose an existing POV Profile.");
  }
  if (profile) properties.pov_profile = `[[${profile.path.replace(/\.md$/i, "")}]]`;
  else delete properties.pov_profile;
}
