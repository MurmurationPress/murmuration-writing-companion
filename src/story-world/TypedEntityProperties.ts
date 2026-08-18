import type { StoryWorldEntityRecord } from "./StoryWorldIndex";
import {
  canonicalWikilink,
  presentReferenceCandidates,
  type ReferencePresentation
} from "./WikilinkPresentation";

export type StoryWorldTypedPropertyValueType = "text" | "number" | "date" | "url" | "entity-reference";
export type StoryWorldTypedPropertyCardinality = "single" | "multiple";
export type StoryWorldTypedPropertyValidation = "iana-timezone" | "latitude" | "longitude";

export interface StoryWorldTypedPropertyDefinition {
  readonly property: string;
  readonly label: string;
  readonly valueType: StoryWorldTypedPropertyValueType;
  readonly cardinality: StoryWorldTypedPropertyCardinality;
  readonly targetEntityTypes?: readonly string[];
  readonly validation?: StoryWorldTypedPropertyValidation;
  readonly contextUseful?: boolean;
}

export const REFERENCE_TYPED_PROPERTY_NAMES = {
  authors: "reference_authors",
  title: "reference_title",
  date: "reference_date",
  publication: "reference_publication",
  publisher: "reference_publisher",
  volume: "reference_volume",
  issue: "reference_issue",
  pages: "reference_pages",
  doi: "reference_doi",
  link: "reference_link"
} as const;

export const LOCATION_TYPED_PROPERTY_NAMES = {
  address: "address",
  latitude: "latitude",
  longitude: "longitude",
  timezone: "timezone",
  parent: "parent_location"
} as const;

const REFERENCE_PROPERTIES: readonly StoryWorldTypedPropertyDefinition[] = [
  { property: REFERENCE_TYPED_PROPERTY_NAMES.authors, label: "Authors", valueType: "text", cardinality: "multiple" },
  { property: REFERENCE_TYPED_PROPERTY_NAMES.title, label: "Title", valueType: "text", cardinality: "single" },
  { property: REFERENCE_TYPED_PROPERTY_NAMES.date, label: "Publication year or date", valueType: "date", cardinality: "single" },
  { property: REFERENCE_TYPED_PROPERTY_NAMES.publication, label: "Journal / publication", valueType: "text", cardinality: "single" },
  { property: REFERENCE_TYPED_PROPERTY_NAMES.publisher, label: "Publisher", valueType: "text", cardinality: "single" },
  { property: REFERENCE_TYPED_PROPERTY_NAMES.volume, label: "Volume", valueType: "text", cardinality: "single" },
  { property: REFERENCE_TYPED_PROPERTY_NAMES.issue, label: "Issue", valueType: "text", cardinality: "single" },
  { property: REFERENCE_TYPED_PROPERTY_NAMES.pages, label: "Pages", valueType: "text", cardinality: "single" },
  { property: REFERENCE_TYPED_PROPERTY_NAMES.doi, label: "DOI", valueType: "text", cardinality: "single" },
  { property: REFERENCE_TYPED_PROPERTY_NAMES.link, label: "Canonical link", valueType: "url", cardinality: "single" }
];

const LOCATION_PROPERTIES: readonly StoryWorldTypedPropertyDefinition[] = [
  { property: LOCATION_TYPED_PROPERTY_NAMES.address, label: "Address", valueType: "text", cardinality: "single", contextUseful: true },
  { property: LOCATION_TYPED_PROPERTY_NAMES.latitude, label: "Latitude", valueType: "number", cardinality: "single", validation: "latitude", contextUseful: true },
  { property: LOCATION_TYPED_PROPERTY_NAMES.longitude, label: "Longitude", valueType: "number", cardinality: "single", validation: "longitude", contextUseful: true },
  { property: LOCATION_TYPED_PROPERTY_NAMES.timezone, label: "Timezone", valueType: "text", cardinality: "single", validation: "iana-timezone", contextUseful: true },
  {
    property: LOCATION_TYPED_PROPERTY_NAMES.parent,
    label: "Parent location",
    valueType: "entity-reference",
    cardinality: "single",
    targetEntityTypes: ["location"],
    contextUseful: true
  }
];

