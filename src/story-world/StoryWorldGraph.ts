import { ContinuityObservation, observationSourceNotes } from "../observations/ContinuityObservation";
import { compareTemporalIntervals, parseTemporalInterval } from "../observations/TemporalInterval";
import { projectEntityRelationships, relationshipProperty } from "./EntityRelationships";
import { StoryWorldEntityRecord } from "./StoryWorldIndex";

export type StoryWorldGraphNodeKind = "entity" | "event" | "model" | "scene";
export type StoryWorldGraphEdgeKind = "relationship" | "participation" | "provenance" | "supporting-model";
export type StoryWorldGraphValidity = "active" | "future" | "expired" | "indeterminate" | "unfiltered";
export type StoryWorldGraphDensity = "compact" | "comfortable" | "spacious";

export interface StoryWorldGraphDocument {
  readonly path: string;
  readonly basename: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
}

export interface StoryWorldGraphNode {
  readonly id: string;
  readonly kind: StoryWorldGraphNodeKind;
  readonly entityType: string;
  readonly label: string;
  readonly path: string;
  readonly central: boolean;
  readonly status: string | null;
  readonly scope: readonly string[];
  readonly reviewFingerprints: readonly string[];
  readonly manuscriptImpactCount: number | null;
}

export interface StoryWorldGraphEdge {
  readonly id: string;
  readonly kind: StoryWorldGraphEdgeKind;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly predicate: string | null;
  readonly sourcePath: string;
  readonly sourceProperty: readonly (string | number)[];
  readonly status: string | null;
  readonly validity: StoryWorldGraphValidity;
  readonly validityValue: unknown;
  readonly direction: "authored";
  readonly provenance: "authored-assertion" | "explicit-participant" | "explicit-source" | "explicit-model";
  readonly evidenceIdentity: string;
  readonly reviewFingerprints: readonly string[];
  readonly temporal?: {
    readonly change: "introduction" | "ending" | "contradiction" | "supersession" | "unchanged";
    readonly subdued: boolean;
    readonly evidence: readonly import("./TemporalStoryWorldGraph").TemporalGraphEvidence[];
  };
}

export interface StoryWorldGraphDiagnostic {
  readonly sourcePath: string;
  readonly sourceProperty: readonly (string | number)[];
  readonly message: string;
  readonly reviewFingerprints: readonly string[];
}

export interface StoryWorldGraphProjection {
  readonly selectedPath: string;
  readonly nodes: readonly StoryWorldGraphNode[];
  readonly edges: readonly StoryWorldGraphEdge[];
  readonly diagnostics: readonly StoryWorldGraphDiagnostic[];
  readonly truncated: boolean;
  readonly omittedNodeCount: number;
  readonly availablePredicates: readonly string[];
  readonly availableStatuses: readonly string[];
  readonly dateFilterUnavailable: boolean;
}

export interface StoryWorldGraphOptions {
  readonly selectedPath: string;
  readonly entities: readonly StoryWorldEntityRecord[];
  readonly documents?: readonly StoryWorldGraphDocument[];
  readonly observations?: readonly ContinuityObservation[];
  readonly resolve: (reference: unknown, sourcePath: string) => string | null;
  readonly scene?: (path: string) => { readonly label: string } | null;
  readonly includeProvenance?: boolean;
  readonly impactCount?: number;
  readonly predicate?: string | null;
  readonly status?: string | null;
  readonly nodeType?: string | null;
  readonly allowedPaths?: ReadonlySet<string> | null;
  readonly validity?: Exclude<StoryWorldGraphValidity, "unfiltered"> | null;
  readonly referenceDate?: unknown;
  readonly nodeLimit?: number;
}

const values = (value: unknown): unknown[] => Array.isArray(value) ? value : value == null ? [] : [value];
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const nodeId = (path: string): string => `note:${path}`;
const stable = (value: string): string => encodeURIComponent(value).replace(/%/g, "_");

