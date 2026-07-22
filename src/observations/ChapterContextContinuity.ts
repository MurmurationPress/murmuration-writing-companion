import {
  buildContinuityObservation,
  canonicalObservationEncoding,
  ContinuityObservation,
  normalizeObservationValue,
  ObservationEvidence,
  ObservationNoteReference,
  ObservationPropertyPathSegment
} from "./ContinuityObservation";
import {
  compareTemporalIntervals,
  parseTemporalInterval,
  TemporalInterval,
  TemporalParseResult
} from "./TemporalInterval";
import { getChapterContextField, normalizePropertyName } from "../companion/ChapterContext";
import { projectEntityRelationships, relationshipProperty } from "../story-world/EntityRelationships";
import { parseWikilink, StoryWorldEntityRecord } from "../story-world/StoryWorldIndex";
import { getWorldEventRelativeTimingPresentation } from "../story-world/WorldRelativeTime";

export interface ChapterContextScopeTarget {
  readonly note: ObservationNoteReference;
  readonly book: boolean;
}

export interface ChapterContextContinuityInput {
  readonly chapter: ObservationNoteReference;
  readonly frontmatter: Readonly<Record<string, unknown>> | undefined;
  readonly owningBook: {
    readonly note: ObservationNoteReference;
    readonly source: {
      readonly note: ObservationNoteReference;
      readonly property: readonly ObservationPropertyPathSegment[];
    };
  } | null;
  readonly resolveEntity: (reference: string, sourcePath: string) => StoryWorldEntityRecord | null;
  readonly resolveScope: (reference: string, sourcePath: string) => ChapterContextScopeTarget | null;
}

interface ContextOccurrence {
  readonly reference: string;
  readonly path: readonly ObservationPropertyPathSegment[];
  readonly entity: StoryWorldEntityRecord;
}

const RULES = {
  eventAfter: { id: "mwc.chapter-context.event-after-chapter", version: 1 },
  relationshipBefore: { id: "mwc.chapter-context.relationship-before-valid-from", version: 1 },
  relationshipAfter: { id: "mwc.chapter-context.relationship-after-valid-until", version: 1 },
  outOfScope: { id: "mwc.chapter-context.entity-out-of-scope", version: 1 },
  sourceData: { id: "mwc.chapter-context.source-data", version: 1 },
  unresolved: { id: "mwc.chapter-context.unresolved-reference", version: 1 }
} as const;

function storyWorldNote(entity: StoryWorldEntityRecord): ObservationNoteReference {
  return { role: "story_world", path: entity.path, label: entity.name };
}

function findProperty(
  frontmatter: Readonly<Record<string, unknown>> | undefined,
  aliases: readonly string[]
): { property: string; value: unknown } {
  const normalized = new Set(aliases.map(normalizePropertyName));
  for (const [property, value] of Object.entries(frontmatter ?? {})) {
    if (property !== "position" && normalized.has(normalizePropertyName(property))) {
      return { property, value };
    }
  }
  return { property: aliases[0], value: undefined };
}

function rawEvidence(raw: unknown) {
  if (raw instanceof Date && Number.isNaN(raw.getTime())) return "Invalid Date";
  return normalizeObservationValue(raw);
}

function sourceObservation(
  input: ChapterContextContinuityInput,
  sourceNote: ObservationNoteReference,
  path: readonly ObservationPropertyPathSegment[],
  raw: unknown,
  reason: string,
  unsupported = false,
  logicalOccurrence: unknown = { note: sourceNote.path, property: [...path], reason }
): ContinuityObservation {
  return buildContinuityObservation({
    kind: unsupported
      ? "chapter-context.source-data.unsupported"
      : "chapter-context.source-data.malformed",
    severity: "review",
    classification: unsupported ? "review_concern" : "malformed_evidence",
    primary: input.chapter,
    evidence: [{
      role: "source_data",
      source: { note: sourceNote, property: path },
      value: unsupported
        ? { kind: "unsupported", raw: rawEvidence(raw), reason }
        : { kind: "malformed", raw: rawEvidence(raw), reason }
    }],
    summary: "Story World source data needs review",
    explanation: `Continuity evaluation did not use this value because it is ${unsupported ? "unsupported" : "malformed"} (${reason}).`,
    rule: RULES.sourceData,
    logicalOccurrence: normalizeObservationValue(logicalOccurrence)
  });
}

