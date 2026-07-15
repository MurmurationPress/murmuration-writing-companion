import type { StoryWorldEntityRecord } from "../story-world/StoryWorldIndex";

export interface PovSuggestion {
  readonly entity: StoryWorldEntityRecord;
  readonly value: string;
  readonly matches: readonly string[];
  readonly scoped: boolean;
}

function normalizeLookup(value: string): string {
  return value
    .trim()
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|", 1)[0]
    .replace(/\.md$/i, "")
    .toLowerCase();
}

function basenameWithoutExtension(path: string): string {
  const filename = path.split("/").pop() ?? path;
  return filename.replace(/\.md$/i, "");
}

function canonicalWikilink(entity: StoryWorldEntityRecord): string {
  const target = entity.path.replace(/\.md$/i, "");
  const basename = basenameWithoutExtension(entity.path);

  if (entity.name.trim().toLowerCase() === basename.trim().toLowerCase()) {
    return `[[${target}]]`;
  }

  return `[[${target}|${entity.name}]]`;
}

function isCharacter(entity: StoryWorldEntityRecord): boolean {
  return entity.entityType.trim().toLowerCase() === "character"
    || entity.facets.some((facet) => facet.trim().toLowerCase() === "character");
}

function matchesScope(
  entity: StoryWorldEntityRecord,
  scopeReferences: readonly string[]
): boolean {
  if (entity.scope.length === 0 || scopeReferences.length === 0) return false;

  const expected = new Set(scopeReferences.map(normalizeLookup).filter(Boolean));

  return entity.scope.some((scope) => {
    const normalized = normalizeLookup(scope);
    const basename = normalizeLookup(basenameWithoutExtension(normalized));
    return expected.has(normalized) || expected.has(basename);
  });
}

export function buildPovSuggestions(
  entities: readonly StoryWorldEntityRecord[],
  scopeReferences: readonly string[] = []
): PovSuggestion[] {
  return entities
    .filter(isCharacter)
    .map((entity) => {
      const matches = [entity.name, ...entity.aliases, entity.basename]
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value, index, values) => (
          values.findIndex(
            (candidate) => normalizeLookup(candidate) === normalizeLookup(value)
          ) === index
        ));

      return {
        entity,
        value: canonicalWikilink(entity),
        matches,
        scoped: matchesScope(entity, scopeReferences)
      };
    })
    .sort((left, right) => {
      if (left.scoped !== right.scoped) return left.scoped ? -1 : 1;
      if (left.entity.scope.length !== right.entity.scope.length) {
        if (left.entity.scope.length === 0) return -1;
        if (right.entity.scope.length === 0) return 1;
      }
      return left.entity.name.localeCompare(right.entity.name);
    });
}

export function resolvePovInput(
  value: string,
  suggestions: readonly PovSuggestion[]
): string {
  const trimmed = value.trim();
  if (!trimmed || /^\[\[[\s\S]+\]\]$/.test(trimmed)) return trimmed;

  const normalized = normalizeLookup(trimmed);
  const matches = suggestions.filter((suggestion) => (
    suggestion.matches.some((candidate) => normalizeLookup(candidate) === normalized)
  ));

  return matches.length === 1 ? matches[0].value : trimmed;
}

export function collectPovSuggestionValues(
  suggestions: readonly PovSuggestion[]
): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const suggestion of suggestions) {
    for (const match of suggestion.matches) {
      const key = normalizeLookup(match);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      values.push(match);
    }
  }

  return values;
}
