import {
  ObservationEvidence,
  ObservationNoteReference,
  observationSourceNotes
} from "../observations/ContinuityObservation";
import type { ContinuityReviewItem, ContinuityReviewLocation } from "../observations/ContinuityReview";

export type ContinuityEvidenceGroupName =
  | "Manuscript order"
  | "Story dates"
  | "Story World source"
  | "Relationship validity"
  | "Scope or resolution";

export const CONTINUITY_DIAGNOSTIC_DETAILS_OPEN_BY_DEFAULT = false;

export interface ContinuityEvidenceRow {
  readonly label: string;
  readonly value: string;
  readonly evidence: ObservationEvidence;
}

export interface ContinuityEvidenceGroup {
  readonly name: ContinuityEvidenceGroupName;
  readonly rows: readonly ContinuityEvidenceRow[];
}

export interface ContinuityReviewPresentation {
  readonly listContext: string | null;
  readonly locationContext: string | null;
  readonly primaryTitle: string;
  readonly finding: string;
  readonly explanation: string;
  readonly primaryTarget: ObservationNoteReference;
  readonly stateMarker: string | null;
  readonly evidenceGroups: readonly ContinuityEvidenceGroup[];
  readonly relatedNotes: readonly ObservationNoteReference[];
  readonly technicalEvidence: readonly ObservationEvidence[];
}

export function continuityListNavigationIntent(event: {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}): "detail" | "primary" | null {
  if (event.key !== "Enter") return null;
  return event.ctrlKey || event.metaKey ? "primary" : "detail";
}

function basename(path: string): string {
  return path.replace(/\.md$/i, "").split("/").pop() || "Note";
}

export function continuityNoteLabel(note: ObservationNoteReference): string {
  return note.label?.trim() || basename(note.path);
}

function directlyAffectedStoryWorldNote(item: ContinuityReviewItem): ObservationNoteReference | null {
  if (item.observation.kind === "chapter-context.entity.out-of-scope") {
    return item.observation.evidence.find((evidence) => evidence.role === "entity_scope")?.source.note ?? null;
  }
  if (!item.observation.kind.startsWith("chapter-context.source-data")) return null;
  return observationSourceNotes(item.observation).find((note) => note.role === "story_world") ?? null;
}

export function continuityPrimaryTarget(item: ContinuityReviewItem): ObservationNoteReference {
  return directlyAffectedStoryWorldNote(item) ?? item.observation.primary;
}

export function continuityUnresolvedReference(item: ContinuityReviewItem): string | null {
  const evidence = item.observation.evidence.find((entry) => entry.value.kind === "unresolved_reference");
  return evidence?.value.kind === "unresolved_reference" ? evidence.value.reference : null;
}

function primaryLocation(item: ContinuityReviewItem): ContinuityReviewLocation | null {
  const direct = item.locations.find((location) => location.path === item.observation.primary.path);
  return direct ?? item.locations[0] ?? null;
}

function findingFor(item: ContinuityReviewItem): string {
  const kind = item.observation.kind;
  if (kind === "manuscript.chronology.reversal") return "Story date reverses manuscript order";
  if (kind === "manuscript.chronology.coverage-gap") return "Story dates have an internal coverage gap";
  if (kind === "manuscript.chronology.source-data.malformed") return "Story date is malformed";
  if (kind === "manuscript.chronology.source-data.unsupported") return "Story date uses an unsupported format";
  if (kind === "chapter-context.event.after-chapter") return "Referenced event occurs after this scene";
  if (kind === "chapter-context.relationship.before-valid-from") return "Relationship is not yet valid in this scene";
  if (kind === "chapter-context.relationship.after-valid-until") return "Relationship is no longer valid in this scene";
  if (kind === "chapter-context.entity.out-of-scope") return "Referenced entity’s world_scope excludes this book";
  if (kind === "chapter-context.reference.unresolved") return "Story World reference cannot be resolved";
  if (kind.startsWith("chapter-context.source-data")) {
    const property = item.observation.evidence[0]?.source.property.join(".") ?? "";
    if (property.includes("valid_from") || property.includes("valid_until")) return "Relationship validity date needs review";
    if (property.includes("world_time")) return "Event date needs review";
    return "Story World source value needs review";
  }
  if (kind === "story-world.relationship.incomplete") return "Relationship data is incomplete";
  if (kind === "temporal.explicit-sequence.contradiction") return "Explicit timeline order conflicts with event dates";
  return item.observation.summary;
}

function markerFor(item: ContinuityReviewItem): string | null {
  if (item.match.state === "stale") return "Changed since review";
  if (!item.match.record) return null;
  if (item.match.record.disposition === "intentional") return "Intentional";
  if (item.match.record.disposition === "deferred") return "Deferred";
  return "Resolved · still detected";
}

