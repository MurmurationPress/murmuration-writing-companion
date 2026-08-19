import {
  buildContinuityObservation,
  canonicalObservationEncoding,
  ContinuityObservation,
  normalizeObservationValue,
  ObservationEvidence,
  ObservationNoteReference
} from "../observations/ContinuityObservation";
import { parseTemporalInterval } from "../observations/TemporalInterval";
import { isRecord, projectEntityRelationships, relationshipProperty } from "./EntityRelationships";
import { parseWikilink, StoryWorldEntityRecord } from "./StoryWorldIndex";
import { observeIncompleteEntityRelationships } from "./StoryWorldObservations";
import { storyWorldTypedPropertyDefinitions } from "./TypedEntityProperties";
import {
  collectSemanticManuscriptReferences,
  isSemanticManuscriptReferenceTarget
} from "./WorldContext";

export interface StoryWorldReviewLink {
  readonly raw: string;
  readonly linkpath: string;
  readonly displayText: string | null;
  readonly start: number;
  readonly end: number;
}

export interface StoryWorldReviewDocument {
  readonly path: string;
  readonly basename: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly links?: readonly StoryWorldReviewLink[];
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

export function storyWorldReviewEvidenceFingerprint(
  frontmatter: Readonly<Record<string, unknown>>,
  links: readonly StoryWorldReviewLink[] = []
): string | null {
  const storyWorldEvidence = Object.fromEntries(Object.entries(frontmatter)
    .filter(([key]) => key.startsWith("world_") && key !== "world_context")
    .sort(([left], [right]) => left.localeCompare(right)));
  const semanticReferences = collectSemanticManuscriptReferences(frontmatter);
  const bodyLinks = links.map((link) => [link.raw, link.linkpath, link.start, link.end]);
  return Object.keys(storyWorldEvidence).length || semanticReferences.length || bodyLinks.length
    ? JSON.stringify({ storyWorldEvidence, semanticReferences, bodyLinks })
    : null;
}

const RULE_VERSION = 1;
const rule = (id: string) => ({ id: `mwc.story-world.${id}`, version: RULE_VERSION });
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const values = (value: unknown): unknown[] => Array.isArray(value) ? value : value == null ? [] : [value];
const normalizedName = (value: string): string => value.normalize("NFC").trim().toLocaleLowerCase("en");
const nearName = (value: string): string => normalizedName(value).replace(/[\p{P}\p{S}\s]+/gu, "");
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
  const near = new Map<string, StoryWorldEntityRecord[]>();
  for (const entity of entities) {
    const key = nearName(entity.name);
    if (key.length < 4) continue;
    const bucket = near.get(key) ?? [];
    bucket.push(entity);
    near.set(key, bucket);
  }
  for (const [key, matches] of near) {
    const exactNames = new Set(matches.map((entity) => normalizedName(entity.name)));
    const paths = [...new Set(matches.map((entity) => entity.path))].sort();
    if (paths.length < 2 || exactNames.size < 2) continue;
    const sorted = matches.slice().sort((left, right) => left.path.localeCompare(right.path));
    output.push(buildContinuityObservation({
      kind: "story-world.identity.near-canonical-collision",
      severity: "review",
      classification: "review_concern",
      primary: entityNote(sorted[0]),
      evidence: sorted.map((entity) => valueEvidence(entity, "canonical", [text(entity.properties.world_name) ? "world_name" : "title"], entity.name)),
      summary: "Near-duplicate Story World names",
      explanation: "These canonical names differ only by case-insensitive punctuation or spacing. Review them without merging or renaming automatically.",
      rule: rule("identity-near-collision"),
      logicalOccurrence: { normalized: key, paths }
    }));
  }
  return output;
}

