import { isRecord, readablePredicateLabel, readableStatusLabel } from "./EntityRelationships";
import { parseWikilink, StoryWorldEntityRecord } from "./StoryWorldIndex";
import { StoryWorldTimelineEvent, StoryWorldTimelineProjection, timelineReferenceLabel } from "./StoryWorldTimeline";
import { parseEventTime } from "./EventTimeEditing";

export type GraphPlacement = "point-year" | "point-month" | "point-day" | "point-minute" | "range" | "unsupported" | "undated";
export interface GraphSceneDescription { readonly path: string; readonly title: string; readonly context: string | null; }
export interface EventSceneGraphNode { readonly id: string; readonly kind: "event" | "scene" | "unresolved"; readonly path: string | null; readonly label: string; readonly context: string | null; readonly placement: GraphPlacement | null; readonly event: StoryWorldTimelineEvent | null; }
export interface EventSceneGraphEdge { readonly id: string; readonly eventId: string; readonly sceneId: string; readonly source: string; }
export interface EventSceneGraphProjection { readonly events: readonly EventSceneGraphNode[]; readonly scenes: readonly EventSceneGraphNode[]; readonly edges: readonly EventSceneGraphEdge[]; }
export type GraphSceneResolver = (path: string) => GraphSceneDescription | null;

export interface TimelineAssertionDocument { readonly path: string; readonly name: string; readonly frontmatter: Readonly<Record<string, unknown>>; }
export interface TimelineAssertionProjection {
  readonly id: string; readonly documentPath: string; readonly subject: string; readonly predicate: string;
  readonly predicateLabel: string; readonly target: string; readonly statusLabel: string; readonly qualifiers: Readonly<Record<string, unknown>>;
  readonly valid: boolean; readonly conflict: string | null;
}

function stable(value: string): string { return encodeURIComponent(value).replace(/%/g, "_"); }
function placement(event: StoryWorldTimelineEvent): GraphPlacement {
  if (event.group === "ranges") return "range";
  if (event.group === "unsupported") return "unsupported";
  if (event.group === "undated") return "undated";
  return `point-${event.precision}` as GraphPlacement;
}
function allEvents(timeline: StoryWorldTimelineProjection): StoryWorldTimelineEvent[] {
  return [...timeline.points, ...timeline.ranges, ...timeline.unsupported, ...timeline.undated];
}

export function projectEventSceneGraph(timeline: StoryWorldTimelineProjection, resolveScene: GraphSceneResolver = () => null): EventSceneGraphProjection {
  const eventNodes: EventSceneGraphNode[] = []; const sceneById = new Map<string, EventSceneGraphNode>(); const edges: EventSceneGraphEdge[] = [];
  for (const event of allEvents(timeline)) {
    const eventId = `event:${stable(event.path)}`;
    eventNodes.push({ id: eventId, kind: "event", path: event.path, label: event.name, context: event.displayTime, placement: placement(event), event });
    event.sources.forEach((source, index) => {
      const resolved = source.resolvedPath ? resolveScene(source.resolvedPath) : null;
      const sceneId = resolved ? `scene:${stable(resolved.path)}` : `unresolved:${stable(source.raw)}`;
      if (!sceneById.has(sceneId)) sceneById.set(sceneId, resolved
        ? { id: sceneId, kind: "scene", path: resolved.path, label: resolved.title, context: resolved.context, placement: null, event: null }
        : { id: sceneId, kind: "unresolved", path: null, label: source.label, context: "Unresolved explicit source", placement: null, event: null });
      edges.push({ id: `edge:${stable(event.path)}:${index}:${stable(source.raw)}`, eventId, sceneId, source: source.raw });
    });
  }
  return { events: eventNodes, scenes: [...sceneById.values()].sort((a, b) => a.id.localeCompare(b.id)), edges };
}

