import {
  buildContinuityObservation,
  ContinuityObservation,
  normalizeObservationValue,
  ObservationEvidence,
  ObservationNoteReference,
  ObservationSource
} from "./ContinuityObservation";
import {
  compareTemporalIntervals,
  parseTemporalInterval,
  TemporalInterval
} from "./TemporalInterval";
import type {
  ManuscriptOrderDiagnosticKind,
  ManuscriptOrderResult
} from "../manuscript/ManuscriptOrder";

export interface OrderedSceneChronologyInput {
  readonly scene: ObservationNoteReference;
  readonly parent: ObservationNoteReference;
  readonly sequenceEvidence: readonly ObservationEvidence[];
  readonly storyDate: {
    readonly source: ObservationSource;
    readonly raw: unknown;
  };
}

export interface ManuscriptChronologyInput {
  readonly book: ObservationNoteReference;
  /** Scenes are already in authoritative distributed manuscript order. */
  readonly scenes: readonly OrderedSceneChronologyInput[];
}

const RULES = {
  reversal: { id: "mwc.manuscript.chronology.reversal", version: 1 },
  coverageGap: { id: "mwc.manuscript.chronology.coverage-gap", version: 1 },
  sourceData: { id: "mwc.manuscript.chronology.source-data", version: 1 }
} as const;

const UNSAFE_ORDER_DIAGNOSTICS: ReadonlySet<ManuscriptOrderDiagnosticKind> = new Set([
  "missing_parent",
  "invalid_parent_kind",
  "parent_cycle",
  "missing_order_key",
  "invalid_order_key",
  "duplicate_order_key"
]);

export function manuscriptChronologyOrderIsSafe(result: ManuscriptOrderResult): boolean {
  return result.source === "distributed"
    && !result.diagnostics.some((diagnostic) => UNSAFE_ORDER_DIAGNOSTICS.has(diagnostic.kind));
}

interface ParsedScene {
  readonly input: OrderedSceneChronologyInput;
  readonly interval: TemporalInterval | null;
  readonly missing: boolean;
}

function rawEvidence(raw: unknown) {
  if (raw instanceof Date && Number.isNaN(raw.getTime())) return "Invalid Date";
  return normalizeObservationValue(raw);
}

function dateEvidence(
  role: string,
  scene: OrderedSceneChronologyInput,
  interval: TemporalInterval
): ObservationEvidence {
  return {
    role,
    source: scene.storyDate.source,
    value: {
      kind: "date",
      value: interval.from?.source ?? interval.source,
      precision: interval.from?.precision ?? interval.precision
    }
  };
}

function sourceDataObservation(
  scene: OrderedSceneChronologyInput,
  raw: unknown,
  reason: string,
  unsupported: boolean
): ContinuityObservation {
  return buildContinuityObservation({
    kind: unsupported
      ? "manuscript.chronology.source-data.unsupported"
      : "manuscript.chronology.source-data.malformed",
    severity: "review",
    classification: unsupported ? "review_concern" : "malformed_evidence",
    primary: scene.scene,
    evidence: [{
      role: "scene_story_date",
      source: scene.storyDate.source,
      value: unsupported
        ? { kind: "unsupported", raw: rawEvidence(raw), reason }
        : { kind: "malformed", raw: rawEvidence(raw), reason }
    }],
    summary: "Scene date needs review",
    explanation: `Chronology evaluation did not use this story_date because it is ${unsupported ? "unsupported" : "malformed"} (${reason}).`,
    rule: RULES.sourceData,
    logicalOccurrence: {
      scene: scene.scene.path,
      field: [...scene.storyDate.source.property]
    }
  });
}

function parseScenes(
  input: ManuscriptChronologyInput,
  observations: ContinuityObservation[]
): ParsedScene[] {
  return input.scenes.map((scene) => {
    const parsed = parseTemporalInterval(scene.storyDate.raw);
    if (parsed.kind === "missing") return { input: scene, interval: null, missing: true };
    const structured = typeof scene.storyDate.raw === "object"
      && scene.storyDate.raw !== null
      && !(scene.storyDate.raw instanceof Date);
    if (parsed.kind === "supported" && parsed.value.point && !structured) {
      return { input: scene, interval: parsed.value, missing: false };
    }
    if (parsed.kind === "supported") {
      observations.push(sourceDataObservation(
        scene,
        scene.storyDate.raw,
        parsed.value.point
          ? "chapter_story_date_structure_not_supported"
          : "chapter_story_date_range_not_supported",
        true
      ));
    } else {
      observations.push(sourceDataObservation(
        scene,
        parsed.raw,
        parsed.reason,
        parsed.kind === "unsupported"
      ));
    }
    return { input: scene, interval: null, missing: false };
  });
}

