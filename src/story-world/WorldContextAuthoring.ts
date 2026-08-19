import { normalizePropertyName } from "../companion/ChapterContext";
import { StoryWorldEntityRecord } from "./StoryWorldIndex";

export type ResolveWorldContextReference = (
  reference: string
) => StoryWorldEntityRecord | null;

export interface WorldContextMutationPlan {
  readonly changed: boolean;
  readonly property: string;
  readonly values: readonly unknown[];
}

export class InvalidWorldContextPropertyError extends Error {
  constructor() {
    super("The Scene's world_context property is not a string or list and was left unchanged.");
    this.name = "InvalidWorldContextPropertyError";
  }
}

function propertyName(frontmatter: Readonly<Record<string, unknown>>): string {
  const expected = normalizePropertyName("world_context");
  return Object.keys(frontmatter).find((property) => (
    property !== "position" && normalizePropertyName(property) === expected
  )) ?? "world_context";
}

function propertyValues(
  frontmatter: Readonly<Record<string, unknown>>,
  property: string
): unknown[] {
  const current = frontmatter[property];
  if (current === undefined || current === null) return [];
  if (Array.isArray(current)) return [...current];
  if (typeof current === "string") return [current];
  throw new InvalidWorldContextPropertyError();
}

function sameEntity(
  value: unknown,
  entity: StoryWorldEntityRecord,
  resolve: ResolveWorldContextReference
): boolean {
  return typeof value === "string" && resolve(value)?.path === entity.path;
}

function withoutMarkdownExtension(path: string): string {
  return path.replace(/\.md$/iu, "");
}

/**
 * Chooses the shortest readable reference that the established resolver maps
 * back to the selected indexed entity. Path qualification is the final,
 * deterministic fallback; ambiguous canonical names are never guessed.
 */
export function serializeWorldContextEntityReference(
  entity: StoryWorldEntityRecord,
  resolve: ResolveWorldContextReference
): string {
  const candidates = [
    `[[${entity.name}]]`,
    `[[${entity.basename}]]`,
    `[[${withoutMarkdownExtension(entity.path)}]]`
  ];

  for (const candidate of new Set(candidates)) {
    if (resolve(candidate)?.path === entity.path) return candidate;
  }

  throw new Error(`The indexed entity “${entity.name}” cannot be serialized as an unambiguous wikilink.`);
}

export function planWorldContextAddition(
  frontmatter: Readonly<Record<string, unknown>>,
  entity: StoryWorldEntityRecord,
  resolve: ResolveWorldContextReference
): WorldContextMutationPlan {
  const property = propertyName(frontmatter);
  const values = propertyValues(frontmatter, property);
  if (values.some((value) => sameEntity(value, entity, resolve))) {
    return { changed: false, property, values };
  }

  return {
    changed: true,
    property,
    values: [...values, serializeWorldContextEntityReference(entity, resolve)]
  };
}

/** Removes only explicit values resolving to the selected entity identity. */
export function planWorldContextRemoval(
  frontmatter: Readonly<Record<string, unknown>>,
  entity: StoryWorldEntityRecord,
  resolve: ResolveWorldContextReference
): WorldContextMutationPlan {
  const property = propertyName(frontmatter);
  const values = propertyValues(frontmatter, property);
  const retained = values.filter((value) => !sameEntity(value, entity, resolve));
  return {
    changed: retained.length !== values.length,
    property,
    values: retained
  };
}

export function searchWorldContextCandidates(
  entities: readonly StoryWorldEntityRecord[],
  query: string,
  entityType = ""
): StoryWorldEntityRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase().replace(/[_-]+/gu, " ");
  const normalizedType = entityType.trim().toLocaleLowerCase();

  return entities
    .filter((entity) => !normalizedType
      || entity.entityType.trim().toLocaleLowerCase() === normalizedType)
    .filter((entity) => {
      if (!normalizedQuery) return true;
      return [entity.name, ...entity.aliases].some((value) => (
        value.toLocaleLowerCase().replace(/[_-]+/gu, " ").includes(normalizedQuery)
      ));
    })
    .sort((left, right) => {
      const leftEvent = left.entityType.trim().toLocaleLowerCase() === "event";
      const rightEvent = right.entityType.trim().toLocaleLowerCase() === "event";
      if (leftEvent !== rightEvent) return leftEvent ? -1 : 1;
      return left.name.localeCompare(right.name) || left.path.localeCompare(right.path);
    });
}
