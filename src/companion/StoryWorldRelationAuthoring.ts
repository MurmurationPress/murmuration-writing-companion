import type { StoryWorldEntityRecord } from "../story-world/StoryWorldIndex";
import type { PovSuggestion } from "./PovSuggestions";
import type { ProseWikilinkOccurrence } from "./ProseWikilinkChanges";
import {
  isExactStoryDate,
  shortestUnambiguousWikilink
} from "./StoryWorldEventCreation";

export type StoryWorldRelationStatus =
  | "confirmed"
  | "planned"
  | "candidate"
  | "unresolved";

export interface StoryWorldRelationStatusOption {
  readonly value: StoryWorldRelationStatus;
  readonly label: string;
}

export const STORY_WORLD_RELATION_STATUS_OPTIONS: readonly StoryWorldRelationStatusOption[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "planned", label: "Planned" },
  { value: "candidate", label: "Candidate" },
  { value: "unresolved", label: "Unresolved" }
];

export interface StoryWorldPredicateOption {
  readonly value: string;
  readonly label: string;
}

export const STORY_WORLD_RELATION_PREDICATE_OPTIONS: readonly StoryWorldPredicateOption[] = [
  { value: "works_for", label: "works for" },
  { value: "parent_of", label: "is parent of" },
  { value: "member_of", label: "is a member of" },
  { value: "located_in", label: "is located in" },
  { value: "created_by", label: "was created by" },
  { value: "participates_in", label: "participates in" },
  { value: "precedes", label: "precedes" },
  { value: "authored", label: "authored" },
  { value: "performs", label: "performs" },
  { value: "controls", label: "controls" },
  { value: "depends_on", label: "depends on" },
  { value: "opposes", label: "opposes" },
  { value: "observes", label: "observes" },
  { value: "conceals_from", label: "conceals from" },
  { value: "knows", label: "knows" },
  { value: "knows_about", label: "knows about" },
  { value: "believes", label: "believes" },
  { value: "suspects", label: "suspects" },
  { value: "designates", label: "designates as" },
  { value: "unaware_of", label: "remains unaware of" },
  { value: "becomes_aware_of", label: "becomes aware of" },
  { value: "responds_to", label: "responds to" },
  { value: "investigates", label: "investigates" },
  { value: "affected_by", label: "is affected by" },
  { value: "trusts", label: "trusts" },
  { value: "protects", label: "protects" },
  { value: "works_with", label: "works with" },
  { value: "visits", label: "visits" },
  { value: "leaves", label: "leaves" },
  { value: "uses", label: "uses" }
];

const EVENT_PREDICATES: readonly StoryWorldPredicateOption[] = [
  { value: "unaware_of", label: "remains unaware of" },
  { value: "becomes_aware_of", label: "becomes aware of" },
  { value: "responds_to", label: "responds to" },
  { value: "investigates", label: "investigates" },
  { value: "affected_by", label: "is affected by" }
];

const CHARACTER_PREDICATES: readonly StoryWorldPredicateOption[] = [
  { value: "knows", label: "knows" },
  { value: "trusts", label: "trusts" },
  { value: "opposes", label: "opposes" },
  { value: "protects", label: "protects" },
  { value: "works_with", label: "works with" }
];

const LOCATION_PREDICATES: readonly StoryWorldPredicateOption[] = [
  { value: "located_in", label: "is located in" },
  { value: "visits", label: "visits" },
  { value: "leaves", label: "leaves" },
  { value: "controls", label: "controls" },
  { value: "observes", label: "observes" }
];

const ORGANISATION_PREDICATES: readonly StoryWorldPredicateOption[] = [
  { value: "works_for", label: "works for" },
  { value: "member_of", label: "is a member of" },
  { value: "opposes", label: "opposes" },
  { value: "investigates", label: "investigates" },
  { value: "controls", label: "controls" }
];

