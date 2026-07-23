import {
  ContinuityObservation,
  ObservationNoteReference,
  observationSourceNotes
} from "./ContinuityObservation";
import {
  ContinuityDispositionRecord,
  DispositionMatch,
  matchContinuityDisposition
} from "./ContinuityDisposition";

export type ContinuityReviewQueueFilter = "active" | "reviewed" | "all";

export interface ContinuityReviewLocation {
  readonly path: string;
  readonly label: string;
  readonly kind: "part" | "chapter";
  readonly order: number;
  readonly partPath: string | null;
  readonly partLabel: string | null;
}

export interface ContinuityReviewManuscriptScope {
  readonly book: ObservationNoteReference;
  readonly manuscriptPaths: ReadonlySet<string>;
  readonly locations: ReadonlyMap<string, ContinuityReviewLocation>;
  readonly explicitlyReferencedStoryWorldPaths: ReadonlySet<string>;
}

export interface ContinuityReviewFilters {
  readonly queue: ContinuityReviewQueueFilter;
  readonly type: string | null;
  readonly locationPath: string | null;
  readonly entityPath: string | null;
}

export interface ContinuityReviewItem {
  readonly observation: ContinuityObservation;
  readonly match: DispositionMatch;
  readonly inclusionReason:
    | "primary-manuscript"
    | "supporting-manuscript"
    | "referenced-story-world";
  readonly locations: readonly ContinuityReviewLocation[];
  readonly entities: readonly ObservationNoteReference[];
}

export interface ContinuityReviewFilterOption {
  readonly value: string;
  readonly label: string;
}

export interface ContinuityReviewProjection {
  readonly items: readonly ContinuityReviewItem[];
  readonly counts: {
    readonly active: number;
    readonly reviewed: number;
    readonly displayed: number;
  };
  readonly filterOptions: {
    readonly types: readonly ContinuityReviewFilterOption[];
    readonly locations: readonly ContinuityReviewFilterOption[];
    readonly entities: readonly ContinuityReviewFilterOption[];
  };
}

export interface ContinuityReviewInput {
  readonly observations: readonly ContinuityObservation[];
  readonly dispositions: ReadonlyMap<string, ContinuityDispositionRecord>;
  readonly manuscriptScope: ContinuityReviewManuscriptScope;
}

export function reconcileContinuityReviewFilters(
  filters: ContinuityReviewFilters,
  options: ContinuityReviewProjection["filterOptions"]
): ContinuityReviewFilters {
  const valid = (values: readonly ContinuityReviewFilterOption[], value: string | null) => (
    !value || values.some((option) => option.value === value)
  );
  return {
    queue: filters.queue,
    type: valid(options.types, filters.type) ? filters.type : null,
    locationPath: valid(options.locations, filters.locationPath) ? filters.locationPath : null,
    entityPath: valid(options.entities, filters.entityPath) ? filters.entityPath : null
  };
}