function observeReversals(
  input: ManuscriptChronologyInput,
  scenes: readonly ParsedScene[],
  observations: ContinuityObservation[]
) {
  let previous: ParsedScene | null = null;
  for (const current of scenes) {
    if (!current.interval) continue;
    if (
      previous?.interval
      && compareTemporalIntervals(current.interval, previous.interval) === "before"
    ) {
      observations.push(buildContinuityObservation({
        kind: "manuscript.chronology.reversal",
        severity: "review",
        classification: "review_concern",
        primary: current.input.scene,
        evidence: [
          dateEvidence("previous_scene_story_date", previous.input, previous.interval),
          dateEvidence("later_scene_story_date", current.input, current.interval),
          ...previous.input.sequenceEvidence,
          ...current.input.sequenceEvidence
        ],
        summary: "Scene chronology reverses manuscript order",
        explanation: `${current.input.scene.label ?? current.input.scene.path} is later in the manuscript, but its explicit story_date (${current.interval.source}) is provably earlier than ${previous.input.scene.label ?? previous.input.scene.path} (${previous.interval.source}). This may be intentional non-linear narration and should be reviewed.`,
        rule: RULES.reversal,
        logicalOccurrence: {
          book: input.book.path,
          previousDatedScene: previous.input.scene.path,
          laterScene: current.input.scene.path
        }
      }));
    }
    previous = current;
  }
}

function observeCoverageGaps(
  input: ManuscriptChronologyInput,
  scenes: readonly ParsedScene[],
  observations: ContinuityObservation[]
) {
  let index = 0;
  while (index < scenes.length) {
    if (!scenes[index].missing) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < scenes.length && scenes[index].missing) index += 1;
    const before = start > 0 ? scenes[start - 1] : null;
    const after = index < scenes.length ? scenes[index] : null;
    if (!before?.interval || !after?.interval) continue;
    const missing = scenes.slice(start, index);
    observations.push(buildContinuityObservation({
      kind: "manuscript.chronology.coverage-gap",
      severity: "review",
      classification: "review_concern",
      primary: missing[0].input.scene,
      evidence: [
        dateEvidence("before_anchor_story_date", before.input, before.interval),
        ...missing.map((scene): ObservationEvidence => ({
          role: "missing_scene_story_date",
          source: scene.input.storyDate.source,
          value: { kind: "missing" }
        })),
        dateEvidence("after_anchor_story_date", after.input, after.interval),
        ...before.input.sequenceEvidence,
        ...missing.flatMap((scene) => scene.input.sequenceEvidence),
        ...after.input.sequenceEvidence
      ],
      summary: "Scene dates have an internal coverage gap",
      explanation: `${missing.length} undated ${missing.length === 1 ? "scene sits" : "scenes sit"} between explicitly dated scenes in manuscript order. Review whether chronology metadata is intentionally incomplete.`,
      rule: RULES.coverageGap,
      logicalOccurrence: {
        book: input.book.path,
        beforeAnchor: before.input.scene.path,
        afterAnchor: after.input.scene.path,
        missingScenes: missing.map((scene) => scene.input.scene.path)
      }
    }));
  }
}

/** Evaluates an already validated authoritative book projection without reading or writing Markdown. */
export function evaluateManuscriptChronology(
  input: ManuscriptChronologyInput
): readonly ContinuityObservation[] {
  const observations: ContinuityObservation[] = [];
  const scenes = parseScenes(input, observations);
  observeReversals(input, scenes, observations);
  observeCoverageGaps(input, scenes, observations);
  return observations.sort((left, right) => {
    const leftIndex = input.scenes.findIndex((scene) => scene.scene.path === left.primary.path);
    const rightIndex = input.scenes.findIndex((scene) => scene.scene.path === right.primary.path);
    return leftIndex - rightIndex
      || (left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0)
      || (left.lineageKey < right.lineageKey ? -1 : left.lineageKey > right.lineageKey ? 1 : 0);
  });
}
