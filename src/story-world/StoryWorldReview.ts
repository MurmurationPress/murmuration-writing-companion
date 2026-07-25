import {
  buildContinuityObservation,
  ContinuityObservation,
  normalizeObservationValue,
  ObservationEvidence,
  ObservationNoteReference
} from "../observations/ContinuityObservation";
import { parseTemporalInterval } from "../observations/TemporalInterval";
import { isRecord, projectEntityRelationships, relationshipProperty } from "./EntityRelationships";
import { parseWikilink, StoryWorldEntityRecord } from "./StoryWorldIndex";
import { observeIncompleteEntityRelationships } from "./StoryWorldObservations";

export interface StoryWorldReviewDocument {
  readonly path: string;
  readonly basename: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
}

export interface StoryWorldReferenceResolution {
  readonly path: string;
  readonly indexed: boolean;
  readonly excluded?: boolean;
}

export type StoryWorldReferenceResolver = (
  reference: string,
  sourcePath: string
) => StoryWorldReferenceResolution | null;

export interface StoryWorldReviewProjection {
  readonly observations: readonly ContinuityObservation[];
  readonly counts: Readonly<Record<"information" | "review" | "conflict", number>>;
}

const RULE_VERSION = 1;
const rule = (id: string) => ({ id: `mwc.story-world.${id}`, version: RULE_VERSION });
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const values = (value: unknown): unknown[] => Array.isArray(value) ? value : value == null ? [] : [value];
const normalizedName = (value: string): string => value.normalize("NFC").trim().toLocaleLowerCase("en");
const note = (path: string, label?: string): ObservationNoteReference => ({ role: "story_world", path, label });
const entityNote = (entity: StoryWorldEntityRecord): ObservationNoteReference => note(entity.path, entity.name);

function valueEvidence(
  entity: StoryWorldEntityRecord,
  role: string,
  property: readonly (string | number)[],
  raw: unknown
): ObservationEvidence {
  return {
    role,
    source: { note: entityNote(entity), property },
    value: { kind: "value", value: normalizeObservationValue(raw) }
  };
}

function unresolved(
  entity: StoryWorldEntityRecord,
  role: string,
  property: readonly (string | number)[],
  reference: string,
  reason: "missing" | "ambiguous" | "not_indexed"
): ObservationEvidence {
  return {
    role,
    source: { note: entityNote(entity), property },
    value: { kind: "unresolved_reference", reference, reason }
  };
}

function collisionObservations(entities: readonly StoryWorldEntityRecord[]): ContinuityObservation[] {
  const names = new Map<string, Array<{ entity: StoryWorldEntityRecord; source: "canonical" | "alias"; raw: string; index: number; property: string }>>();
  for (const entity of entities) {
    const canonicalProperty = text(entity.properties.world_name) ? "world_name" : text(entity.properties.title) ? "title" : "filename";
    [{ source: "canonical" as const, raw: entity.name, index: -1, property: canonicalProperty }, ...entity.aliases.map((raw, index) => ({ source: "alias" as const, raw, index, property: "aliases" }))]
      .forEach((entry) => {
        const key = normalizedName(entry.raw);
        const bucket = names.get(key) ?? [];
        bucket.push({ entity, ...entry });
        names.set(key, bucket);
      });
  }
  const output: ContinuityObservation[] = [];
  for (const [key, matches] of names) {
    const paths = [...new Set(matches.map((match) => match.entity.path))].sort();
    if (paths.length < 2) continue;
    const primary = matches.map((match) => match.entity).sort((a, b) => a.path.localeCompare(b.path))[0];
    const kinds = new Set(matches.map((match) => match.source));
    const collision = kinds.size === 1 ? [...kinds][0] : "canonical-and-alias";
    output.push(buildContinuityObservation({
      kind: `story-world.identity.${collision}-collision`,
      severity: "review",
      classification: "review_concern",
      primary: entityNote(primary),
      evidence: matches.sort((a, b) => a.entity.path.localeCompare(b.entity.path) || a.index - b.index).map((match) => ({
        role: match.source,
        source: { note: entityNote(match.entity), property: match.source === "canonical" ? [match.property] : ["aliases", match.index] },
        value: { kind: "value", value: match.raw }
      })),
      summary: "Story World lookup name collision",
      explanation: `${paths.length} Story World notes use names or aliases that normalise to “${key}”. Review them without merging or renaming automatically.`,
      rule: rule("identity-collision"),
      logicalOccurrence: { normalized: key, paths }
    }));
  }
  return output;
}

