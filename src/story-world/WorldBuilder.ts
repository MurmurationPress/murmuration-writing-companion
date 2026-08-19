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
  readonly icon: string;
  readonly items: readonly StoryWorldBuilderItem[];
}

export interface StoryWorldBuilderGroupProjection extends StoryWorldBuilderGroup {
  readonly collapsed: boolean;
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

const GROUPS: Array<{ key: string; label: string; icon: string; types: readonly string[] }> = [
  { key: "characters", label: "Characters", icon: "user-round", types: ["character"] },
  { key: "intelligences", label: "Intelligences", icon: "cpu", types: ["intelligence"] },
  { key: "pov-profiles", label: "POV Profiles", icon: "eye", types: ["pov-profile"] },
  { key: "locations", label: "Locations", icon: "map-pin", types: ["location", "place"] },
  { key: "organisations", label: "Organisations", icon: "building-2", types: ["organisation", "organization", "institution"] },
  { key: "events", label: "Events", icon: "calendar-clock", types: ["event"] },
  { key: "technologies", label: "Technologies", icon: "wrench", types: ["technology", "system"] },
  { key: "concepts", label: "Concepts", icon: "lightbulb", types: ["concept"] },
  { key: "references", label: "References", icon: "book-open", types: ["reference"] }
];

function normalizedType(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s_]+/gu, "-");
}

function titleWords(value: string): string[] {
  return value.trim().split(/[\s_-]+/gu).filter(Boolean)
    .map((word) => word[0].toLocaleUpperCase() + word.slice(1).toLocaleLowerCase());
}

function pluralize(word: string): string {
  if (/s$/iu.test(word)) return word;
  if (/[^aeiou]y$/iu.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(?:ch|sh|x|z)$/iu.test(word)) return `${word}es`;
  return `${word}s`;
}

export function storyWorldCustomCategoryLabel(entityType: string): string {
  const words = titleWords(entityType);
  if (!words.length) return "Custom Entities";
  words[words.length - 1] = pluralize(words[words.length - 1]);
  return words.join(" ");
}

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
      && definition.types.includes(normalizedType(item.type)))
      .sort(compareStoryWorldBuilderItems);
    if (!matches.length) continue;
    matches.forEach((item) => remaining.delete(item));
    groups.push({ key: definition.key, label: definition.label, icon: definition.icon, items: matches });
  }

  const customTypes = new Map<string, StoryWorldBuilderItem[]>();
  for (const item of items.filter((candidate) => remaining.has(candidate) && candidate.kind === "entity")) {
    const key = normalizedType(item.type);
    const matches = customTypes.get(key) ?? [];
    matches.push(item);
    customTypes.set(key, matches);
    remaining.delete(item);
  }
  const customGroups = [...customTypes.entries()].map(([type, matches]) => ({
    key: `custom:${type}`,
    label: storyWorldCustomCategoryLabel(type),
    icon: "tag",
    items: matches.sort(compareStoryWorldBuilderItems)
  })).sort((left, right) => left.label.localeCompare(right.label, "en", { sensitivity: "base" })
    || left.key.localeCompare(right.key));
  groups.push(...customGroups);

  const models = items.filter((item) => remaining.has(item) && item.kind === "model")
    .sort(compareStoryWorldBuilderItems);
  if (models.length) groups.push({ key: "models", label: "Supporting models", icon: "boxes", items: models });
  return groups;
}

export function projectStoryWorldBuilderGroups(
  items: readonly StoryWorldBuilderItem[],
  query: string,
  collapsedCategories: ReadonlySet<string>
): StoryWorldBuilderGroupProjection[] {
  const searchActive = query.trim().length > 0;
  return groupStoryWorldBuilderItems(filterStoryWorldBuilderItems(items, query)).map((group) => ({
    ...group,
    collapsed: !searchActive && collapsedCategories.has(group.key)
  }));
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