function observationMap(observations: readonly ContinuityObservation[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const observation of observations) {
    const paths = new Set([observation.primary.path, ...observationSourceNotes(observation).map((item) => item.path)]);
    for (const path of paths) {
      const fingerprints = result.get(path) ?? [];
      fingerprints.push(observation.fingerprint);
      result.set(path, fingerprints);
    }
  }
  for (const [path, fingerprints] of result) result.set(path, [...new Set(fingerprints)].sort());
  return result;
}

function validityValue(raw: Readonly<Record<string, unknown>>): unknown {
  if (raw.validity != null) return raw.validity;
  if (raw.world_time != null) return raw.world_time;
  if (raw.valid_from != null || raw.valid_to != null || raw.valid_until != null) {
    return Object.fromEntries([
      ...(raw.valid_from != null ? [["from", raw.valid_from]] : []),
      ...(raw.valid_to != null || raw.valid_until != null ? [["until", raw.valid_to ?? raw.valid_until]] : [])
    ]);
  }
  return undefined;
}

export function storyWorldGraphValidity(value: unknown, referenceDate: unknown): StoryWorldGraphValidity {
  if (value == null || referenceDate == null) return "indeterminate";
  const interval = parseTemporalInterval(value);
  const reference = parseTemporalInterval(referenceDate);
  if (interval.kind !== "supported" || reference.kind !== "supported") return "indeterminate";
  const relation = compareTemporalIntervals(interval.value, reference.value);
  return relation === "before" ? "expired" : relation === "after" ? "future" : relation === "overlap" ? "active" : "indeterminate";
}

function graphNode(entity: StoryWorldEntityRecord, central: boolean, reviews: ReadonlyMap<string, string[]>, impact: number | null): StoryWorldGraphNode {
  return {
    id: nodeId(entity.path), kind: entity.entityType.toLowerCase() === "event" ? "event" : "entity",
    entityType: entity.entityType, label: entity.name, path: entity.path, central, status: entity.status,
    scope: entity.scope, reviewFingerprints: reviews.get(entity.path) ?? [], manuscriptImpactCount: impact
  };
}

function sourceReviews(observations: readonly ContinuityObservation[], sourcePath: string, property: readonly (string | number)[]): string[] {
  return observations.filter((observation) => observation.evidence.some((evidence) =>
    evidence.source.note.path === sourcePath
    && evidence.source.property.length >= property.length
    && property.every((segment, index) => evidence.source.property[index] === segment)
  )).map((observation) => observation.fingerprint).sort();
}

