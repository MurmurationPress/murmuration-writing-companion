import type { StoryWorldEntityRecord } from "./StoryWorldIndex";

export type StoryWorldBuilderKind = "entity" | "model";

export interface StoryWorldBuilderDocument {
  readonly path: string;
  readonly basename: string;
  readonly frontmatter?: Record<string, unknown> | null;
}

export interface StoryWorldBuilderItem {
  readonly path: string;
  readonly basename: string;
  readonly kind: StoryWorldBuilderKind;
  readonly type: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly scope: readonly string[];
  readonly status: string | null;
  readonly summary: string | null;
  readonly firstAppearance: string | null;
  readonly sources: readonly string[];
  readonly modelSubject: readonly string[];
  readonly worldTime: unknown;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface StoryWorldBuilderGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly StoryWorldBuilderItem[];
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function list(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    const valueText = text(item);
    if (!valueText) continue;
    const key = valueText.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(valueText);
  }
  return result;
}

export function storyWorldTimeSortValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["at", "from", "start"]) {
    const candidate = text(record[key]);
    if (candidate) return candidate;
  }
  return null;
}

export function compareStoryWorldBuilderItems(
  left: StoryWorldBuilderItem,
  right: StoryWorldBuilderItem
): number {
  const leftEvent = left.kind === "entity" && left.type.trim().toLowerCase() === "event";
  const rightEvent = right.kind === "entity" && right.type.trim().toLowerCase() === "event";
  if (leftEvent && rightEvent) {
    const leftTime = storyWorldTimeSortValue(left.worldTime);
    const rightTime = storyWorldTimeSortValue(right.worldTime);
    if (leftTime && rightTime) {
      const chronology = leftTime.localeCompare(rightTime);
      if (chronology) return chronology;
    } else if (leftTime) {
      return -1;
    } else if (rightTime) {
      return 1;
    }
  }
  return left.name.localeCompare(right.name, "en", { sensitivity: "base" })
    || left.path.localeCompare(right.path);
}

export function parseStoryWorldBuilderItem(
  document: StoryWorldBuilderDocument
): StoryWorldBuilderItem | null {
  const frontmatter = document.frontmatter;
  if (!frontmatter) return null;
  const entityType = text(frontmatter.world_entity);
  const modelType = text(frontmatter.world_model);
  if (!entityType && !modelType) return null;

  const kind: StoryWorldBuilderKind = entityType ? "entity" : "model";
  return {
    path: document.path,
    basename: document.basename,
    kind,
    type: entityType ?? modelType!,
    name: text(frontmatter.world_name) ?? text(frontmatter.title) ?? document.basename,
    aliases: list(frontmatter.aliases),
    scope: list(frontmatter.world_scope ?? frontmatter.scope),
    status: text(frontmatter.world_status ?? frontmatter.status),
    summary: text(frontmatter.world_summary),
    firstAppearance: text(frontmatter.world_first_appearance),
    sources: list(frontmatter.world_sources ?? frontmatter.source),
    modelSubject: list(frontmatter.world_model_subject ?? frontmatter.subject),
    worldTime: frontmatter.world_time,
    properties: { ...frontmatter }
  };
}

export function storyWorldBuilderItems(
  documents: readonly StoryWorldBuilderDocument[]
): StoryWorldBuilderItem[] {
  return documents
    .map(parseStoryWorldBuilderItem)
    .filter((item): item is StoryWorldBuilderItem => item !== null)
    .sort(compareStoryWorldBuilderItems);
}

const GROUPS: Array<{ key: string; label: string; types: readonly string[] }> = [
  { key: "characters", label: "Characters", types: ["character"] },
  { key: "events", label: "Events", types: ["event"] },
  { key: "locations", label: "Locations", types: ["location", "place"] },
  { key: "organisations", label: "Organisations", types: ["organisation", "organization", "institution"] },
  { key: "technologies", label: "Technologies", types: ["technology", "system"] },
  { key: "concepts", label: "Concepts", types: ["concept"] }
];

export function filterStoryWorldBuilderItems(
  items: readonly StoryWorldBuilderItem[],
  query: string
): StoryWorldBuilderItem[] {
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((item) => [item.name, item.basename, ...item.aliases]
      .some((value) => value.toLowerCase().includes(normalized)))
    : [...items];
  return filtered.sort(compareStoryWorldBuilderItems);
}

export function groupStoryWorldBuilderItems(
  items: readonly StoryWorldBuilderItem[]
): StoryWorldBuilderGroup[] {
  const groups: StoryWorldBuilderGroup[] = [];
  const remaining = new Set(items);

  for (const definition of GROUPS) {
    const matches = items.filter((item) => item.kind === "entity"
      && definition.types.includes(item.type.trim().toLowerCase()))
      .sort(compareStoryWorldBuilderItems);
    if (!matches.length) continue;
    matches.forEach((item) => remaining.delete(item));
    groups.push({ key: definition.key, label: definition.label, items: matches });
  }

  const otherEntities = items.filter((item) => remaining.has(item) && item.kind === "entity")
    .sort(compareStoryWorldBuilderItems);
  otherEntities.forEach((item) => remaining.delete(item));
  if (otherEntities.length) groups.push({ key: "other", label: "Other entities", items: otherEntities });

  const models = items.filter((item) => remaining.has(item) && item.kind === "model")
    .sort(compareStoryWorldBuilderItems);
  if (models.length) groups.push({ key: "models", label: "Supporting models", items: models });
  return groups;
}

export function builderItemFromEntity(entity: StoryWorldEntityRecord): StoryWorldBuilderItem {
  return {
    path: entity.path,
    basename: entity.basename,
    kind: "entity",
    type: entity.entityType,
    name: entity.name,
    aliases: entity.aliases,
    scope: entity.scope,
    status: entity.status,
    summary: entity.summary,
    firstAppearance: entity.firstAppearance,
    sources: entity.sources,
    modelSubject: [],
    worldTime: entity.properties.world_time,
    properties: entity.properties
  };
}