function duplicateRelationshipObservations(entity: StoryWorldEntityRecord): ContinuityObservation[] {
  const property = relationshipProperty(entity.properties as Record<string, unknown>);
  const groups = new Map<string, Array<{ index: number; raw: unknown }>>();
  for (const relationship of projectEntityRelationships(entity.name, entity.properties[property])) {
    if (!relationship.valid || relationship.index < 0) continue;
    const identity = canonicalObservationEncoding(normalizeObservationValue(relationship.raw));
    const bucket = groups.get(identity) ?? [];
    bucket.push({ index: relationship.index, raw: relationship.raw });
    groups.set(identity, bucket);
  }
  return [...groups.values()].filter((matches) => matches.length > 1).map((matches) => buildContinuityObservation({
    kind: "story-world.relationship.duplicate",
    severity: "review",
    classification: "review_concern",
    primary: entityNote(entity),
    evidence: matches.map((match) => valueEvidence(entity, "duplicate_relationship", [property, match.index], match.raw)),
    summary: "Duplicate Story World relationship",
    explanation: "These relationship assertions have the same predicate, target or value, status, scope, provenance and qualifiers.",
    rule: rule("relationship-duplicate"),
    logicalOccurrence: { path: entity.path, indices: matches.map((match) => match.index) }
  }));
}

