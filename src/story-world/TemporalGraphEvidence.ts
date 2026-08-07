import { parseTemporalInterval } from "../observations/TemporalInterval";
import { projectEntityRelationships, relationshipProperty } from "./EntityRelationships";
import { StoryWorldGraphProjection } from "./StoryWorldGraph";
import { StoryWorldEntityRecord } from "./StoryWorldIndex";
import { TemporalChangeKind, TemporalGraphEvidence } from "./TemporalStoryWorldGraph";

export interface TemporalEvidenceDocument {
  readonly path: string;
  readonly label: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly manuscriptSequence: number | null;
}

export interface TemporalEvidenceExtractionOptions {
  readonly graph: StoryWorldGraphProjection;
  readonly entities: readonly StoryWorldEntityRecord[];
  readonly documents: readonly TemporalEvidenceDocument[];
  readonly resolve: (reference: unknown, sourcePath: string) => string | null;
}

const values = (value: unknown): unknown[] => Array.isArray(value) ? value : value == null ? [] : [value];
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const record = (value: unknown): Readonly<Record<string, unknown>> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : null;

function temporalDate(value: unknown): { date: string | null; invalid: boolean; reason: string | null } {
  const parsed = parseTemporalInterval(value);
  if (parsed.kind === "missing") return { date: null, invalid: false, reason: null };
  if (parsed.kind !== "supported") return { date: null, invalid: true, reason: parsed.reason };
  const date = parsed.value.from?.source ?? parsed.value.until?.source ?? null;
  return date ? { date, invalid: false, reason: null } : { date: null, invalid: true, reason: "missing_temporal_endpoint" };
}

function fromValue(value: unknown): unknown {
  const item = record(value);
  return item ? item.from ?? item.valid_from ?? null : value;
}

function untilValue(value: unknown): unknown {
  const item = record(value);
  return item ? item.until ?? item.to ?? item.valid_to ?? item.valid_until ?? null : null;
}

function relationshipChange(status: string | null, raw: Readonly<Record<string, unknown>> | null): TemporalChangeKind {
  const explicit = text(raw?.change_type ?? raw?.change)?.toLowerCase();
  const value = explicit ?? status?.toLowerCase() ?? "";
  if (value.includes("contradict")) return "contradiction";
  if (value.includes("supersed")) return "supersession";
  if (value.includes("end") || value === "expired" || value === "inactive") return "ending";
  return "introduction";
}

function unique(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((item): item is string => Boolean(item)))].sort();
}

/** Extracts temporal evidence from the existing graph assertions and their authoritative sources without writing authority. */
export function extractTemporalGraphEvidence(options: TemporalEvidenceExtractionOptions): TemporalGraphEvidence[] {
  const byEntity = new Map(options.entities.map((entity) => [entity.path, entity]));
  const byDocument = new Map(options.documents.map((document) => [document.path, document]));
  const result: TemporalGraphEvidence[] = [];
  for (const edge of options.graph.edges) {
    const owner = byEntity.get(edge.sourcePath);
    const relationshipIndex = edge.kind === "relationship" && typeof edge.sourceProperty[1] === "number" ? edge.sourceProperty[1] : null;
    const relationship = owner && relationshipIndex !== null
      ? projectEntityRelationships(owner.name, owner.properties[relationshipProperty(owner.properties as Record<string, unknown>)])[relationshipIndex]
      : null;
    const raw = record(relationship?.raw);
    const supportingPaths = unique([
      ...values(raw?.source).map((item) => options.resolve(item, edge.sourcePath)),
      ...values(raw?.world_sources).map((item) => options.resolve(item, edge.sourcePath)),
      ...(edge.kind !== "relationship" || owner?.entityType.toLowerCase() === "event"
        ? values(owner?.properties.world_sources).map((item) => options.resolve(item, edge.sourcePath))
        : [])
    ]);
    const eventPath = [edge.from.slice(5), edge.to.slice(5)].find((path) => byEntity.get(path)?.entityType.toLowerCase() === "event") ?? null;
    const event = eventPath ? byEntity.get(eventPath) : null;
    const sourceDocuments = unique(supportingPaths).map((path) => byDocument.get(path)).filter((item): item is TemporalEvidenceDocument => Boolean(item));
    const explicit = temporalDate(edge.kind === "relationship" || edge.kind === "supporting-model"
      ? fromValue(edge.validityValue ?? raw?.valid_from ?? raw?.world_time)
      : null);
    const eventDate = temporalDate(event?.properties.world_time);
    const sceneDates = sourceDocuments.map((document) => ({ document, parsed: temporalDate(document.frontmatter.story_date ?? document.frontmatter.world_time) }));
    const sourceDates = unique(sceneDates.map((item) => item.parsed.date));
    // Effective world time and manuscript reveal time are separate authority. A source Scene may intentionally
    // reveal an older Event or relationship, so differing Scene dates are not temporal contradictions.
    const chosenDate = explicit.date ?? eventDate.date ?? sourceDates[0] ?? null;
    const supporting = sourceDocuments.sort((a, b) => (a.manuscriptSequence ?? Number.MAX_SAFE_INTEGER) - (b.manuscriptSequence ?? Number.MAX_SAFE_INTEGER) || a.path.localeCompare(b.path))[0] ?? null;
    const knownTo = unique([
      ...values(raw?.known_to ?? raw?.known_by ?? raw?.aware_to).map((item) => options.resolve(item, edge.sourcePath)),
      ...(edge.kind === "participation" ? [edge.from.slice(5), edge.to.slice(5)].filter((path) => path !== eventPath) : []),
      ...sourceDocuments.flatMap((document) => values(document.frontmatter.world_context).map((item) => options.resolve(item, document.path)))
    ]);
    const authoritativeInvalid = explicit.invalid ? explicit : explicit.date === null && eventDate.invalid ? eventDate : null;
    const sourceInvalid = chosenDate === null ? sceneDates.find((item) => item.parsed.invalid)?.parsed ?? null : null;
    const invalid = authoritativeInvalid ?? sourceInvalid;
    const diagnostic = invalid ? "invalid-date" as const : undefined;
    const change = relationshipChange(edge.status, raw);
    result.push({
      id: `${edge.id}:${change}`,
      relationshipId: edge.id,
      effectiveDate: chosenDate,
      sourcePath: edge.sourcePath,
      supportingPath: supporting?.path ?? eventPath,
      supportingLabel: supporting?.label ?? event?.name ?? null,
      manuscriptSequence: supporting?.manuscriptSequence ?? null,
      change,
      explicitTime: explicit.date !== null || eventDate.date !== null,
      entityPaths: unique([edge.from.slice(5), edge.to.slice(5)]),
      knownTo,
      ...(diagnostic ? { diagnostic, diagnosticDetail: invalid?.reason ?? "invalid temporal evidence" } : {})
    });
    const ending = temporalDate(untilValue(raw) ?? untilValue(edge.validityValue));
    if (ending.date) result.push({
      id: `${edge.id}:ending`, relationshipId: edge.id, effectiveDate: ending.date, sourcePath: edge.sourcePath,
      supportingPath: supporting?.path ?? eventPath, supportingLabel: supporting?.label ?? event?.name ?? null,
      manuscriptSequence: supporting?.manuscriptSequence ?? null, change: "ending", explicitTime: true,
      entityPaths: unique([edge.from.slice(5), edge.to.slice(5)]), knownTo
    });
  }
  return result;
}