function relationshipObservations(entity: StoryWorldEntityRecord, resolve: StoryWorldReferenceResolver): ContinuityObservation[] {
  const output = [...observeIncompleteEntityRelationships(entity)];
  const property = relationshipProperty(entity.properties as Record<string, unknown>);
  for (const relationship of projectEntityRelationships(entity.name, entity.properties[property])) {
    if (!relationship.valid || relationship.index < 0) continue;
    const raw = relationship.raw as Record<string, unknown>;
    const base = [property, relationship.index] as const;
    if (relationship.objectKind === "target" && typeof relationship.objectValue === "string") {
      const resolution = resolve(relationship.objectValue, entity.path);
      if (!resolution?.indexed) {
        output.push(buildContinuityObservation({
          kind: "story-world.relationship.unresolved-target", severity: "conflict", classification: "unresolved_evidence",
          primary: entityNote(entity),
          evidence: [unresolved(entity, "relationship_target", [...base, "target"], relationship.objectValue, resolution ? "not_indexed" : "missing")],
          summary: "Broken Story World relationship target",
          explanation: `The explicit relationship target ${relationship.objectValue} does not resolve to an indexed Story World note.`,
          rule: rule("relationship-unresolved-target"),
          logicalOccurrence: { subject: entity.path, predicate: relationship.predicate, target: relationship.objectValue }
        }));
      }
    }
    const status = text(raw.status);
    if (Object.prototype.hasOwnProperty.call(raw, "status") && (!status || !["candidate", "planned", "confirmed", "superseded", "canon"].includes(status.toLowerCase()))) {
      output.push(buildContinuityObservation({
        kind: "story-world.relationship.invalid-status", severity: "review", classification: "malformed_evidence",
        primary: entityNote(entity), evidence: [valueEvidence(entity, "authorial_status", [...base, "status"], raw.status)],
        summary: "Malformed relationship authorial status", explanation: "The relationship status is not one of the supported authorial states.",
        rule: rule("relationship-invalid-status"), logicalOccurrence: { path: entity.path, index: relationship.index, status: normalizeObservationValue(raw.status) }
      }));
    }
    if (Object.prototype.hasOwnProperty.call(raw, "valid_from") || Object.prototype.hasOwnProperty.call(raw, "valid_until")) {
      const interval = Object.fromEntries(["valid_from", "valid_until"]
        .filter((key) => Object.prototype.hasOwnProperty.call(raw, key))
        .map((key) => [key === "valid_from" ? "from" : "until", raw[key]]));
      const parsed = parseTemporalInterval(interval);
      if (parsed.kind !== "supported") output.push(buildContinuityObservation({
        kind: "story-world.relationship.invalid-validity", severity: "conflict", classification: "malformed_evidence",
        primary: entityNote(entity), evidence: [valueEvidence(entity, "relationship_validity", base, interval)],
        summary: "Malformed relationship validity interval", explanation: "The explicit relationship validity bounds cannot be interpreted by the shared temporal contract.",
        rule: rule("relationship-invalid-validity"), logicalOccurrence: { path: entity.path, index: relationship.index, interval: normalizeObservationValue(interval) }
      }));
    }
    for (const key of ["validity", "world_time"] as const) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
      const parsed = parseTemporalInterval(raw[key]);
      if (parsed.kind !== "supported") output.push(buildContinuityObservation({
        kind: "story-world.relationship.invalid-validity", severity: "conflict", classification: "malformed_evidence",
        primary: entityNote(entity), evidence: [valueEvidence(entity, "relationship_validity", [...base, key], raw[key])],
        summary: "Malformed relationship validity interval", explanation: "The explicit relationship validity interval cannot be interpreted by the shared temporal contract.",
        rule: rule("relationship-invalid-validity"), logicalOccurrence: { path: entity.path, index: relationship.index, key, raw: normalizeObservationValue(raw[key]) }
      }));
    }
  }
  return output;
}

