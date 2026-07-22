import {
  buildContinuityObservation,
  canonicalObservationEncoding,
  ContinuityObservation,
  DeterministicValue,
  normalizeObservationValue,
  ObservationNoteReference
} from "../observations/ContinuityObservation";
import { projectEntityRelationships, relationshipProperty } from "./EntityRelationships";
import { parseWikilink, StoryWorldEntityRecord } from "./StoryWorldIndex";

const INCOMPLETE_RELATIONSHIP_RULE = {
  id: "mwc.story-world.incomplete-relationship",
  version: 1
} as const;

function note(entity: StoryWorldEntityRecord): ObservationNoteReference {
  return { role: "story_world", path: entity.path, label: entity.name };
}

function incompleteRelationshipReason(raw: unknown, index: number): string {
  if (index < 0) return "relationship_collection_not_list";
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return "relationship_not_object";
  }
  const assertion = raw as Record<string, unknown>;
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  const predicate = text(assertion.predicate);
  const target = text(assertion.target);
  const literal = typeof assertion.value === "number" || typeof assertion.value === "boolean"
    ? assertion.value
    : text(assertion.value);
  if (!predicate) return "missing_predicate";
  if (target && literal !== null) return "target_and_value_present";
  if (target && !parseWikilink(target)) return "malformed_target_reference";
  return "missing_target_or_value";
}

function relationshipOccurrence(
  property: string,
  raw: unknown,
  index: number
): DeterministicValue {
  if (index < 0) return { property, structure: "collection" };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { property, structure: "assertion", valueKind: typeof raw };
  }
  const assertion = raw as Record<string, unknown>;
  const scalar = (value: unknown) => (
    typeof value === "string" ? value.trim()
      : typeof value === "number" || typeof value === "boolean" ? value
        : null
  );
  return {
    property,
    structure: "assertion",
    predicate: scalar(assertion.predicate),
    target: scalar(assertion.target),
    value: scalar(assertion.value)
  };
}

/** Produces review observations without changing or normalising Story World Markdown. */
export function observeIncompleteEntityRelationships(
  entity: StoryWorldEntityRecord
): ContinuityObservation[] {
  const property = relationshipProperty(entity.properties as Record<string, unknown>);
  const raw = entity.properties[property];
  const duplicateCounts = new Map<string, number>();
  return projectEntityRelationships(entity.name, raw)
    .filter((relationship) => !relationship.valid)
    .map((relationship) => {
      const propertyPath = relationship.index < 0
        ? [property]
        : [property, relationship.index];
      const rawValue = relationship.index < 0 ? raw : relationship.raw;
      const occurrence = relationshipOccurrence(property, rawValue, relationship.index);
      const occurrenceKey = canonicalObservationEncoding(normalizeObservationValue(occurrence));
      const duplicateOrdinal = duplicateCounts.get(occurrenceKey) ?? 0;
      duplicateCounts.set(occurrenceKey, duplicateOrdinal + 1);

      return buildContinuityObservation({
        kind: "story-world.relationship.incomplete",
        severity: "review",
        classification: "required_incomplete",
        primary: note(entity),
        evidence: [{
          role: "incomplete_relationship",
          source: { note: note(entity), property: propertyPath },
          value: {
            kind: "malformed",
            raw: normalizeObservationValue(rawValue),
            reason: incompleteRelationshipReason(rawValue, relationship.index)
          }
        }],
        summary: "Incomplete Story World relationship",
        explanation: relationship.issue ?? "This relationship is incomplete.",
        rule: INCOMPLETE_RELATIONSHIP_RULE,
        logicalOccurrence: { occurrence, duplicateOrdinal }
      });
    });
}