/** Builds a disposable, deterministic bounded neighbourhood from explicit indexed metadata only. */
export function buildStoryWorldGraph(options: StoryWorldGraphOptions): StoryWorldGraphProjection {
  const byPath = new Map(options.entities.map((entity) => [entity.path, entity]));
  const selected = byPath.get(options.selectedPath);
  const selectedDocument = options.documents?.find((document) => document.path === options.selectedPath && text(document.frontmatter.world_model));
  if (!selected && !selectedDocument) return { selectedPath: options.selectedPath, nodes: [], edges: [], diagnostics: [], truncated: false, omittedNodeCount: 0, availablePredicates: [], availableStatuses: [], dateFilterUnavailable: options.validity != null };
  const reviews = observationMap(options.observations ?? []);
  const candidateEdges: StoryWorldGraphEdge[] = [];
  const diagnostics: StoryWorldGraphDiagnostic[] = [];
  const addRelationship = (owner: StoryWorldEntityRecord) => {
    const property = relationshipProperty(owner.properties as Record<string, unknown>);
    for (const relationship of projectEntityRelationships(owner.name, owner.properties[property])) {
      const sourceProperty = relationship.index < 0 ? [property] : [property, relationship.index];
      if (!relationship.valid || relationship.objectKind !== "target" || typeof relationship.objectValue !== "string") {
        if (owner.path === options.selectedPath && !relationship.valid) diagnostics.push({
          sourcePath: owner.path, sourceProperty, message: relationship.issue ?? "Incomplete relationship.", reviewFingerprints: sourceReviews(options.observations ?? [], owner.path, sourceProperty)
        });
        continue;
      }
      const targetPath = options.resolve(relationship.objectValue, owner.path);
      if (!targetPath || !byPath.has(targetPath)) {
        if (owner.path === options.selectedPath) diagnostics.push({ sourcePath: owner.path, sourceProperty, message: `Unresolved target ${relationship.objectValue}.`, reviewFingerprints: sourceReviews(options.observations ?? [], owner.path, sourceProperty) });
        continue;
      }
      if (owner.path !== options.selectedPath && targetPath !== options.selectedPath) continue;
      const raw = relationship.raw as Readonly<Record<string, unknown>>;
      const validity = validityValue(raw);
      candidateEdges.push({
        id: `relationship:${stable(owner.path)}:${relationship.index}:${stable(targetPath)}`,
        kind: "relationship", from: nodeId(owner.path), to: nodeId(targetPath), label: relationship.predicateLabel ?? relationship.predicate!,
        predicate: relationship.predicate, sourcePath: owner.path, sourceProperty, status: relationship.status,
        validity: storyWorldGraphValidity(validity, options.referenceDate), validityValue: validity,
        direction: "authored", provenance: "authored-assertion",
        evidenceIdentity: `${owner.path}#${property}.${relationship.index}`, reviewFingerprints: sourceReviews(options.observations ?? [], owner.path, sourceProperty)
      });
    }
  };
  options.entities.forEach(addRelationship);

  for (const event of options.entities.filter((entity) => entity.entityType.toLowerCase() === "event")) {
    const property = event.properties.world_participants != null ? "world_participants" : event.properties.participants != null ? "participants" : "world_participant";
    values(event.properties[property]).forEach((reference, index) => {
      const participantPath = options.resolve(reference, event.path);
      if (!participantPath || !byPath.has(participantPath)) return;
      if (event.path !== options.selectedPath && participantPath !== options.selectedPath) return;
      candidateEdges.push({
        id: `participant:${stable(event.path)}:${index}:${stable(participantPath)}`, kind: "participation",
        from: nodeId(event.path), to: nodeId(participantPath), label: "participant", predicate: "participant",
        sourcePath: event.path, sourceProperty: [property, index], status: event.status, validity: "indeterminate", validityValue: event.properties.world_time,
        direction: "authored", provenance: "explicit-participant", evidenceIdentity: `${event.path}#${property}.${index}`,
        reviewFingerprints: sourceReviews(options.observations ?? [], event.path, [property, index])
      });
    });
  }

  if (options.includeProvenance && selected?.entityType.toLowerCase() === "event") {
    values(selected.properties.world_sources).forEach((reference, index) => {
      const path = options.resolve(reference, selected.path); const scene = path ? options.scene?.(path) : null;
      if (!path || !scene) return;
      candidateEdges.push({
        id: `source:${stable(selected.path)}:${index}:${stable(path)}`, kind: "provenance", from: nodeId(selected.path), to: nodeId(path),
        label: "manuscript source", predicate: null, sourcePath: selected.path, sourceProperty: ["world_sources", index], status: null,
        validity: "indeterminate", validityValue: null, direction: "authored", provenance: "explicit-source",
        evidenceIdentity: `${selected.path}#world_sources.${index}`, reviewFingerprints: sourceReviews(options.observations ?? [], selected.path, ["world_sources", index])
      });
    });
  }

  for (const document of options.documents ?? []) {
    const model = text(document.frontmatter.world_model); if (!model) continue;
    const references = values(document.frontmatter.world_model_subject ?? document.frontmatter.subject);
    references.forEach((reference, index) => {
      const targetPath = options.resolve(reference, document.path); if (!targetPath || document.path !== options.selectedPath && targetPath !== options.selectedPath) return;
      candidateEdges.push({
        id: `model:${stable(document.path)}:${index}:${stable(targetPath)}`, kind: "supporting-model", from: nodeId(document.path), to: nodeId(targetPath),
        label: model, predicate: null, sourcePath: document.path, sourceProperty: ["world_model_subject", index], status: text(document.frontmatter.status),
        validity: "indeterminate", validityValue: null, direction: "authored", provenance: "explicit-model",
        evidenceIdentity: `${document.path}#world_model_subject.${index}`, reviewFingerprints: sourceReviews(options.observations ?? [], document.path, ["world_model_subject", index])
      });
    });
    if (model.toLowerCase() === "timeline") values(document.frontmatter.world_assertions).forEach((raw, index) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
      const assertion = raw as Readonly<Record<string, unknown>>;
      const predicate = text(assertion.predicate); const subjectPath = options.resolve(assertion.subject, document.path); const targetPath = options.resolve(assertion.target, document.path);
      if (!predicate || !subjectPath || !targetPath || !byPath.has(subjectPath) || !byPath.has(targetPath)) return;
      if (document.path !== options.selectedPath && subjectPath !== options.selectedPath && targetPath !== options.selectedPath) return;
      const validity = validityValue(assertion);
      candidateEdges.push({
        id: `timeline:${stable(document.path)}:${index}:${stable(subjectPath)}:${stable(targetPath)}`, kind: "supporting-model",
        from: nodeId(subjectPath), to: nodeId(targetPath), label: predicate, predicate, sourcePath: document.path,
        sourceProperty: ["world_assertions", index], status: text(assertion.status), validity: storyWorldGraphValidity(validity, options.referenceDate), validityValue: validity,
        direction: "authored", provenance: "explicit-model", evidenceIdentity: `${document.path}#world_assertions.${index}`,
        reviewFingerprints: sourceReviews(options.observations ?? [], document.path, ["world_assertions", index])
      });
      if (document.path === options.selectedPath) for (const [role, path] of [["timeline subject", subjectPath], ["timeline target", targetPath]] as const) {
        candidateEdges.push({
          id: `timeline-role:${stable(document.path)}:${index}:${role}:${stable(path)}`, kind: "supporting-model", from: nodeId(document.path), to: nodeId(path),
          label: role, predicate: null, sourcePath: document.path, sourceProperty: ["world_assertions", index], status: text(assertion.status),
          validity: "indeterminate", validityValue: null, direction: "authored", provenance: "explicit-model",
          evidenceIdentity: `${document.path}#world_assertions.${index}:${role}`, reviewFingerprints: sourceReviews(options.observations ?? [], document.path, ["world_assertions", index])
        });
      }
    });
  }

  const deduplicatedEdges = [...new Map(candidateEdges.map((edge) => [
    [edge.kind, edge.from, edge.to, edge.label, edge.status ?? "", JSON.stringify(edge.validityValue ?? null)].join("\u0000"), edge
  ])).values()];
  const availablePredicates = [...new Set(deduplicatedEdges.map((edge) => edge.predicate).filter((item): item is string => Boolean(item)))].sort();
  const availableStatuses = [...new Set(deduplicatedEdges.map((edge) => edge.status).filter((item): item is string => Boolean(item)))].sort();
  const allowed = options.allowedPaths;
  const filtered = deduplicatedEdges.filter((edge) => {
    const fromPath = edge.from.slice(5); const toPath = edge.to.slice(5);
    return (!options.predicate || edge.predicate === options.predicate)
      && (!options.status || edge.status === options.status)
      && (!options.validity || edge.validity === options.validity)
      && (!allowed || allowed.has(fromPath) && allowed.has(toPath));
  }).sort((a, b) => a.id.localeCompare(b.id));
  const connectedPaths = [...new Set(filtered.flatMap((edge) => [edge.from.slice(5), edge.to.slice(5)]))];
  const centralNode: StoryWorldGraphNode = selected
    ? graphNode(selected, true, reviews, options.impactCount ?? null)
    : { id: nodeId(selectedDocument!.path), kind: "model", entityType: text(selectedDocument!.frontmatter.world_model)!, label: selectedDocument!.basename,
      path: selectedDocument!.path, central: true, status: text(selectedDocument!.frontmatter.status), scope: [], reviewFingerprints: reviews.get(selectedDocument!.path) ?? [], manuscriptImpactCount: null };
  const nodeCandidates: StoryWorldGraphNode[] = [centralNode];
  const edgePriority: Record<StoryWorldGraphEdgeKind, number> = { relationship: 0, participation: 1, "supporting-model": 2, provenance: 3 };
  const pathPriority = (path: string): number => Math.min(...filtered.filter((edge) => edge.from === nodeId(path) || edge.to === nodeId(path)).map((edge) => edgePriority[edge.kind]));
  for (const path of connectedPaths.sort((left, right) => pathPriority(left) - pathPriority(right) || left.localeCompare(right))) {
    if (path === options.selectedPath) continue;
    const entity = byPath.get(path);
    if (entity) nodeCandidates.push(graphNode(entity, false, reviews, null));
    else {
      const document = options.documents?.find((item) => item.path === path);
      const scene = options.scene?.(path);
      nodeCandidates.push({ id: nodeId(path), kind: scene ? "scene" : "model", entityType: scene ? "scene" : text(document?.frontmatter.world_model) ?? "model",
        label: scene?.label ?? document?.basename ?? path, path, central: false, status: text(document?.frontmatter.status), scope: [],
        reviewFingerprints: reviews.get(path) ?? [], manuscriptImpactCount: null });
    }
  }
  const typeFiltered = options.nodeType
    ? nodeCandidates.filter((node) => node.central || node.kind === options.nodeType || node.entityType === options.nodeType)
    : nodeCandidates;
  const typePaths = new Set(typeFiltered.map((node) => node.id));
  const typeEdges = filtered.filter((edge) => typePaths.has(edge.from) && typePaths.has(edge.to));
  const limit = Math.max(2, options.nodeLimit ?? 36);
  const nodes = typeFiltered.slice(0, limit);
  const visible = new Set(nodes.map((node) => node.id));
  const edges = typeEdges.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
  return {
    selectedPath: options.selectedPath, nodes, edges, diagnostics: diagnostics.sort((a, b) => a.sourceProperty.join(".").localeCompare(b.sourceProperty.join("."))),
    truncated: typeFiltered.length > limit, omittedNodeCount: Math.max(0, typeFiltered.length - limit), availablePredicates, availableStatuses,
    dateFilterUnavailable: options.validity != null && options.referenceDate == null
  };
}