export function graphSelectionProjection(graph: EventSceneGraphProjection, nodeId: string | null): { readonly nodes: readonly string[]; readonly edges: readonly string[] } {
  if (!nodeId || ![...graph.events, ...graph.scenes].some((node) => node.id === nodeId)) return { nodes: [], edges: [] };
  const connected = graph.edges.filter((edge) => edge.eventId === nodeId || edge.sceneId === nodeId);
  return { nodes: [...new Set([nodeId, ...connected.flatMap((edge) => [edge.eventId, edge.sceneId])])], edges: connected.map((edge) => edge.id) };
}

function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function assertions(value: unknown): unknown[] { return Array.isArray(value) ? value : value == null ? [] : [value]; }
function assertionLabel(value: unknown): string { const parsed = parseWikilink(value); return parsed ? timelineReferenceLabel(String(value)) : text(value) ?? "Missing reference"; }
function chronologicalConflict(predicate: string, subjectPath: string | null, targetPath: string | null, sortByPath: ReadonlyMap<string, string>): string | null {
  if (!subjectPath || !targetPath) return null;
  const subject = sortByPath.get(subjectPath); const target = sortByPath.get(targetPath);
  if (!subject || !target || subject === target) return null;
  const claimsBefore = ["precedes", "before"].includes(predicate.toLowerCase());
  const claimsAfter = ["follows", "after"].includes(predicate.toLowerCase());
  if (claimsBefore && subject > target) return "This assertion conflicts with the current world_time ordering.";
  if (claimsAfter && subject < target) return "This assertion conflicts with the current world_time ordering.";
  return null;
}

export function projectTimelineAssertions(
  documents: readonly TimelineAssertionDocument[], entities: readonly StoryWorldEntityRecord[], resolve: (reference: string, sourcePath: string) => string | null,
  visibleEventPaths?: ReadonlySet<string>
): TimelineAssertionProjection[] {
  const sortByPath = new Map<string, string>();
  for (const entity of entities) {
    const time = parseEventTime(entity.properties.world_time);
    if (time.kind === "supported" && time.value.mode === "point") {
      const endpoint = time.value.from;
      sortByPath.set(entity.path, endpoint.date + (time.value.precision === "minute" ? `T${endpoint.time}${endpoint.offset}` : ""));
    }
  }
  const output: TimelineAssertionProjection[] = [];
  for (const document of documents) {
    const modelAssertions = text(document.frontmatter.world_model)?.toLowerCase() === "timeline"
      ? assertions(document.frontmatter.world_assertions) : [];
    const owned = assertions(document.frontmatter.world_relationships)
      .filter((item) => isRecord(item) && ["precedes", "follows", "before", "after"].includes(text(item.predicate)?.toLowerCase() ?? ""))
      .map((item) => isRecord(item) ? { subject: `[[${document.path}]]`, ...item } : item);
    [...modelAssertions, ...owned].forEach((raw, index) => {
      if (!isRecord(raw)) return;
      const predicate = text(raw.predicate); const subjectRaw = text(raw.subject); const targetRaw = text(raw.target);
      if (!predicate || !subjectRaw || !targetRaw) return;
      const subjectPath = resolve(subjectRaw, document.path); const targetPath = resolve(targetRaw, document.path);
      if (visibleEventPaths && !visibleEventPaths.has(subjectPath ?? "") && !visibleEventPaths.has(targetPath ?? "")) return;
      const qualifiers = Object.fromEntries(Object.entries(raw).filter(([key]) => !["subject", "predicate", "predicate_label", "target", "status"].includes(key)));
      output.push({ id: `assertion:${stable(document.path)}:${index}`, documentPath: document.path, subject: assertionLabel(subjectRaw), predicate,
        predicateLabel: readablePredicateLabel(predicate, raw.predicate_label), target: assertionLabel(targetRaw), statusLabel: readableStatusLabel(raw.status), qualifiers,
        valid: subjectPath !== null && targetPath !== null, conflict: chronologicalConflict(predicate, subjectPath, targetPath, sortByPath) });
    });
  }
  return output.sort((a, b) => a.id.localeCompare(b.id));
}