function explanationFor(item: ContinuityReviewItem): string {
  if (item.observation.kind === "manuscript.chronology.reversal") {
    const previous = item.observation.evidence.find((evidence) => evidence.role === "previous_scene_story_date");
    const later = item.observation.evidence.find((evidence) => evidence.role === "later_scene_story_date");
    if (previous && later) {
      return `${continuityNoteLabel(later.source.note)} appears after ${continuityNoteLabel(previous.source.note)}, but its story date is ${evidenceDisplay(later)} and ${continuityNoteLabel(previous.source.note)} is ${evidenceDisplay(previous)}.`;
    }
  }
  if (item.observation.kind === "chapter-context.entity.out-of-scope") {
    const entityScope = item.observation.evidence.find((evidence) => evidence.role === "entity_scope");
    const owningBook = item.observation.evidence.find((evidence) => evidence.role === "owning_book");
    if (entityScope && owningBook?.value.kind === "resolved_note") {
      return `${continuityNoteLabel(entityScope.source.note)} does not include ${continuityNoteLabel(owningBook.value.note)} in its world_scope property. If the entity belongs in this book, update world_scope on ${continuityNoteLabel(entityScope.source.note)}.`;
    }
  }
  return item.observation.explanation;
}

function formatDate(value: string): string {
  const timed = /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})/.exec(value);
  if (timed) {
    const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(timed[2]) - 1];
    return `${Number(timed[3])} ${month} ${timed[1]}, ${timed[4]}:${timed[5]}`;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(match[2]) - 1];
  return `${Number(match[3])} ${month} ${match[1]}`;
}

function readableReason(reason: string): string {
  return reason.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

function evidenceDisplay(evidence: ObservationEvidence): string {
  const value = evidence.value;
  switch (value.kind) {
    case "missing": return "Missing";
    case "date": return formatDate(value.value);
    case "resolved_note": return continuityNoteLabel(value.note);
    case "unresolved_reference": return `${value.reference} · unresolved`;
    case "malformed": return readableReason(value.reason);
    case "unsupported": return readableReason(value.reason);
    case "value": return typeof value.value === "string" ? value.value : JSON.stringify(value.value);
  }
}

function evidenceGroup(evidence: ObservationEvidence): ContinuityEvidenceGroupName | null {
  const role = evidence.role;
  if (role.includes("order_key") || role.includes("_parent")) return null;
  if (role.includes("story_date") || role === "chapter_date" || role.includes("anchor_story_date")) return "Story dates";
  if (role.includes("relationship")) return "Relationship validity";
  if (role.includes("scope") || role === "owning_book" || role.includes("resolution")) return "Scope or resolution";
  if (role === "sequence_assertion") return "Manuscript order";
  if (
    role.includes("event") || role.includes("subject") || role.includes("target")
    || role.includes("world_context") || role.includes("source_data") || role.includes("reference")
  ) return "Story World source";
  return "Story World source";
}

function groupedEvidence(evidence: readonly ObservationEvidence[]): ContinuityEvidenceGroup[] {
  const names: readonly ContinuityEvidenceGroupName[] = [
    "Manuscript order", "Story dates", "Story World source", "Relationship validity", "Scope or resolution"
  ];
  const groups = new Map<ContinuityEvidenceGroupName, ContinuityEvidenceRow[]>();
  for (const item of evidence) {
    const group = evidenceGroup(item);
    if (!group) continue;
    const rows = groups.get(group) ?? [];
    const label = item.role === "entity_scope"
      ? `${continuityNoteLabel(item.source.note)} · world_scope`
      : continuityNoteLabel(item.source.note);
    rows.push({ label, value: evidenceDisplay(item), evidence: item });
    groups.set(group, rows);
  }
  return names.flatMap((name) => {
    const rows = groups.get(name);
    if (!rows?.length) return [];
    const unique = new Map(rows.map((row) => [`${row.label}\u0000${row.value}`, row]));
    const visibleRows = [...unique.values()];
    if (name === "Story dates") {
      const rank = (row: ContinuityEvidenceRow) => {
        const role = row.evidence.role;
        if (role.includes("previous") || role.includes("before_anchor")) return 0;
        if (role.includes("missing")) return 1;
        if (role.includes("later") || role.includes("after_anchor")) return 2;
        return 1;
      };
      visibleRows.sort((left, right) => rank(left) - rank(right));
    }
    return [{ name, rows: visibleRows }];
  });
}

function relatedNotes(item: ContinuityReviewItem, primary: ObservationNoteReference): ObservationNoteReference[] {
  const notes = new Map<string, ObservationNoteReference>();
  for (const note of [item.observation.primary, ...observationSourceNotes(item.observation)]) {
    if (note.path === primary.path && note.role === primary.role) continue;
    notes.set(`${note.role}\u0000${note.path}`, note);
  }
  return [...notes.values()];
}

export function projectContinuityReviewPresentation(item: ContinuityReviewItem): ContinuityReviewPresentation {
  const primaryTarget = continuityPrimaryTarget(item);
  const location = primaryLocation(item);
  const entityContext = item.entities
    .filter((entity) => entity.path !== primaryTarget.path)
    .map(continuityNoteLabel)[0] ?? null;
  const locationContext = location
    ? [location.partLabel, location.label].filter(Boolean).join(" · ")
    : entityContext;
  return {
    listContext: location?.partLabel ?? entityContext,
    locationContext,
    primaryTitle: continuityNoteLabel(primaryTarget),
    finding: findingFor(item),
    explanation: explanationFor(item),
    primaryTarget,
    stateMarker: markerFor(item),
    evidenceGroups: groupedEvidence(item.observation.evidence),
    relatedNotes: relatedNotes(item, primaryTarget),
    technicalEvidence: item.observation.evidence
  };
}
