import { parseEventTime, projectEventTime, SupportedEventTime } from "./EventTimeEditing";
import { parseWikilink, StoryWorldEntityRecord } from "./StoryWorldIndex";
import { getWorldEventRelativeTimingPresentation } from "./WorldRelativeTime";

export type StoryWorldTimelineGroup = "points" | "ranges" | "unsupported" | "undated";
export interface TimelineSource { readonly raw: string; readonly label: string; readonly resolvedPath: string | null; }
export interface StoryWorldTimelineEvent {
  readonly path: string; readonly name: string; readonly status: string; readonly scopes: readonly string[];
  readonly precision: string; readonly group: StoryWorldTimelineGroup; readonly displayTime: string;
  readonly sortKey: string | null; readonly relativeToPrevious: string | null; readonly sources: readonly TimelineSource[];
  readonly supportedTime: SupportedEventTime | null;
}
export interface StoryWorldTimelineFilters { readonly scope?: string | null; readonly status?: string | null; readonly precision?: string | null; }
export interface StoryWorldTimelineProjection {
  readonly points: readonly StoryWorldTimelineEvent[]; readonly ranges: readonly StoryWorldTimelineEvent[];
  readonly unsupported: readonly StoryWorldTimelineEvent[]; readonly undated: readonly StoryWorldTimelineEvent[];
  readonly scopes: readonly string[]; readonly statuses: readonly string[]; readonly precisions: readonly string[];
}
export type TimelineSourceResolver = (linkpath: string, sourcePath: string) => string | null;

function readable(value: string): string { return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function unknownPrecision(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const precision = (value as Record<string, unknown>).precision;
    if (typeof precision === "string" && precision.trim()) return precision.trim();
  }
  return "unsupported";
}
function sourceProjection(raw: string, eventPath: string, resolve: TimelineSourceResolver): TimelineSource {
  const parsed = parseWikilink(raw);
  if (!parsed) return { raw, label: raw, resolvedPath: null };
  return { raw, label: parsed.displayText ?? parsed.linkpath.split("/").pop() ?? parsed.linkpath, resolvedPath: resolve(parsed.linkpath, eventPath) };
}
function sortEvents(left: StoryWorldTimelineEvent, right: StoryWorldTimelineEvent): number {
  return (left.sortKey ?? "").localeCompare(right.sortKey ?? "") || left.path.localeCompare(right.path) || left.name.localeCompare(right.name);
}
function sourceValue(time: SupportedEventTime): string { return time.from.date + (time.precision === "minute" ? `T${time.from.time}${time.from.offset}` : ""); }

export function projectStoryWorldTimeline(
  entities: readonly StoryWorldEntityRecord[], resolve: TimelineSourceResolver = () => null, filters: StoryWorldTimelineFilters = {}
): StoryWorldTimelineProjection {
  const all: StoryWorldTimelineEvent[] = [];
  const scopeSet = new Set<string>(); const statusSet = new Set<string>(); const precisionSet = new Set<string>();
  for (const entity of entities) {
    if (entity.entityType.trim().toLowerCase() !== "event") continue;
    const state = parseEventTime(entity.properties.world_time);
    const status = entity.status ?? "Unspecified";
    const scopes = entity.scope;
    const precision = state.kind === "supported" ? state.value.precision : state.kind === "undated" ? "undated" : unknownPrecision(entity.properties.world_time);
    for (const scope of scopes) scopeSet.add(scope); statusSet.add(status); precisionSet.add(precision);
    const group: StoryWorldTimelineGroup = state.kind === "undated" ? "undated" : state.kind === "unsupported" ? "unsupported" : state.value.mode === "range" ? "ranges" : "points";
    const supportedTime = state.kind === "supported" ? state.value : null;
    all.push({ path: entity.path, name: entity.name, status, scopes, precision, group,
      displayTime: supportedTime ? projectEventTime(supportedTime) : state.kind === "unsupported" ? state.summary : "Undated",
      sortKey: supportedTime ? sourceValue(supportedTime) : null, relativeToPrevious: null,
      sources: entity.sources.map((source) => sourceProjection(source, entity.path, resolve)), supportedTime });
  }
  const selected = all.filter((event) => (!filters.scope || event.scopes.includes(filters.scope))
    && (!filters.status || event.status === filters.status) && (!filters.precision || event.precision === filters.precision));
  const points = selected.filter((event) => event.group === "points").sort(sortEvents).map((event, index, ordered) => {
    const previous = ordered[index - 1];
    if (!previous?.supportedTime || !event.supportedTime) return event;
    const previousEntity = entities.find((entity) => entity.path === previous.path);
    const interval = previousEntity ? getWorldEventRelativeTimingPresentation(previousEntity, sourceValue(event.supportedTime), previous.name, "calendar") : null;
    return { ...event, relativeToPrevious: interval?.display ?? null };
  });
  const grouped = (group: StoryWorldTimelineGroup) => selected.filter((event) => event.group === group).sort(sortEvents);
  return { points, ranges: grouped("ranges"), unsupported: grouped("unsupported"), undated: grouped("undated"),
    scopes: [...scopeSet].sort((a, b) => a.localeCompare(b)), statuses: [...statusSet].sort((a, b) => a.localeCompare(b)), precisions: [...precisionSet].sort((a, b) => a.localeCompare(b)) };
}

export function timelineFilterLabel(value: string): string { return readable(value); }