function duplicateEntityGroups(entities: readonly StoryWorldEntityRecord[]): StoryWorldEntityRecord[][] {
  const groups = new Map<string, StoryWorldEntityRecord[]>();
  for (const entity of entities) {
    const key = `${normalizedName(entity.entityType)}\n${nearName(entity.name)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(entity);
    groups.set(key, bucket);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function intervalsOverlap(left: unknown, right: unknown): boolean | null {
  const a = parseTemporalInterval(left);
  const b = parseTemporalInterval(right);
  if (a.kind !== "supported" || b.kind !== "supported") return null;
  const aMin = a.value.from?.minimum ?? a.value.until?.minimum;
  const aMax = a.value.until?.maximum ?? a.value.from?.maximum;
  const bMin = b.value.from?.minimum ?? b.value.until?.minimum;
  const bMax = b.value.until?.maximum ?? b.value.from?.maximum;
  if (aMin === undefined || aMax === undefined || bMin === undefined || bMax === undefined) return null;
  return aMin <= bMax && bMin <= aMax;
}

function duplicateEntityConflictObservations(entities: readonly StoryWorldEntityRecord[]): ContinuityObservation[] {
  const output: ContinuityObservation[] = [];
  for (const entity of entities) {
    for (const definition of storyWorldTypedPropertyDefinitions(entity.entityType).filter((item) => item.cardinality === "single")) {
      const raw = entity.properties[definition.property];
      if (!Array.isArray(raw)) continue;
      const distinct = new Set(raw.map((value) => canonicalObservationEncoding(normalizeObservationValue(value))));
      if (distinct.size < 2) continue;
      output.push(buildContinuityObservation({
        kind: "story-world.typed-property.single-value-conflict", severity: "conflict", classification: "contradiction",
        primary: entityNote(entity), evidence: raw.map((value, index) => valueEvidence(entity, "typed_property", [definition.property, index], value)),
        summary: `Multiple ${definition.label.toLowerCase()} values`,
        explanation: `The shared typed-property registry defines ${definition.property} as single-valued, but this record contains conflicting values.`,
        rule: rule("typed-property-single-value-conflict"), logicalOccurrence: { path: entity.path, property: definition.property }
      }));
    }
  }
  for (const group of duplicateEntityGroups(entities)) {
    const sorted = group.slice().sort((left, right) => left.path.localeCompare(right.path));
    if (normalizedName(sorted[0].entityType) === "event") {
      const timed = sorted.filter((entity) => entity.properties.world_time != null);
      for (let left = 0; left < timed.length; left += 1) for (let right = left + 1; right < timed.length; right += 1) {
        if (intervalsOverlap(timed[left].properties.world_time, timed[right].properties.world_time) !== false) continue;
        output.push(buildContinuityObservation({
          kind: "story-world.event.conflicting-time", severity: "conflict", classification: "contradiction",
          primary: entityNote(timed[left]),
          evidence: [
            valueEvidence(timed[left], "event_time", ["world_time"], timed[left].properties.world_time),
            valueEvidence(timed[right], "event_time", ["world_time"], timed[right].properties.world_time)
          ],
          summary: "Conflicting dates for duplicate Event records",
          explanation: "These structurally duplicate Event names have explicit world_time intervals that cannot overlap at their authored precision.",
          rule: rule("event-conflicting-time"),
          logicalOccurrence: { paths: [timed[left].path, timed[right].path].sort() }
        }));
      }
    }
    for (const definition of storyWorldTypedPropertyDefinitions(sorted[0].entityType).filter((item) => item.cardinality === "single")) {
      const present = sorted.filter((entity) => Object.prototype.hasOwnProperty.call(entity.properties, definition.property));
      const distinct = new Map<string, StoryWorldEntityRecord[]>();
      for (const entity of present) {
        const raw = entity.properties[definition.property];
        const candidates = Array.isArray(raw) ? raw : [raw];
        for (const candidate of candidates) {
          const key = canonicalObservationEncoding(normalizeObservationValue(candidate));
          const bucket = distinct.get(key) ?? [];
          bucket.push(entity);
          distinct.set(key, bucket);
        }
      }
      if (distinct.size < 2) continue;
      output.push(buildContinuityObservation({
        kind: "story-world.typed-property.single-value-conflict", severity: "conflict", classification: "contradiction",
        primary: entityNote(sorted[0]),
        evidence: present.map((entity) => valueEvidence(entity, "typed_property", [definition.property], entity.properties[definition.property])),
        summary: `Conflicting ${definition.label.toLowerCase()} values`,
        explanation: `The shared typed-property registry defines ${definition.property} as single-valued, but structurally duplicate ${sorted[0].entityType} records disagree.`,
        rule: rule("typed-property-single-value-conflict"),
        logicalOccurrence: { entityType: normalizedName(sorted[0].entityType), property: definition.property, paths: sorted.map((entity) => entity.path) }
      }));
    }
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
  if (Array.isArray(raw)) {
    const parsed = raw.map(parseTemporalInterval);
    if (parsed.every((item) => item.kind === "supported")) {
      for (let left = 0; left < raw.length; left += 1) for (let right = left + 1; right < raw.length; right += 1) {
        if (intervalsOverlap(raw[left], raw[right]) !== false) continue;
        return [buildContinuityObservation({
          kind: "story-world.event.conflicting-time", severity: "conflict", classification: "contradiction", primary: entityNote(entity),
          evidence: [valueEvidence(entity, "event_time", ["world_time", left], raw[left]), valueEvidence(entity, "event_time", ["world_time", right], raw[right])],
          summary: "Conflicting dates within one Event",
          explanation: "This Event contains multiple explicit world_time values that cannot overlap at their authored precision.",
          rule: rule("event-conflicting-time"), logicalOccurrence: { path: entity.path }
        })];
      }
      return [];
    }
  }
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

function linkCandidates(reference: string, entities: readonly StoryWorldEntityRecord[]): StoryWorldEntityRecord[] {
  const parsed = parseWikilink(reference.startsWith("[[") ? reference : `[[${reference}]]`);
  if (!parsed) return [];
  const lookup = normalizedName(parsed.linkpath.replace(/\.md$/iu, ""));
  const basename = lookup.split("/").pop() ?? lookup;
  const paths = entities.filter((entity) => normalizedName(entity.path.replace(/\.md$/iu, "")) === lookup);
  if (lookup.includes("/") && paths.length) return paths.sort((left, right) => left.path.localeCompare(right.path));
  return entities.filter((entity) => {
    const path = normalizedName(entity.path.replace(/\.md$/iu, ""));
    const names = [entity.name, ...entity.aliases].map(normalizedName);
    return path === lookup || names.includes(lookup) || names.includes(basename);
  }).sort((left, right) => left.path.localeCompare(right.path));
}

function manuscriptLinkObservations(
  documents: readonly StoryWorldReviewDocument[],
  entities: readonly StoryWorldEntityRecord[]
): ContinuityObservation[] {
  const entityPaths = new Set(entities.map((entity) => entity.path));
  const output: ContinuityObservation[] = [];
  for (const document of documents) {
    if (entityPaths.has(document.path)) continue;
    for (const link of document.links ?? []) {
      const candidates = linkCandidates(link.linkpath, entities);
      const property = ["body", link.start, link.end] as const;
      if (candidates.length > 1) {
        output.push(buildContinuityObservation({
          kind: "story-world.link.ambiguous", severity: "conflict", classification: "unresolved_evidence",
          primary: { role: "manuscript", path: document.path, label: document.basename },
          evidence: [
            { role: "wikilink", source: { note: { role: "manuscript", path: document.path, label: document.basename }, property }, value: { kind: "value", value: link.raw } },
            ...candidates.map((candidate) => ({ role: "candidate", source: { note: entityNote(candidate), property: ["world_name"] }, value: { kind: "resolved_note" as const, note: entityNote(candidate) } }))
          ],
          summary: "Ambiguous Story World wikilink",
          explanation: `The manuscript wikilink ${link.raw} matches more than one canonical Story World name, alias or indexed path. MWC will not guess the intended target.`,
          rule: rule("link-ambiguous"),
          logicalOccurrence: { source: document.path, start: link.start, end: link.end, raw: link.raw, candidates: candidates.map((candidate) => candidate.path) }
        }));
      } else if (candidates.length === 0 && /^(?:Story World|World)\//iu.test(link.linkpath.trim())) {
        output.push(buildContinuityObservation({
          kind: "story-world.link.broken", severity: "conflict", classification: "unresolved_evidence",
          primary: { role: "manuscript", path: document.path, label: document.basename },
          evidence: [{ role: "wikilink", source: { note: { role: "manuscript", path: document.path, label: document.basename }, property }, value: { kind: "unresolved_reference", reference: link.raw, reason: "missing" } }],
          summary: "Broken Story World manuscript wikilink",
          explanation: `The explicit Story World path ${link.raw} has no indexed Story World target. Ordinary unresolved manuscript links are not treated as Story World errors.`,
          rule: rule("link-broken"), logicalOccurrence: { source: document.path, start: link.start, end: link.end, raw: link.raw }
        }));
      }
    }
  }
  return output;
}

function orphanObservations(
  documents: readonly StoryWorldReviewDocument[],
  entities: readonly StoryWorldEntityRecord[],
  resolve: StoryWorldReferenceResolver
): ContinuityObservation[] {
  const incoming = new Set<string>();
  const entitiesByPath = new Map(entities.map((entity) => [entity.path, entity]));
  for (const document of documents) {
    for (const link of document.links ?? []) {
      const resolved = resolve(`[[${link.linkpath}]]`, document.path);
      if (resolved?.indexed) incoming.add(resolved.path);
    }
    for (const reference of collectSemanticManuscriptReferences(document.frontmatter)) {
      if (!parseWikilink(reference.reference)) continue;
      const resolved = resolve(reference.reference, document.path);
      if (!resolved?.indexed) continue;
      const target = entitiesByPath.get(resolved.path);
      if (!target || !isSemanticManuscriptReferenceTarget(reference, target)) continue;
      incoming.add(resolved.path);
    }
  }
  for (const entity of entities) for (const reference of entity.links) {
    const resolved = resolve(reference, entity.path);
    if (resolved?.indexed) incoming.add(resolved.path);
  }
  for (const entity of entities) {
    for (const definition of storyWorldTypedPropertyDefinitions(entity.entityType)) {
      if (definition.valueType !== "entity-reference") continue;
      for (const reference of values(entity.properties[definition.property])) {
        if (typeof reference !== "string") continue;
        const resolved = resolve(reference, entity.path);
        if (resolved?.indexed) incoming.add(resolved.path);
      }
    }
  }
  return entities.flatMap((entity) => {
    if (incoming.has(entity.path)) return [];
    // A scoped profile is semantically used through its parent and scope even
    // when no manuscript links to the child profile directly.
    if (normalizedName(entity.entityType) === "pov-profile"
      && typeof entity.properties.pov_extends === "string"
      && entity.properties.pov_extends.trim()
      && values(entity.properties.world_scope).length > 0) return [];
    return [buildContinuityObservation({
      kind: "story-world.entity.orphan", severity: "information", classification: "optional_missing",
      primary: entityNote(entity), evidence: [valueEvidence(entity, "entity", ["world_entity"], entity.entityType)],
      summary: "Unreferenced Story World entity",
      explanation: "No incoming manuscript link, Story World semantic link or relationship currently references this entity. This is informational: an unreferenced record may be intentional.",
      rule: rule("entity-orphan"), logicalOccurrence: { path: entity.path, entityType: normalizedName(entity.entityType) }
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
    ...manuscriptLinkObservations(documents, entities),
    ...orphanObservations(documents, entities, resolve),
    ...duplicateEntityConflictObservations(entities),
    ...entities.flatMap((entity) => [
      ...duplicateRelationshipObservations(entity),
      ...relationshipObservations(entity, resolve),
      ...referenceObservations(entity, resolve),
      ...eventObservations(entity)
    ]),
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