function unresolvedObservation(
  input: ChapterContextContinuityInput,
  sourceNote: ObservationNoteReference,
  path: readonly ObservationPropertyPathSegment[],
  reference: string,
  role: string,
  logicalOccurrence: unknown = { note: sourceNote.path, property: [...path], reference }
): ContinuityObservation {
  return buildContinuityObservation({
    kind: "chapter-context.reference.unresolved",
    severity: "review",
    classification: "unresolved_evidence",
    primary: input.chapter,
    evidence: [{
      role,
      source: { note: sourceNote, property: path },
      value: { kind: "unresolved_reference", reference, reason: "not_indexed" }
    }],
    summary: "Story World reference could not be resolved",
    explanation: `${reference} could not be resolved, so it was not used for continuity evaluation.`,
    rule: RULES.unresolved,
    logicalOccurrence: normalizeObservationValue(logicalOccurrence)
  });
}

function parseContext(
  input: ChapterContextContinuityInput,
  observations: ContinuityObservation[]
): ContextOccurrence[] {
  const property = findProperty(input.frontmatter, ["world_context"]);
  if (property.value === undefined || property.value === null || property.value === "") return [];
  const list = Array.isArray(property.value) ? property.value : [property.value];
  const scalar = !Array.isArray(property.value);
  const occurrences: ContextOccurrence[] = [];
  const duplicateCounts = new Map<string, number>();
  for (const [index, raw] of list.entries()) {
    const path = scalar ? [property.property] : [property.property, index];
    const rawIdentity = raw === undefined ? { state: "missing" } : rawEvidence(raw);
    const key = canonicalObservationEncoding(normalizeObservationValue(rawIdentity));
    const duplicateOrdinal = duplicateCounts.get(key) ?? 0;
    duplicateCounts.set(key, duplicateOrdinal + 1);
    const logicalOccurrence = {
      field: "world_context",
      reference: rawIdentity,
      duplicateOrdinal
    };
    if (typeof raw !== "string" || !parseWikilink(raw)) {
      observations.push(sourceObservation(
        input,
        input.chapter,
        path,
        raw,
        "malformed_world_context_reference",
        false,
        logicalOccurrence
      ));
      continue;
    }
    const entity = input.resolveEntity(raw, input.chapter.path);
    if (!entity) {
      observations.push(unresolvedObservation(
        input,
        input.chapter,
        path,
        raw,
        "world_context_reference",
        logicalOccurrence
      ));
      continue;
    }
    occurrences.push({ reference: raw, path, entity });
  }
  return occurrences;
}

function temporalEvidence(
  role: string,
  note: ObservationNoteReference,
  property: readonly ObservationPropertyPathSegment[],
  interval: TemporalInterval,
  endpoint: "from" | "until" = "from"
): ObservationEvidence {
  const value = endpoint === "from" ? interval.from : interval.until;
  return {
    role,
    source: { note, property },
    value: {
      kind: "date",
      value: value?.source ?? interval.source,
      precision: value?.precision ?? interval.precision
    }
  };
}

function parsedOrObserved(
  input: ChapterContextContinuityInput,
  observations: ContinuityObservation[],
  note: ObservationNoteReference,
  path: readonly ObservationPropertyPathSegment[],
  raw: unknown,
  logicalOccurrence?: unknown
): TemporalInterval | null {
  const result = parseTemporalInterval(raw);
  if (result.kind === "supported") return result.value;
  if (result.kind === "malformed" || result.kind === "unsupported") {
    observations.push(sourceObservation(
      input,
      note,
      path,
      result.raw,
      result.reason,
      result.kind === "unsupported",
      logicalOccurrence
    ));
  }
  return null;
}

