import { parseTemporalInterval } from "../observations/TemporalInterval";
import { StoryWorldGraphEdge, StoryWorldGraphProjection } from "./StoryWorldGraph";

export type TemporalPerspective = "world" | "entity" | "reader";
export type TemporalDisplayMode = "evidence" | "known" | "changes";
export type TemporalChangeKind = "introduction" | "ending" | "contradiction" | "supersession";

export interface TemporalGraphEvidence {
  readonly id: string;
  readonly relationshipId: string;
  readonly effectiveDate: string | null;
  readonly sourcePath: string;
  readonly supportingPath: string | null;
  readonly supportingLabel: string | null;
  readonly manuscriptSequence: number | null;
  readonly change: TemporalChangeKind;
  readonly explicitTime: boolean;
  readonly entityPaths: readonly string[];
  readonly knownTo: readonly string[];
  readonly diagnostic?: "invalid-date" | "conflicting-dates" | "missing-date";
  readonly diagnosticDetail?: string;
}

export interface TemporalChangePoint {
  readonly date: string;
  readonly evidence: readonly TemporalGraphEvidence[];
  readonly supportingLabel: string | null;
  readonly manuscriptSequence: number | null;
  readonly affectedRelationshipIds: readonly string[];
}

export interface TemporalGraphModel {
  readonly changePoints: readonly TemporalChangePoint[];
  readonly undated: readonly TemporalGraphEvidence[];
  readonly diagnostics: readonly TemporalGraphEvidence[];
}

export interface TemporalRelationshipState {
  readonly relationshipId: string;
  readonly current: boolean;
  readonly change: TemporalChangeKind;
  readonly introducedAt: string | null;
  readonly lastChangedAt: string | null;
  readonly evidence: readonly TemporalGraphEvidence[];
}

export interface TemporalGraphSelection {
  readonly perspective: TemporalPerspective;
  readonly displayMode: TemporalDisplayMode;
  readonly pointIndex: number;
  readonly centrePath: string;
}

function validDate(value: string | null): value is string {
  if (!value) return false;
  const parsed = parseTemporalInterval(value);
  return parsed.kind === "supported" && parsed.value.point;
}

function evidenceOrder(left: TemporalGraphEvidence, right: TemporalGraphEvidence): number {
  return (left.effectiveDate ?? "").localeCompare(right.effectiveDate ?? "")
    || (left.manuscriptSequence ?? Number.MAX_SAFE_INTEGER) - (right.manuscriptSequence ?? Number.MAX_SAFE_INTEGER)
    || left.sourcePath.localeCompare(right.sourcePath)
    || left.relationshipId.localeCompare(right.relationshipId)
    || left.id.localeCompare(right.id);
}

/** Builds deterministic, disposable positions from evidence. Undated evidence is never put on the slider. */
export function buildTemporalGraphModel(evidence: readonly TemporalGraphEvidence[]): TemporalGraphModel {
  const normalized = evidence.map((item) => {
    if (item.diagnostic || item.effectiveDate === null) return item;
    return validDate(item.effectiveDate) ? item : { ...item, diagnostic: "invalid-date" as const, effectiveDate: null };
  }).sort(evidenceOrder);
  const dated = normalized.filter((item) => item.effectiveDate !== null && !item.diagnostic);
  const byDate = new Map<string, TemporalGraphEvidence[]>();
  for (const item of dated) {
    const current = byDate.get(item.effectiveDate!);
    if (current) current.push(item); else byDate.set(item.effectiveDate!, [item]);
  }
  const changePoints = [...byDate].sort(([left], [right]) => left.localeCompare(right)).map(([date, items]): TemporalChangePoint => ({
    date,
    evidence: [...items].sort(evidenceOrder),
    supportingLabel: items.map((item) => item.supportingLabel).find((item): item is string => Boolean(item)) ?? null,
    manuscriptSequence: items.map((item) => item.manuscriptSequence).filter((item): item is number => item !== null).sort((a, b) => a - b)[0] ?? null,
    affectedRelationshipIds: [...new Set(items.map((item) => item.relationshipId))].sort()
  }));
  return {
    changePoints,
    undated: normalized.filter((item) => item.effectiveDate === null && !item.diagnostic),
    diagnostics: normalized.filter((item) => Boolean(item.diagnostic))
  };
}