const ARTEFACT_PREDICATES: readonly StoryWorldPredicateOption[] = [
  { value: "uses", label: "uses" },
  { value: "controls", label: "controls" },
  { value: "depends_on", label: "depends on" },
  { value: "observes", label: "observes" },
  { value: "opposes", label: "opposes" }
];

const GENERIC_PREDICATES: readonly StoryWorldPredicateOption[] = [
  { value: "observes", label: "observes" },
  { value: "knows_about", label: "knows about" },
  { value: "responds_to", label: "responds to" },
  { value: "depends_on", label: "depends on" },
  { value: "opposes", label: "opposes" }
];

export interface StoryWorldRelationProposal {
  readonly chapterPath: string;
  readonly sourceRawLink: string;
  readonly sourceLinkpath: string;
  readonly sourceLine: number;
  readonly sourceEntityPath: string;
  readonly sourceEntityName: string;
  readonly sourceEntityLookupValues: readonly string[];
  readonly targetEntityPath: string;
  readonly targetEntityName: string;
  readonly targetEntityType: string;
  readonly targetReference: string;
  readonly chapterReference: string;
  readonly scopeReference: string | null;
  readonly worldContextReference: string;
  readonly storyDate: string | null;
  readonly predicateOptions: readonly StoryWorldPredicateOption[];
}

export interface StoryWorldRelationProposalOptions {
  readonly sourceEntity: StoryWorldEntityRecord;
  readonly targetEntity: StoryWorldEntityRecord;
  readonly occurrence: ProseWikilinkOccurrence;
  readonly chapterPath: string;
  readonly sourceLine: number;
  readonly existingPaths: readonly string[];
  readonly bookPath?: string | null;
  readonly chapterStoryDate?: unknown;
}

export interface StoryWorldRelationDecision {
  readonly predicate: string;
  readonly predicateLabel: string | null;
  readonly status: StoryWorldRelationStatus;
}

function normalizeLookup(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|", 1)[0]
    .replace(/\.md$/i, "")
    .toLowerCase();
}