function eventTimePath(raw: unknown, endpoint: "from" | "until"): readonly ObservationPropertyPathSegment[] {
  if (typeof raw !== "object" || raw === null || raw instanceof Date || Array.isArray(raw)) return ["world_time"];
  const record = raw as Record<string, unknown>;
  if (record.at !== undefined) return ["world_time", "at"];
  if (endpoint === "from" && record.from !== undefined) return ["world_time", "from"];
  if (endpoint === "until" && record.until !== undefined) return ["world_time", "until"];
  return ["world_time"];
}

function contextEvidence(occurrence: ContextOccurrence): ObservationEvidence {
  return {
    role: "chapter_world_context",
    source: { note: { role: "manuscript", path: "" }, property: occurrence.path },
    value: { kind: "resolved_note", note: storyWorldNote(occurrence.entity) }
  };
}

function withChapterSource(
  evidence: ObservationEvidence,
  chapter: ObservationNoteReference
): ObservationEvidence {
  return { ...evidence, source: { ...evidence.source, note: chapter } };
}

function observeEvents(
  input: ChapterContextContinuityInput,
  observations: ContinuityObservation[],
  occurrences: readonly ContextOccurrence[],
  chapterDate: TemporalInterval,
  chapterDatePath: readonly ObservationPropertyPathSegment[],
  chapterDateRaw: unknown
) {
  const seen = new Set<string>();
  for (const occurrence of occurrences) {
    const entity = occurrence.entity;
    if (seen.has(entity.path) || entity.entityType.trim().toLowerCase() !== "event") continue;
    seen.add(entity.path);
    const note = storyWorldNote(entity);
    const raw = entity.properties.world_time;
    const eventTime = parsedOrObserved(input, observations, note, ["world_time"], raw);
    if (!eventTime || compareTemporalIntervals(eventTime, chapterDate) !== "after") continue;

    const relative = getWorldEventRelativeTimingPresentation(entity, chapterDateRaw)?.display;
    observations.push(buildContinuityObservation({
      kind: "chapter-context.event.after-chapter",
      severity: "conflict",
      classification: "contradiction",
      primary: input.chapter,
      evidence: [
        temporalEvidence("chapter_date", input.chapter, chapterDatePath, chapterDate),
        withChapterSource(contextEvidence(occurrence), input.chapter),
        temporalEvidence("event_time", note, eventTimePath(raw, "from"), eventTime)
      ],
      summary: "Referenced event occurs after this chapter",
      explanation: relative
        ? `The chapter is ${relative}; the explicit dates prove that ${entity.name} has not happened yet.`
        : `${entity.name} begins after the latest time permitted by the chapter's explicit story_date.`,
      rule: RULES.eventAfter,
      logicalOccurrence: { chapter: input.chapter.path, event: entity.path, concern: "event-after-chapter" }
    }));
  }
}

function relationshipDatePath(
  property: string,
  index: number,
  qualifier: "valid_from" | "valid_until"
): readonly ObservationPropertyPathSegment[] {
  return [property, index, qualifier];
}