function referenceObservations(entity: StoryWorldEntityRecord, resolve: StoryWorldReferenceResolver): ContinuityObservation[] {
  const output: ContinuityObservation[] = [];
  const inspect = (property: string, role: string, rawValues: readonly unknown[], requireIndexed: boolean) => rawValues.forEach((raw, index) => {
    if (typeof raw !== "string") {
      output.push(buildContinuityObservation({
        kind: `story-world.${role}.malformed`, severity: "review", classification: "malformed_evidence", primary: entityNote(entity),
        evidence: [valueEvidence(entity, role, [property, index], raw)], summary: `Malformed Story World ${role.split("_").join(" ")}`,
        explanation: `The explicit ${property} value is not a supported note reference.`, rule: rule(`${role}-malformed`),
        logicalOccurrence: { path: entity.path, property, index, raw: normalizeObservationValue(raw) }
      }));
      return;
    }
    const parsed = parseWikilink(raw);
    if (!parsed) {
      output.push(buildContinuityObservation({
        kind: `story-world.${role}.malformed`, severity: "review", classification: "malformed_evidence", primary: entityNote(entity),
        evidence: [valueEvidence(entity, role, [property, index], raw)], summary: `Malformed Story World ${role.split("_").join(" ")}`,
        explanation: `The explicit ${property} value is not an Obsidian wikilink.`, rule: rule(`${role}-malformed`),
        logicalOccurrence: { path: entity.path, property, index, raw }
      }));
      return;
    }
    const resolution = resolve(raw, entity.path);
    if (resolution && !resolution.excluded && (!requireIndexed || resolution.indexed)) return;
    output.push(buildContinuityObservation({
      kind: `story-world.${role}.unresolved`, severity: role === "event_participant" ? "conflict" : "review", classification: "unresolved_evidence",
      primary: entityNote(entity), evidence: [unresolved(entity, role, [property, index], raw, resolution ? "not_indexed" : "missing")],
      summary: `Unresolved Story World ${role.split("_").join(" ")}`, explanation: `The explicit ${property} reference ${raw} does not resolve to indexed Story World canon.`,
      rule: rule(`${role}-unresolved`), logicalOccurrence: { path: entity.path, property, reference: raw }
    }));
  });
  inspect("world_sources", "source", values(entity.properties.world_sources), false);
  inspect("world_scope", "scope", values(entity.properties.world_scope), false);
  if (entity.entityType.trim().toLowerCase() === "event") {
    inspect("world_participants", "event_participant", values(entity.properties.world_participants ?? entity.properties.participants), true);
  }
  return output;
}

function eventObservations(entity: StoryWorldEntityRecord): ContinuityObservation[] {
  if (entity.entityType.trim().toLowerCase() !== "event") return [];
  const raw = entity.properties.world_time;
  const parsed = parseTemporalInterval(raw);
  if (parsed.kind === "missing" || parsed.kind === "supported") return [];
  return [buildContinuityObservation({
    kind: "story-world.event.invalid-time", severity: "conflict", classification: "malformed_evidence", primary: entityNote(entity),
    evidence: [valueEvidence(entity, "event_time", ["world_time"], raw)], summary: "Invalid event chronology data",
    explanation: "The explicit event world_time cannot be interpreted by the shared temporal contract.", rule: rule("event-invalid-time"),
    logicalOccurrence: { path: entity.path, raw: normalizeObservationValue(raw) }
  })];
}

function classificationObservations(documents: readonly StoryWorldReviewDocument[]): ContinuityObservation[] {
  return documents.flatMap((document) => {
    const keys = Object.keys(document.frontmatter);
    // world_context is a manuscript Scene property, not Story World opt-in.
    const optedIn = keys.some((key) => key.startsWith("world_") && key !== "world_context");
    if (!optedIn || text(document.frontmatter.world_entity) || text(document.frontmatter.world_model)) return [];
    const primary = note(document.path, document.basename);
    return [buildContinuityObservation({
      kind: "story-world.classification.missing", severity: "review", classification: "required_incomplete", primary,
      evidence: [{ role: "classification", source: { note: primary, property: ["world_entity"] }, value: { kind: "missing" } }],
      summary: "Story World classification is missing", explanation: "This note uses Story World properties but declares neither world_entity nor world_model.",
      rule: rule("classification-missing"), logicalOccurrence: { path: document.path }
    })];
  });
}

export function buildStoryWorldReview(
  documents: readonly StoryWorldReviewDocument[],
  entities: readonly StoryWorldEntityRecord[],
  resolve: StoryWorldReferenceResolver,
  additional: readonly ContinuityObservation[] = []
): StoryWorldReviewProjection {
  const observations = [
    ...classificationObservations(documents),
    ...collisionObservations(entities),
    ...entities.flatMap((entity) => [...relationshipObservations(entity, resolve), ...referenceObservations(entity, resolve), ...eventObservations(entity)]),
    ...additional
  ];
  const unique = new Map(observations.map((observation) => [observation.fingerprint, observation]));
  const sorted = [...unique.values()].sort((left, right) => {
    const severity = { conflict: 0, review: 1, information: 2 } as const;
    return severity[left.severity] - severity[right.severity]
      || left.kind.localeCompare(right.kind)
      || left.primary.path.localeCompare(right.primary.path)
      || left.fingerprint.localeCompare(right.fingerprint);
  });
  return {
    observations: sorted,
    counts: {
      information: sorted.filter((item) => item.severity === "information").length,
      review: sorted.filter((item) => item.severity === "review").length,
      conflict: sorted.filter((item) => item.severity === "conflict").length
    }
  };
}