function basenameWithoutExtension(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

function withMarkdownExtension(path: string): string {
  return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
}

function uniqueStrings(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeLookup(trimmed);
    if (!trimmed || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function predicateOptionsForTargetType(
  entityType: string
): readonly StoryWorldPredicateOption[] {
  switch (entityType.trim().toLowerCase()) {
    case "event":
      return EVENT_PREDICATES;
    case "character":
      return CHARACTER_PREDICATES;
    case "location":
      return LOCATION_PREDICATES;
    case "organisation":
    case "organization":
      return ORGANISATION_PREDICATES;
    case "intelligence":
    case "system":
    case "technology":
    case "object":
    case "document":
      return ARTEFACT_PREDICATES;
    default:
      return GENERIC_PREDICATES;
  }
}

export function resolvePovRelationSource(
  value: string,
  suggestions: readonly PovSuggestion[]
): StoryWorldEntityRecord | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const key = normalizeLookup(trimmed);
  const target = key.split("#", 1)[0];
  const matches = suggestions.filter((suggestion) => (
    normalizeLookup(suggestion.value) === target
    || normalizeLookup(suggestion.entity.path) === target
    || suggestion.matches.some((candidate) => normalizeLookup(candidate) === key)
  ));
  return matches.length === 1 ? matches[0].entity : null;
}

export function buildStoryWorldRelationProposal(
  options: StoryWorldRelationProposalOptions
): StoryWorldRelationProposal | null {
  if (options.sourceEntity.path === options.targetEntity.path) return null;
  const chapterPath = withMarkdownExtension(options.chapterPath);
  const sourcePath = withMarkdownExtension(options.sourceEntity.path);
  const targetPath = withMarkdownExtension(options.targetEntity.path);
  const bookPath = options.bookPath
    ? withMarkdownExtension(options.bookPath)
    : null;

  return {
    chapterPath,
    sourceRawLink: options.occurrence.raw,
    sourceLinkpath: options.occurrence.linkpath,
    sourceLine: Math.max(1, Math.floor(options.sourceLine)),
    sourceEntityPath: sourcePath,
    sourceEntityName: options.sourceEntity.name,
    sourceEntityLookupValues: uniqueStrings([
      options.sourceEntity.name,
      ...options.sourceEntity.aliases,
      options.sourceEntity.basename
    ]),
    targetEntityPath: targetPath,
    targetEntityName: options.targetEntity.name,
    targetEntityType: options.targetEntity.entityType,
    targetReference: shortestUnambiguousWikilink(
      targetPath,
      options.targetEntity.name,
      options.existingPaths
    ),
    chapterReference: shortestUnambiguousWikilink(
      chapterPath,
      basenameWithoutExtension(chapterPath),
      options.existingPaths
    ),
    scopeReference: bookPath
      ? shortestUnambiguousWikilink(
        bookPath,
        basenameWithoutExtension(bookPath),
        options.existingPaths
      )
      : null,
    worldContextReference: shortestUnambiguousWikilink(
      targetPath,
      options.targetEntity.name,
      options.existingPaths
    ),
    storyDate: isExactStoryDate(options.chapterStoryDate)
      ? options.chapterStoryDate.trim()
      : null,
    predicateOptions: predicateOptionsForTargetType(options.targetEntity.entityType)
  };
}

export function isStoryWorldRelationStatus(
  value: unknown
): value is StoryWorldRelationStatus {
  return typeof value === "string"
    && STORY_WORLD_RELATION_STATUS_OPTIONS.some((option) => option.value === value);
}

function customPredicateId(label: string): string | null {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  return normalized || null;
}

export function buildStoryWorldRelationDecision(
  selectedPredicate: string,
  customLabel: string,
  status: unknown,
  options: readonly StoryWorldPredicateOption[]
): StoryWorldRelationDecision | null {
  if (!isStoryWorldRelationStatus(status)) return null;
  if (selectedPredicate === "other") {
    const label = customLabel.replace(/\s+/g, " ").trim();
    const predicate = customPredicateId(label);
    return predicate && label
      ? { predicate, predicateLabel: label, status }
      : null;
  }

  const preset = options.find((option) => option.value === selectedPredicate);
  return preset
    ? { predicate: preset.value, predicateLabel: null, status }
    : null;
}

export function predicateLabelForDecision(
  decision: StoryWorldRelationDecision,
  options: readonly StoryWorldPredicateOption[]
): string {
  return decision.predicateLabel
    ?? options.find((option) => option.value === decision.predicate)?.label
    ?? decision.predicate.replace(/_/g, " ");
}

export function formatStoryWorldRelationSentence(
  proposal: StoryWorldRelationProposal,
  decision: StoryWorldRelationDecision
): string {
  return `${proposal.sourceEntityName} ${predicateLabelForDecision(
    decision,
    proposal.predicateOptions
  )} ${proposal.targetEntityName}.`;
}

export function buildStoredStoryWorldRelationship(
  proposal: StoryWorldRelationProposal,
  decision: StoryWorldRelationDecision
): Record<string, unknown> {
  const relationship: Record<string, unknown> = {
    predicate: decision.predicate
  };
  if (decision.predicateLabel) {
    relationship.predicate_label = decision.predicateLabel;
  }
  relationship.target = proposal.targetReference;
  relationship.status = decision.status;
  relationship.source = proposal.chapterReference;
  if (proposal.storyDate) relationship.as_of = proposal.storyDate;
  if (proposal.scopeReference) relationship.scope = proposal.scopeReference;
  relationship.source_line = proposal.sourceLine;
  relationship.source_link = proposal.sourceRawLink;
  return relationship;
}

export function storyWorldRelationDecisionKey(
  decision: StoryWorldRelationDecision
): string {
  return [
    decision.predicate.trim().toLowerCase(),
    decision.status,
    (decision.predicateLabel ?? "").trim().toLowerCase()
  ].join("\u0000");
}