function observeRelationships(
  input: ChapterContextContinuityInput,
  observations: ContinuityObservation[],
  occurrences: readonly ContextOccurrence[],
  chapterDate: TemporalInterval,
  chapterDatePath: readonly ObservationPropertyPathSegment[]
) {
  const occurrenceByPath = new Map<string, ContextOccurrence>();
  for (const occurrence of occurrences) {
    if (!occurrenceByPath.has(occurrence.entity.path)) occurrenceByPath.set(occurrence.entity.path, occurrence);
  }
  const duplicateCounts = new Map<string, number>();
  for (const ownerOccurrence of occurrenceByPath.values()) {
    const owner = ownerOccurrence.entity;
    const property = relationshipProperty(owner.properties as Record<string, unknown>);
    for (const relationship of projectEntityRelationships(owner.name, owner.properties[property])) {
      if (!relationship.valid || relationship.objectKind !== "target" || typeof relationship.objectValue !== "string") continue;
      const target = input.resolveEntity(relationship.objectValue, owner.path);
      if (!target) continue;
      const targetOccurrence = occurrenceByPath.get(target.path);
      if (!targetOccurrence) continue;

      const logical = { owner: owner.path, predicate: relationship.predicate, target: target.path };
      const key = canonicalObservationEncoding(normalizeObservationValue(logical));
      const duplicateOrdinal = duplicateCounts.get(key) ?? 0;
      duplicateCounts.set(key, duplicateOrdinal + 1);
      const relationshipNote = storyWorldNote(owner);

      const checks = [
        {
          qualifier: "valid_from" as const,
          order: "before" as const,
          kind: "chapter-context.relationship.before-valid-from",
          summary: "Referenced relationship is not yet valid",
          rule: RULES.relationshipBefore
        },
        {
          qualifier: "valid_until" as const,
          order: "after" as const,
          kind: "chapter-context.relationship.after-valid-until",
          summary: "Referenced relationship is no longer valid",
          rule: RULES.relationshipAfter
        }
      ];
      for (const check of checks) {
        const raw = relationship.qualifiers[check.qualifier];
        if (raw === undefined || raw === null || raw === "") continue;
        const path = relationshipDatePath(property, relationship.index, check.qualifier);
        const boundary = parsedOrObserved(
          input,
          observations,
          relationshipNote,
          path,
          raw,
          { ...logical, duplicateOrdinal, qualifier: check.qualifier }
        );
        if (!boundary || compareTemporalIntervals(chapterDate, boundary) !== check.order) continue;
        observations.push(buildContinuityObservation({
          kind: check.kind,
          severity: "conflict",
          classification: "contradiction",
          primary: input.chapter,
          evidence: [
            temporalEvidence("chapter_date", input.chapter, chapterDatePath, chapterDate),
            withChapterSource(contextEvidence(ownerOccurrence), input.chapter),
            withChapterSource(contextEvidence(targetOccurrence), input.chapter),
            {
              role: "relationship_target",
              source: { note: relationshipNote, property: [property, relationship.index, "target"] },
              value: { kind: "resolved_note", note: storyWorldNote(target) }
            },
            temporalEvidence("relationship_boundary", relationshipNote, path, boundary)
          ],
          summary: check.summary,
          explanation: `${owner.name} ${relationship.predicateLabel} ${target.name}, but the chapter date is ${check.order} the explicit ${check.qualifier} boundary.`,
          rule: check.rule,
          logicalOccurrence: { ...logical, duplicateOrdinal, concern: check.qualifier }
        }));
      }
    }
  }
}

function scopeProperty(entity: StoryWorldEntityRecord): { property: string; value: unknown } {
  return findProperty(entity.properties, ["world_scope"]);
}