export interface StoryWorldGraphPosition { readonly x: number; readonly y: number; }

export type StoryWorldGraphNodeShape = "ellipse" | "rectangle" | "diamond" | "hexagon" | "chevron";

export function storyWorldGraphNodeShape(node: Pick<StoryWorldGraphNode, "kind" | "entityType">): StoryWorldGraphNodeShape {
  if (node.kind === "event" || node.entityType.trim().toLowerCase() === "event") return "chevron";
  const type = node.entityType.trim().toLowerCase();
  if (["location", "place"].includes(type)) return "rectangle";
  if (["organisation", "organization", "institution"].includes(type)) return "diamond";
  if (["concept", "technology", "system"].includes(type)) return "hexagon";
  return "ellipse";
}

export function storyWorldGraphStatusIsProvisional(status: string | null): boolean {
  return status != null && !["confirmed", "canon", "canonical", "complete"].includes(status.trim().toLowerCase());
}

/** Stable radial layout; positions are presentation output and never persisted as canon. */
export const STORY_WORLD_GRAPH_DENSITIES: Readonly<Record<StoryWorldGraphDensity, { readonly radius: number; readonly labelOffset: number }>> = {
  compact: { radius: 0.27, labelOffset: 5 },
  comfortable: { radius: 0.34, labelOffset: 7 },
  spacious: { radius: 0.41, labelOffset: 10 }
};

export function layoutStoryWorldGraph(graph: StoryWorldGraphProjection, width: number, height: number, density: StoryWorldGraphDensity = "comfortable"): ReadonlyMap<string, StoryWorldGraphPosition> {
  const positions = new Map<string, StoryWorldGraphPosition>();
  const centre = graph.nodes.find((node) => node.central); if (!centre) return positions;
  const x = width / 2; const y = height / 2; positions.set(centre.id, { x, y });
  const preset = STORY_WORLD_GRAPH_DENSITIES[density];
  const neighbours = graph.nodes.filter((node) => !node.central).sort((a, b) => a.id.localeCompare(b.id));
  const radius = Math.max(90, Math.min(width, height) * preset.radius);
  neighbours.forEach((node, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index / Math.max(1, neighbours.length));
    positions.set(node.id, { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
  });
  return positions;
}