function evidenceVisible(item: TemporalGraphEvidence, point: TemporalChangePoint, perspective: TemporalPerspective, centrePath: string): boolean {
  if (perspective === "world") return item.effectiveDate !== null && item.effectiveDate <= point.date;
  if (perspective === "entity") return item.effectiveDate !== null && item.effectiveDate <= point.date && item.knownTo.includes(centrePath);
  return item.manuscriptSequence !== null && point.manuscriptSequence !== null && item.manuscriptSequence <= point.manuscriptSequence;
}

/** Reduces explicit changes only. Silence never expires a relationship. */
export function reduceTemporalRelationshipState(
  evidence: readonly TemporalGraphEvidence[], point: TemporalChangePoint, perspective: TemporalPerspective, centrePath: string
): ReadonlyMap<string, TemporalRelationshipState> {
  const result = new Map<string, TemporalRelationshipState>();
  const ordered = evidence.filter((item) => evidenceVisible(item, point, perspective, centrePath)).sort(
    perspective === "reader"
      ? (a, b) => (a.manuscriptSequence ?? Number.MAX_SAFE_INTEGER) - (b.manuscriptSequence ?? Number.MAX_SAFE_INTEGER) || evidenceOrder(a, b)
      : evidenceOrder
  );
  for (const item of ordered) {
    const previous = result.get(item.relationshipId);
    result.set(item.relationshipId, {
      relationshipId: item.relationshipId,
      current: item.change === "introduction",
      change: item.change,
      introducedAt: item.change === "introduction" ? item.effectiveDate : previous?.introducedAt ?? null,
      lastChangedAt: item.effectiveDate,
      evidence: [...(previous?.evidence ?? []), item]
    });
  }
  return result;
}

function selectedEvidence(model: TemporalGraphModel, selection: TemporalGraphSelection): TemporalGraphEvidence[] {
  const point = model.changePoints[selection.pointIndex];
  if (!point) return [];
  if (selection.displayMode === "evidence" || selection.displayMode === "changes") {
    return point.evidence.filter((item) => selection.perspective !== "entity" || item.knownTo.includes(selection.centrePath));
  }
  return model.changePoints.flatMap((item) => item.evidence).filter((item) => evidenceVisible(item, point, selection.perspective, selection.centrePath));
}

/** Applies temporal semantics to an existing bounded graph; layout, centre, density and truncation remain owned by the graph projection. */
export function projectTemporalGraph(
  graph: StoryWorldGraphProjection, model: TemporalGraphModel, selection: TemporalGraphSelection
): StoryWorldGraphProjection {
  const point = model.changePoints[selection.pointIndex];
  if (!point) return { ...graph, nodes: graph.nodes.filter((node) => node.central), edges: [] };
  const allEvidence = model.changePoints.flatMap((item) => item.evidence);
  const selected = selectedEvidence(model, selection);
  const pointEvidence = point.evidence.filter((item) => selection.perspective !== "entity" || item.knownTo.includes(selection.centrePath));
  const changes = new Map(pointEvidence.map((item) => [item.relationshipId, item]));
  let visibleIds: Set<string>;
  if (selection.displayMode === "known") {
    const state = reduceTemporalRelationshipState(allEvidence, point, selection.perspective, selection.centrePath);
    visibleIds = new Set([...state.values()].filter((item) => item.current).map((item) => item.relationshipId));
  } else visibleIds = new Set(selected.map((item) => item.relationshipId));
  const edges: StoryWorldGraphEdge[] = graph.edges.filter((edge) => visibleIds.has(edge.id)).map((edge) => ({
    ...edge,
    temporal: {
      change: changes.get(edge.id)?.change ?? "unchanged",
      subdued: selection.displayMode === "known" && !point.affectedRelationshipIds.includes(edge.id),
      evidence: (selection.displayMode === "known" ? allEvidence : selected).filter((item) => item.relationshipId === edge.id)
    }
  }));
  const connected = new Set(edges.flatMap((edge) => [edge.from.slice(5), edge.to.slice(5)]));
  return { ...graph, edges, nodes: graph.nodes.filter((node) => node.central || connected.has(node.path)) };
}

export function moveTemporalPoint(current: number, direction: -1 | 1, count: number): number {
  return Math.max(0, Math.min(Math.max(0, count - 1), current + direction));
}