function observeScopes(
  input: ChapterContextContinuityInput,
  observations: ContinuityObservation[],
  occurrences: readonly ContextOccurrence[]
) {
  if (!input.owningBook) return;
  const firstOccurrence = new Map<string, ContextOccurrence>();
  for (const occurrence of occurrences) {
    if (!firstOccurrence.has(occurrence.entity.path)) firstOccurrence.set(occurrence.entity.path, occurrence);
  }
  for (const occurrence of firstOccurrence.values()) {
    const entity = occurrence.entity;
    const scope = scopeProperty(entity);
    if (scope.value === undefined || scope.value === null || scope.value === "") continue;
    const values = Array.isArray(scope.value) ? scope.value : [scope.value];
    const scalar = !Array.isArray(scope.value);
    const resolvedBooks: ChapterContextScopeTarget[] = [];
    let indeterminate = false;
    const scopeEvidence: ObservationEvidence[] = [];
    const duplicateCounts = new Map<string, number>();
    for (const [index, raw] of values.entries()) {
      const path = scalar ? [scope.property] : [scope.property, index];
      const rawIdentity = raw === undefined ? { state: "missing" } : rawEvidence(raw);
      const key = canonicalObservationEncoding(normalizeObservationValue(rawIdentity));
      const duplicateOrdinal = duplicateCounts.get(key) ?? 0;
      duplicateCounts.set(key, duplicateOrdinal + 1);
      const logicalOccurrence = {
        entity: entity.path,
        field: "world_scope",
        value: rawIdentity,
        duplicateOrdinal
      };
      if (typeof raw !== "string" || !raw.trim()) {
        observations.push(sourceObservation(
          input,
          storyWorldNote(entity),
          path,
          raw,
          "malformed_world_scope",
          false,
          logicalOccurrence
        ));
        indeterminate = true;
        continue;
      }
      if (!parseWikilink(raw)) {
        observations.push(sourceObservation(
          input,
          storyWorldNote(entity),
          path,
          raw,
          "non_reference_world_scope",
          true,
          logicalOccurrence
        ));
        indeterminate = true;
        continue;
      }
      const resolved = input.resolveScope(raw, entity.path);
      if (!resolved) {
        observations.push(unresolvedObservation(
          input,
          storyWorldNote(entity),
          path,
          raw,
          "world_scope_reference",
          logicalOccurrence
        ));
        indeterminate = true;
        continue;
      }
      if (!resolved.book) {
        // Series and other scope kinds are valid Markdown but deliberately deferred in #130.
        indeterminate = true;
        continue;
      }
      resolvedBooks.push(resolved);
      scopeEvidence.push({
        role: "entity_scope",
        source: { note: storyWorldNote(entity), property: path },
        value: { kind: "resolved_note", note: resolved.note }
      });
    }
    if (indeterminate || resolvedBooks.length === 0) continue;
    if (resolvedBooks.some((scopeBook) => scopeBook.note.path === input.owningBook!.note.path)) continue;
    observations.push(buildContinuityObservation({
      kind: "chapter-context.entity.out-of-scope",
      severity: "conflict",
      classification: "contradiction",
      primary: input.chapter,
      evidence: [
        withChapterSource(contextEvidence(occurrence), input.chapter),
        {
          role: "owning_book",
          source: input.owningBook.source,
          value: { kind: "resolved_note", note: input.owningBook.note }
        },
        ...scopeEvidence
      ],
      summary: "Referenced entity excludes this book",
      explanation: `${entity.name} is explicitly scoped to other books and does not include ${input.owningBook.note.label ?? input.owningBook.note.path}.`,
      rule: RULES.outOfScope,
      logicalOccurrence: { chapter: input.chapter.path, entity: entity.path, owningBook: input.owningBook.note.path }
    }));
  }
}

/** Evaluates only explicit active-chapter context; it never scans or writes Markdown. */
export function evaluateChapterContextContinuity(
  input: ChapterContextContinuityInput
): ContinuityObservation[] {
  const observations: ContinuityObservation[] = [];
  const occurrences = parseContext(input, observations);
  const storyDate = findProperty(input.frontmatter, getChapterContextField("story_date").aliases);
  const parsedStoryDate: TemporalParseResult = parseTemporalInterval(storyDate.value);
  if (parsedStoryDate.kind === "malformed" || parsedStoryDate.kind === "unsupported") {
    observations.push(sourceObservation(
      input,
      input.chapter,
      [storyDate.property],
      parsedStoryDate.raw,
      parsedStoryDate.reason,
      parsedStoryDate.kind === "unsupported"
    ));
  }
  if (parsedStoryDate.kind === "supported") {
    observeEvents(input, observations, occurrences, parsedStoryDate.value, [storyDate.property], storyDate.value);
    observeRelationships(input, observations, occurrences, parsedStoryDate.value, [storyDate.property]);
    observeScopes(input, observations, occurrences);
  }
  return observations.sort((left, right) => {
    const severity = { conflict: 0, review: 1, information: 2 } as const;
    return severity[left.severity] - severity[right.severity]
      || (left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0)
      || (left.lineageKey < right.lineageKey ? -1 : left.lineageKey > right.lineageKey ? 1 : 0)
      || (left.fingerprint < right.fingerprint ? -1 : left.fingerprint > right.fingerprint ? 1 : 0);
  });
}
