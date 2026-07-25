import { compareTemporalIntervals, parseTemporalInterval, TemporalInterval } from "../observations/TemporalInterval";

export type ManuscriptImpactEvidenceKind = "direct" | "temporal" | "structured" | "continuity";
export type ManuscriptImpactTiming = "before" | "during" | "after" | "indeterminate";
export type ManuscriptImpactFilter = "all" | ManuscriptImpactEvidenceKind | ManuscriptImpactTiming | "current-book";

export interface ManuscriptImpactSceneInput {
  readonly path: string;
  readonly title: string;
  readonly bookPath: string;
  readonly bookTitle: string;
  readonly partPath: string | null;
  readonly partTitle: string | null;
  readonly order: number;
  readonly pov: string | null;
  readonly storyDate: unknown;
  readonly relativeTimingLabel?: string | null;
  readonly direct: boolean;
  readonly structuredLabels: readonly string[];
  readonly continuityLabels: readonly string[];
}

export interface ManuscriptImpactSelection {
  readonly path: string;
  readonly label: string;
  readonly kind: "entity" | "event" | "relationship";
  readonly temporalValue: unknown;
  readonly temporalUnavailableReason?: string | null;
}

export interface ManuscriptImpactEvidence {
  readonly kind: ManuscriptImpactEvidenceKind;
  readonly label: string;
  readonly timing?: ManuscriptImpactTiming;
}

export interface ManuscriptImpactScene {
  readonly scene: ManuscriptImpactSceneInput;
  readonly evidence: readonly ManuscriptImpactEvidence[];
  readonly timing: ManuscriptImpactTiming | null;
}

export interface ManuscriptImpactProjection {
  readonly selection: ManuscriptImpactSelection;
  readonly results: readonly ManuscriptImpactScene[];
  readonly temporalUnavailableReason: string | null;
}

function supportedInterval(value: unknown): TemporalInterval | null {
  const parsed = parseTemporalInterval(value);
  return parsed.kind === "supported" ? parsed.value : null;
}

export function manuscriptImpactTiming(sceneValue: unknown, selectedValue: unknown): ManuscriptImpactTiming | null {
  const scene = supportedInterval(sceneValue);
  const selected = supportedInterval(selectedValue);
  if (!scene || !selected) return null;
  const relation = compareTemporalIntervals(scene, selected);
  if (relation === "before" || relation === "after") return relation;
  if (relation === "overlap") return "during";
  return "indeterminate";
}

export function buildStoryWorldManuscriptImpact(
  selection: ManuscriptImpactSelection,
  scenes: readonly ManuscriptImpactSceneInput[]
): ManuscriptImpactProjection {
  const selectedInterval = supportedInterval(selection.temporalValue);
  const results = scenes.map((scene): ManuscriptImpactScene | null => {
    const evidence: ManuscriptImpactEvidence[] = [];
    if (scene.direct) evidence.push({ kind: "direct", label: "Direct world_context reference" });
    const timing = manuscriptImpactTiming(scene.storyDate, selection.temporalValue);
    if (timing) evidence.push({
      kind: "temporal",
      timing,
      label: scene.relativeTimingLabel
        ? `Derived: ${scene.relativeTimingLabel}`
        : timing === "indeterminate" ? "Temporal precision prevents a narrower result" : `Derived: ${timing}`
    });
    for (const label of new Set(scene.structuredLabels)) evidence.push({ kind: "structured", label });
    for (const label of new Set(scene.continuityLabels)) evidence.push({ kind: "continuity", label });
    return evidence.length ? { scene, evidence, timing } : null;
  }).filter((result): result is ManuscriptImpactScene => result !== null);
  return {
    selection,
    results,
    temporalUnavailableReason: selectedInterval
      ? null
      : selection.temporalUnavailableReason ?? "The selected item has no supported explicit date or validity interval."
  };
}

export function filterStoryWorldManuscriptImpact(
  projection: ManuscriptImpactProjection,
  filter: ManuscriptImpactFilter,
  selectedBookPath: string | null
): ManuscriptImpactScene[] {
  if (filter === "all") return [...projection.results];
  if (filter === "current-book") return selectedBookPath
    ? projection.results.filter((result) => result.scene.bookPath === selectedBookPath)
    : [];
  if (filter === "before" || filter === "during" || filter === "after") {
    return projection.results.filter((result) => result.timing === filter);
  }
  return projection.results.filter((result) => result.evidence.some((evidence) => evidence.kind === filter));
}