const DEFINITIONS = new Map<string, readonly StoryWorldTypedPropertyDefinition[]>([
  ["reference", REFERENCE_PROPERTIES],
  ["location", LOCATION_PROPERTIES]
]);

function normaliseType(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function storyWorldTypedPropertyDefinitions(entityType: string): readonly StoryWorldTypedPropertyDefinition[] {
  return DEFINITIONS.get(normaliseType(entityType)) ?? [];
}

export function storyWorldTypedPropertyDefinition(
  entityType: string,
  property: string
): StoryWorldTypedPropertyDefinition | null {
  return storyWorldTypedPropertyDefinitions(entityType).find((definition) => definition.property === property) ?? null;
}

export interface RecognisedStoryWorldTypedProperty {
  readonly definition: StoryWorldTypedPropertyDefinition;
  readonly value: unknown;
}

/** Reads recognised values without changing, normalising, or closing the authored property set. */
export function readStoryWorldTypedProperties(
  entityType: string,
  properties: Readonly<Record<string, unknown>>
): readonly RecognisedStoryWorldTypedProperty[] {
  return storyWorldTypedPropertyDefinitions(entityType)
    .filter((definition) => Object.prototype.hasOwnProperty.call(properties, definition.property))
    .map((definition) => ({ definition, value: properties[definition.property] }));
}

/** Explicit opt-in surface for future derived/context consumers; it does not widen prompts by itself. */
export function readContextUsefulStoryWorldTypedProperties(
  entityType: string,
  properties: Readonly<Record<string, unknown>>
): readonly RecognisedStoryWorldTypedProperty[] {
  return readStoryWorldTypedProperties(entityType, properties)
    .filter((property) => property.definition.contextUseful === true);
}

export function storyWorldTypedPropertyTextValues(
  property: RecognisedStoryWorldTypedProperty
): readonly string[] {
  const values = property.definition.cardinality === "multiple" && Array.isArray(property.value)
    ? property.value
    : [property.value];
  return values.flatMap((value) => {
    if (typeof value === "string") return value.trim() ? [value.trim()] : [];
    if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
    return [];
  });
}

export function validateStoryWorldTypedPropertyValue(
  definition: StoryWorldTypedPropertyDefinition,
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (definition.validation === "latitude" || definition.validation === "longitude") {
    const number = typeof value === "number" ? value : Number(value);
    const limit = definition.validation === "latitude" ? 90 : 180;
    return Number.isFinite(number) && number >= -limit && number <= limit
      ? null
      : `${definition.label} must be between ${-limit} and ${limit}.`;
  }
  if (definition.validation === "iana-timezone") {
    if (typeof value !== "string" || !value.trim()) return `${definition.label} must be an IANA timezone identifier.`;
    try {
      new Intl.DateTimeFormat("en", { timeZone: value.trim() }).format();
      return null;
    } catch {
      return `${definition.label} must be an IANA timezone identifier such as Europe/London.`;
    }
  }
  return null;
}

function storedValue(entity: StoryWorldEntityRecord): string {
  const path = entity.path.replace(/\.md$/i, "");
  const basename = entity.path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
  return normaliseType(entity.name) === normaliseType(basename)
    ? canonicalWikilink(path)
    : canonicalWikilink(path, entity.name);
}

/** Shared semantic candidates constrained by the definition's target entity types. */
export function buildStoryWorldTypedEntityReferenceCandidates(
  definition: StoryWorldTypedPropertyDefinition,
  entities: readonly StoryWorldEntityRecord[]
): ReferencePresentation[] {
  if (definition.valueType !== "entity-reference") return [];
  const allowed = new Set((definition.targetEntityTypes ?? []).map(normaliseType));
  const candidates = allowed.size
    ? entities.filter((entity) => allowed.has(normaliseType(entity.entityType)))
    : entities;
  return presentReferenceCandidates(candidates.map((entity) => ({
    storedValue: storedValue(entity),
    path: entity.path,
    name: entity.name,
    aliases: entity.aliases
  })));
}
