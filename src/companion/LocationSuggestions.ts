import type { StoryWorldEntityRecord } from "../story-world/StoryWorldIndex";
import {
  canonicalWikilink,
  presentReferenceCandidates,
  resolvedReferenceNavigationTarget,
  type ReferencePresentation
} from "../story-world/WikilinkPresentation";

export interface LocationSuggestion extends ReferencePresentation {
  readonly entity: StoryWorldEntityRecord;
}

/** Navigation exists only after semantic resolution to an indexed Location. */
export function locationNavigationTarget(
  entity: StoryWorldEntityRecord | null | undefined
): string | null {
  return entity?.entityType.trim().toLocaleLowerCase() === "location"
    ? resolvedReferenceNavigationTarget(entity.path)
    : null;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function storedValue(entity: StoryWorldEntityRecord): string {
  const path = entity.path.replace(/\.md$/i, "");
  const basename = entity.path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
  return normalize(entity.name) === normalize(basename)
    ? canonicalWikilink(path)
    : canonicalWikilink(path, entity.name);
}

/** Shared semantic-reference presentation restricted by explicit entity classification. */
export function buildLocationSuggestions(
  entities: readonly StoryWorldEntityRecord[]
): LocationSuggestion[] {
  const locations = entities.filter(
    (entity) => entity.entityType.trim().toLocaleLowerCase() === "location"
  );
  const presented = presentReferenceCandidates(locations.map((entity) => ({
    storedValue: storedValue(entity),
    path: entity.path,
    name: entity.name,
    aliases: entity.aliases
  })));
  return presented.map((item, index) => ({ ...item, entity: locations[index] }));
}

export function locationSuggestionInputValues(
  suggestions: readonly LocationSuggestion[]
): Array<{ value: string; label: string | null }> {
  const output: Array<{ value: string; label: string | null }> = [];
  const seen = new Set<string>();
  for (const suggestion of suggestions) {
    const primary = suggestion.secondary
      ? `${suggestion.label} — ${suggestion.secondary}`
      : suggestion.label;
    for (const value of [primary, suggestion.label, ...suggestion.entity.aliases]) {
      const key = normalize(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push({ value, label: value === primary ? suggestion.secondary : suggestion.label });
    }
  }
  return output;
}

/** Preserves authored text unless it uniquely selects a semantic Location candidate. */
export function resolveLocationInput(
  value: string,
  suggestions: readonly LocationSuggestion[]
): string {
  const trimmed = value.trim();
  if (!trimmed || /^\[\[[\s\S]+\]\]$/.test(trimmed)) return trimmed;
  const key = normalize(trimmed);
  const matches = suggestions.filter((suggestion) => {
    const primary = suggestion.secondary
      ? `${suggestion.label} — ${suggestion.secondary}`
      : suggestion.label;
    return [primary, suggestion.label, ...suggestion.entity.aliases]
      .some((candidate) => normalize(candidate) === key);
  });
  return matches.length === 1 ? matches[0].storedValue : trimmed;
}