function displayKind(kind: string): string {
  return kind
    .split(".")
    .filter(Boolean)
    .map((part) => part.replace(/[-_]+/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
}

function noteLabel(note: ObservationNoteReference): string {
  return note.label?.trim()
    || note.path.replace(/\.md$/i, "").split("/").pop()
    || "Note";
}

function distinctNotes(notes: readonly ObservationNoteReference[]): ObservationNoteReference[] {
  const result = new Map<string, ObservationNoteReference>();
  for (const note of notes) result.set(`${note.role}\u0000${note.path}`, note);
  return [...result.values()];
}

export function continuityReviewInclusionReason(
  observation: ContinuityObservation,
  scope: ContinuityReviewManuscriptScope
): ContinuityReviewItem["inclusionReason"] | null {
  if (
    observation.primary.role === "manuscript"
    && scope.manuscriptPaths.has(observation.primary.path)
  ) return "primary-manuscript";

  const supporting = observationSourceNotes(observation);
  if (supporting.some((note) => (
    note.role === "manuscript" && scope.manuscriptPaths.has(note.path)
  ))) return "supporting-manuscript";

  if (
    observation.primary.role === "story_world"
    && scope.explicitlyReferencedStoryWorldPaths.has(observation.primary.path)
  ) return "referenced-story-world";

  return null;
}

function isReviewed(match: DispositionMatch): boolean {
  return match.state === "current"
    && Boolean(match.record)
    && (match.record!.disposition === "intentional" || match.record!.disposition === "deferred");
}

function itemFor(
  observation: ContinuityObservation,
  scope: ContinuityReviewManuscriptScope,
  records: readonly ContinuityDispositionRecord[]
): ContinuityReviewItem | null {
  const inclusionReason = continuityReviewInclusionReason(observation, scope);
  if (!inclusionReason) return null;
  const notes = distinctNotes([observation.primary, ...observationSourceNotes(observation)]);
  const locations = notes
    .map((note) => scope.locations.get(note.path))
    .filter((location): location is ContinuityReviewLocation => Boolean(location))
    .sort((left, right) => left.order - right.order);
  const entities = distinctNotes(notes.filter((note) => note.role === "story_world"));
  return {
    observation,
    match: matchContinuityDisposition(observation, records),
    inclusionReason,
    locations,
    entities
  };
}

function compareItems(left: ContinuityReviewItem, right: ContinuityReviewItem): number {
  const queueRank = (item: ContinuityReviewItem) => {
    if (item.match.state === "stale") return 0;
    if (!item.match.record) return 1;
    if (item.match.record.disposition === "resolved") return 2;
    return 3;
  };
  const severityRank = { conflict: 0, review: 1, information: 2 } as const;
  return queueRank(left) - queueRank(right)
    || severityRank[left.observation.severity] - severityRank[right.observation.severity]
    || (left.locations[0]?.order ?? Number.MAX_SAFE_INTEGER)
      - (right.locations[0]?.order ?? Number.MAX_SAFE_INTEGER)
    || left.observation.kind.localeCompare(right.observation.kind)
    || left.observation.summary.localeCompare(right.observation.summary)
    || left.observation.lineageKey.localeCompare(right.observation.lineageKey);
}

function optionSort(left: ContinuityReviewFilterOption, right: ContinuityReviewFilterOption) {
  return left.label.localeCompare(right.label, "en", { numeric: true, sensitivity: "base" });
}

/** Pure selected-book projection. Historical-only records cannot create items. */
export function projectContinuityReview(
  input: ContinuityReviewInput,
  filters: ContinuityReviewFilters
): ContinuityReviewProjection {
  const records = [...input.dispositions.values()];
  const byIdentity = new Map<string, ContinuityObservation>();
  for (const observation of input.observations) {
    byIdentity.set(`${observation.lineageKey}\u0000${observation.fingerprint}`, observation);
  }
  const all = [...byIdentity.values()]
    .map((observation) => itemFor(observation, input.manuscriptScope, records))
    .filter((item): item is ContinuityReviewItem => Boolean(item))
    .sort(compareItems);
  const active = all.filter((item) => !isReviewed(item.match));
  const reviewed = all.filter((item) => isReviewed(item.match));
  const queue = filters.queue === "active" ? active : filters.queue === "reviewed" ? reviewed : all;
  const items = queue.filter((item) => (
    (!filters.type || item.observation.kind === filters.type)
    && (!filters.locationPath || item.locations.some((location) => (
      location.path === filters.locationPath || location.partPath === filters.locationPath
    )))
    && (!filters.entityPath || item.entities.some((entity) => entity.path === filters.entityPath))
  ));

  const types = [...new Map(all.map((item) => [
    item.observation.kind,
    { value: item.observation.kind, label: displayKind(item.observation.kind) }
  ])).values()].sort(optionSort);
  const locationValues = new Map<string, ContinuityReviewFilterOption>();
  const chapterPathsByLabel = new Map<string, Set<string>>();
  for (const item of all) for (const location of item.locations) {
    if (location.kind !== "chapter") continue;
    const paths = chapterPathsByLabel.get(location.label) ?? new Set<string>();
    paths.add(location.path);
    chapterPathsByLabel.set(location.label, paths);
  }
  for (const item of all) {
    for (const location of item.locations) {
      const duplicate = location.kind === "chapter" && (chapterPathsByLabel.get(location.label)?.size ?? 0) > 1;
      locationValues.set(location.path, {
        value: location.path,
        label: duplicate && location.partLabel ? `${location.label} · ${location.partLabel}` : location.label
      });
      if (location.partPath && location.partLabel) {
        locationValues.set(location.partPath, { value: location.partPath, label: location.partLabel });
      }
    }
  }
  const entities = [...new Map(all.flatMap((item) => item.entities).map((note) => [
    note.path,
    { value: note.path, label: noteLabel(note) }
  ])).values()].sort(optionSort);
  return {
    items,
    counts: { active: active.length, reviewed: reviewed.length, displayed: items.length },
    filterOptions: {
      types,
      locations: [...locationValues.values()].sort(optionSort),
      entities
    }
  };
}
