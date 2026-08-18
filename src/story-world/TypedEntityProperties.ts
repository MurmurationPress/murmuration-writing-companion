import type { StoryWorldEntityRecord } from "./StoryWorldIndex";
import {
  canonicalWikilink,
  presentReferenceCandidates,
  type ReferencePresentation
} from "./WikilinkPresentation";
import { IANA_TIMEZONE_FALLBACK } from "./IanaTimezoneFallback";

export type StoryWorldTypedPropertyValueType = "text" | "number" | "date" | "url" | "entity-reference" | "controlled-value";
export type StoryWorldTypedPropertyCardinality = "single" | "multiple";
export type StoryWorldTypedPropertyValidation = "latitude" | "longitude";

export interface StoryWorldControlledVocabularyCandidate {
  readonly value: string;
  readonly label?: string;
  readonly searchTerms?: readonly string[];
}

export interface StoryWorldControlledVocabularyDefinition {
  readonly id: string;
  readonly label: string;
  readonly allowCustom: boolean;
  readonly values: () => readonly StoryWorldControlledVocabularyCandidate[];
}

export interface StoryWorldTypedPropertyDefinition {
  readonly property: string;
  readonly label: string;
  readonly valueType: StoryWorldTypedPropertyValueType;
  readonly cardinality: StoryWorldTypedPropertyCardinality;
  readonly vocabulary?: string;
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
  { property: LOCATION_TYPED_PROPERTY_NAMES.timezone, label: "Timezone", valueType: "controlled-value", cardinality: "single", vocabulary: "iana-timezone", contextUseful: true },
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

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: "timeZone") => string[];
};

let timezoneCandidates: readonly StoryWorldControlledVocabularyCandidate[] | null = null;

function controlledVocabularyCandidates(
  values: readonly string[]
): readonly StoryWorldControlledVocabularyCandidate[] {
  return [...new Set(values.filter((value) => value.includes("/") && value.trim() === value))]
    .sort()
    .map((value) => ({
      value,
      label: value.replace(/_/g, " "),
      searchTerms: value.split("/").map((part) => part.replace(/_/g, " "))
    }));
}

/** Testable source selection: a populated runtime list wins; otherwise bundled IANA data is used. */
export function buildIanaTimezoneCandidates(
  runtimeValues: readonly string[] | null | undefined
): readonly StoryWorldControlledVocabularyCandidate[] {
  const runtimeCandidates = controlledVocabularyCandidates(runtimeValues ?? []);
  return runtimeCandidates.length > 0
    ? runtimeCandidates
    : controlledVocabularyCandidates(IANA_TIMEZONE_FALLBACK);
}

function runtimeIanaTimezoneValues(): readonly string[] {
  try {
    return (Intl as IntlWithSupportedValues).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

function ianaTimezoneCandidates(): readonly StoryWorldControlledVocabularyCandidate[] {
  if (timezoneCandidates) return timezoneCandidates;
  timezoneCandidates = buildIanaTimezoneCandidates(runtimeIanaTimezoneValues());
  return timezoneCandidates;
}

const VOCABULARIES = new Map<string, StoryWorldControlledVocabularyDefinition>([
  ["iana-timezone", {
    id: "iana-timezone",
    label: "IANA timezone identifiers",
    allowCustom: false,
    values: ianaTimezoneCandidates
  }]
]);

function normaliseType(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normaliseVocabularySearch(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
}

export function storyWorldControlledVocabulary(
  id: string
): StoryWorldControlledVocabularyDefinition | null {
  return VOCABULARIES.get(id) ?? null;
}

export function storyWorldControlledVocabularyCandidates(
  id: string
): readonly StoryWorldControlledVocabularyCandidate[] {
  return storyWorldControlledVocabulary(id)?.values() ?? [];
}

export function searchStoryWorldControlledVocabulary(
  id: string,
  query: string
): readonly StoryWorldControlledVocabularyCandidate[] {
  return searchStoryWorldControlledVocabularyCandidates(
    storyWorldControlledVocabularyCandidates(id),
    query
  );
}

export function searchStoryWorldControlledVocabularyCandidates(
  candidates: readonly StoryWorldControlledVocabularyCandidate[],
  query: string
): readonly StoryWorldControlledVocabularyCandidate[] {
  const search = normaliseVocabularySearch(query);
  if (!search) return candidates;
  return candidates.filter((candidate) => (
    [candidate.value, candidate.label ?? "", ...(candidate.searchTerms ?? [])]
      .some((value) => normaliseVocabularySearch(value).includes(search))
  ));
}

export function storyWorldControlledVocabularyAccepts(
  vocabulary: StoryWorldControlledVocabularyDefinition,
  value: string
): boolean {
  const candidate = value.trim();
  return Boolean(candidate) && (
    vocabulary.allowCustom
    || vocabulary.values().some((item) => item.value === candidate)
  );
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
  if (definition.valueType === "controlled-value") {
    const vocabulary = definition.vocabulary
      ? storyWorldControlledVocabulary(definition.vocabulary)
      : null;
    if (!vocabulary) return `${definition.label} does not have an available controlled vocabulary.`;
    if (typeof value !== "string" || !storyWorldControlledVocabularyAccepts(vocabulary, value)) {
      return vocabulary.allowCustom
        ? `${definition.label} must be a non-empty value.`
        : `${definition.label} must be selected from ${vocabulary.label}.`;
    }
    return null;
  }
  if (definition.validation === "latitude" || definition.validation === "longitude") {
    const number = typeof value === "number" ? value : Number(value);
    const limit = definition.validation === "latitude" ? 90 : 180;
    return Number.isFinite(number) && number >= -limit && number <= limit
      ? null
      : `${definition.label} must be between ${-limit} and ${limit}.`;
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
