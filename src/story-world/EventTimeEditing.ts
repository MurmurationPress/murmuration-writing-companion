import { getWorldEventTimePresentation } from "./WorldTime";
import type { StoryWorldEntityRecord } from "./StoryWorldIndex";

export type EventTimePrecision = "year" | "month" | "day" | "hour" | "minute";
export type EventTimeMode = "point" | "range";

export interface EventTimeEndpoint {
  readonly date: string;
  readonly time: string;
  readonly offset: string;
}

export interface SupportedEventTime {
  readonly mode: EventTimeMode;
  readonly precision: EventTimePrecision;
  readonly from: EventTimeEndpoint;
  readonly to: EventTimeEndpoint | null;
}

export type EventTimeEditorState =
  | { readonly kind: "undated" }
  | { readonly kind: "supported"; readonly value: SupportedEventTime }
  | { readonly kind: "unsupported"; readonly preserved: unknown; readonly summary: string };

const EXACT = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?)?)?)?$/;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function endpoint(source: unknown, precision: EventTimePrecision | null): { value: EventTimeEndpoint; precision: EventTimePrecision } | null {
  if (typeof source !== "string") return null;
  const match = EXACT.exec(source.trim());
  if (!match) return null;
  const inferred: EventTimePrecision = match[5] ? "minute" : match[4] ? "hour" : match[3] ? "day" : match[2] ? "month" : "year";
  const month = match[2] ? Number(match[2]) : null;
  const day = match[3] ? Number(match[3]) : null;
  if (month !== null && (month < 1 || month > 12)) return null;
  if (day !== null) {
    const date = new Date(Date.UTC(Number(match[1]), month! - 1, day));
    date.setUTCFullYear(Number(match[1]));
    if (date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) return null;
  }
  if (match[4] && Number(match[4]) > 23 || match[5] && Number(match[5]) > 59) return null;
  if (match[6] && match[6] !== "Z") {
    const [hours, minutes] = match[6].slice(1).split(":").map(Number);
    if (hours > 23 || minutes > 59) return null;
  }
  const effective = precision ?? inferred;
  if (effective === "minute" && !match[5]) return null;
  if (effective === "hour" && !match[4]) return null;
  if (effective === "day" && !match[3]) return null;
  if (effective === "month" && !match[2]) return null;
  const date = effective === "year" ? match[1] : effective === "month" ? `${match[1]}-${match[2]}` : `${match[1]}-${match[2]}-${match[3]}`;
  const timed = effective === "hour" || effective === "minute";
  return { value: { date, time: timed ? `${match[4]}:${match[5] ?? "00"}` : "", offset: timed ? match[6] ?? "" : "" }, precision: effective };
}

function unsupported(value: unknown): EventTimeEditorState {
  if (record(value)) {
    const details = Object.entries(value).map(([key, item]) => {
      const label = key.replace(/[_-]+/g, " ");
      const display = typeof item === "string" || typeof item === "number" || typeof item === "boolean"
        ? `“${String(item)}”` : "structured detail";
      return `${label}: ${display}`;
    }).join("; ");
    return { kind: "unsupported", preserved: value, summary: details ? `Preserved structured time — ${details}` : "Preserved structured time" };
  }
  return { kind: "unsupported", preserved: value, summary: "Preserved time value" };
}

export function parseEventTime(value: unknown): EventTimeEditorState {
  if (value === undefined || value === null || value === "") return { kind: "undated" };
  if (typeof value === "string") {
    const parsed = endpoint(value, null);
    return parsed ? { kind: "supported", value: { mode: "point", precision: parsed.precision, from: parsed.value, to: null } } : unsupported(value);
  }
  if (!record(value)) return unsupported(value);
  const keys = Object.keys(value);
  const allowed = new Set(["at", "from", "until", "precision"]);
  if (keys.some((key) => !allowed.has(key))) return unsupported(value);
  const precision = typeof value.precision === "string" && ["year", "month", "day", "hour", "minute"].includes(value.precision)
    ? value.precision as EventTimePrecision : null;
  if (value.precision !== undefined && !precision) return unsupported(value);
  if (value.at !== undefined && value.from === undefined && value.until === undefined) {
    const at = endpoint(value.at, precision);
    return at ? { kind: "supported", value: { mode: "point", precision: at.precision, from: at.value, to: null } } : unsupported(value);
  }
  if (value.from !== undefined && value.until !== undefined && value.at === undefined) {
    const from = endpoint(value.from, precision);
    const to = endpoint(value.until, precision ?? from?.precision ?? null);
    return from && to && from.precision === to.precision
      ? { kind: "supported", value: { mode: "range", precision: from.precision, from: from.value, to: to.value } }
      : unsupported(value);
  }
  return unsupported(value);
}

function serialiseEndpoint(value: EventTimeEndpoint, precision: EventTimePrecision): string {
  if (precision === "hour" || precision === "minute") return `${value.date}T${value.time}${value.offset}`;
  return value.date;
}

export function serialiseEventTime(value: SupportedEventTime): Record<string, unknown> {
  const from = serialiseEndpoint(value.from, value.precision);
  return value.mode === "point"
    ? { at: from, precision: value.precision }
    : { from, until: serialiseEndpoint(value.to!, value.precision), precision: value.precision };
}

export function projectEventTime(value: SupportedEventTime): string {
  const properties = { world_time: serialiseEventTime(value) };
  const entity: StoryWorldEntityRecord = {
    path: "", basename: "Event", entityType: "event", name: "Event", aliases: [], facets: [], scope: [],
    status: null, summary: null, firstAppearance: null, sources: [], links: [], properties
  };
  return getWorldEventTimePresentation(entity)?.display ?? "Complete the event time to preview it.";
}

export function eventTimeValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => eventTimeValuesEqual(item, right[index]));
  if (record(left) && record(right)) {
    const leftKeys = Object.keys(left).filter((key) => key !== "position");
    const rightKeys = Object.keys(right).filter((key) => key !== "position");
    return leftKeys.length === rightKeys.length && leftKeys.every((key) => rightKeys.includes(key) && eventTimeValuesEqual(left[key], right[key]));
  }
  return false;
}

export function cloneEventTimeValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneEventTimeValue) as T;
  if (record(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneEventTimeValue(item)])) as T;
  return value;
}
