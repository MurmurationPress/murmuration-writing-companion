import { StoryWorldEntityRecord } from "./StoryWorldIndex";
import { parseTemporalInterval } from "../observations/TemporalInterval";

export type KnownWorldTimePrecision =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second";

export interface WorldEventTimePresentation {
  readonly source: string;
  readonly display: string;
  readonly precision: string | null;
  readonly datetime: string | null;
  readonly calendarDate: string | null;
  readonly point: boolean;
}

interface ParsedIsoValue {
  readonly source: string;
  readonly year: number;
  readonly month: number | null;
  readonly day: number | null;
  readonly hour: number | null;
  readonly minute: number | null;
  readonly second: number | null;
  readonly inferredPrecision: KnownWorldTimePrecision;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;

const PRECISION_RANK: Readonly<Record<KnownWorldTimePrecision, number>> = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
  minute: 4,
  second: 5
};

const ISO_VALUE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:[Tt ](\d{2})(?::(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?(?:[Zz]|[+-]\d{2}(?::?\d{2})?)?)?)?)?$/;

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year
    && value.getUTCMonth() === month - 1
    && value.getUTCDate() === day;
}

function parseIsoValue(source: string): ParsedIsoValue | null {
  const match = ISO_VALUE_PATTERN.exec(source);
  if (!match) return null;

  const year = Number(match[1]);
  const month = match[2] === undefined ? null : Number(match[2]);
  const day = match[3] === undefined ? null : Number(match[3]);
  const hour = match[4] === undefined ? null : Number(match[4]);
  const minute = match[5] === undefined ? null : Number(match[5]);
  const second = match[6] === undefined ? null : Number(match[6]);

  if (month !== null && (month < 1 || month > 12)) return null;
  if (day !== null) {
    if (month === null || !isValidCalendarDate(year, month, day)) return null;
  }
  if (hour !== null && (hour < 0 || hour > 23)) return null;
  if (minute !== null && (minute < 0 || minute > 59)) return null;
  if (second !== null && (second < 0 || second > 59)) return null;

  const inferredPrecision: KnownWorldTimePrecision = second !== null
    ? "second"
    : minute !== null
      ? "minute"
      : hour !== null
        ? "hour"
        : day !== null
          ? "day"
          : month !== null
            ? "month"
            : "year";

  return {
    source,
    year,
    month,
    day,
    hour,
    minute,
    second,
    inferredPrecision
  };
}

function temporalSource(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;

    const isMidnightUtc = value.getUTCHours() === 0
      && value.getUTCMinutes() === 0
      && value.getUTCSeconds() === 0
      && value.getUTCMilliseconds() === 0;

    return isMidnightUtc
      ? value.toISOString().slice(0, 10)
      : value.toISOString();
  }

  return nonEmptyString(value);
}

function normalizeKnownPrecision(value: string | null): KnownWorldTimePrecision | null {
  if (!value) return null;

  switch (value.trim().toLowerCase()) {
    case "year":
    case "years":
      return "year";
    case "month":
    case "months":
      return "month";
    case "day":
    case "days":
      return "day";
    case "hour":
    case "hours":
      return "hour";
    case "minute":
    case "minutes":
      return "minute";
    case "second":
    case "seconds":
      return "second";
    default:
      return null;
  }
}

function effectivePrecision(
  parsed: ParsedIsoValue,
  declaredPrecision: string | null
): KnownWorldTimePrecision | null {
  if (declaredPrecision === null) return parsed.inferredPrecision;

  const declared = normalizeKnownPrecision(declaredPrecision);
  if (!declared) return null;

  return PRECISION_RANK[declared] <= PRECISION_RANK[parsed.inferredPrecision]
    ? declared
    : parsed.inferredPrecision;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function calendarDate(parsed: ParsedIsoValue): string | null {
  if (parsed.month === null || parsed.day === null) return null;
  return `${String(parsed.year).padStart(4, "0")}-${pad2(parsed.month)}-${pad2(parsed.day)}`;
}

function weekdayName(parsed: ParsedIsoValue): string | null {
  if (parsed.month === null || parsed.day === null) return null;
  const value = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  return WEEKDAY_NAMES[value.getUTCDay()] ?? null;
}

function formatParsedValue(
  parsed: ParsedIsoValue,
  declaredPrecision: string | null
): {
  display: string;
  precision: KnownWorldTimePrecision | null;
  calendarDate: string | null;
} {
  const precision = effectivePrecision(parsed, declaredPrecision);
  if (!precision) {
    return {
      display: parsed.source,
      precision: null,
      calendarDate: null
    };
  }

  if (precision === "year") {
    return { display: String(parsed.year), precision, calendarDate: null };
  }

  if (parsed.month === null) {
    return { display: parsed.source, precision: null, calendarDate: null };
  }

  const monthAndYear = `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`;
  if (precision === "month") {
    return { display: monthAndYear, precision, calendarDate: null };
  }

  const weekday = weekdayName(parsed);
  if (parsed.day === null || weekday === null) {
    return { display: parsed.source, precision: null, calendarDate: null };
  }

  const dateDisplay = `${weekday}, ${parsed.day} ${monthAndYear}`;
  const date = calendarDate(parsed);
  if (precision === "day") {
    return { display: dateDisplay, precision, calendarDate: date };
  }

  if (parsed.hour === null) {
    return { display: dateDisplay, precision: "day", calendarDate: date };
  }

  const hourDisplay = `${pad2(parsed.hour)}:00`;
  if (precision === "hour") {
    return {
      display: `${dateDisplay}, ${hourDisplay}`,
      precision,
      calendarDate: date
    };
  }

  if (parsed.minute === null) {
    return {
      display: `${dateDisplay}, ${hourDisplay}`,
      precision: "hour",
      calendarDate: date
    };
  }

  const minuteDisplay = `${pad2(parsed.hour)}:${pad2(parsed.minute)}`;
  if (precision === "minute") {
    return {
      display: `${dateDisplay}, ${minuteDisplay}`,
      precision,
      calendarDate: date
    };
  }

  if (parsed.second === null) {
    return {
      display: `${dateDisplay}, ${minuteDisplay}`,
      precision: "minute",
      calendarDate: date
    };
  }

  return {
    display: `${dateDisplay}, ${minuteDisplay}:${pad2(parsed.second)}`,
    precision: "second",
    calendarDate: date
  };
}

function pointPresentation(
  source: string,
  declaredPrecision: string | null
): WorldEventTimePresentation | null {
  const parsed = parseIsoValue(source);
  if (!parsed) return null;
  const formatted = formatParsedValue(parsed, declaredPrecision);

  return {
    source,
    display: formatted.display,
    precision: formatted.precision ?? declaredPrecision,
    datetime: source,
    calendarDate: formatted.calendarDate,
    point: true
  };
}

function rangePresentation(
  fromSource: string | null,
  untilSource: string | null,
  declaredPrecision: string | null
): WorldEventTimePresentation | null {
  const from = fromSource ? pointPresentation(fromSource, declaredPrecision) : null;
  const until = untilSource ? pointPresentation(untilSource, declaredPrecision) : null;
  if (!from && !until) return null;

  if (from && until) {
    return {
      source: `${from.source}/${until.source}`,
      display: `${from.display} – ${until.display}`,
      precision: from.precision === until.precision ? from.precision : declaredPrecision,
      datetime: null,
      calendarDate: null,
      point: false
    };
  }

  const endpoint = from ?? until;
  if (!endpoint) return null;

  return {
    source: endpoint.source,
    display: from ? `From ${endpoint.display}` : `Until ${endpoint.display}`,
    precision: endpoint.precision,
    datetime: null,
    calendarDate: null,
    point: false
  };
}

/**
 * Presents an event's authoritative intrinsic time without writing or deriving a
 * second temporal fact. ISO components are formatted directly so the system
 * timezone cannot shift the story's written date or wall-clock time.
 */
export function getWorldEventTimePresentation(
  entity: StoryWorldEntityRecord
): WorldEventTimePresentation | null {
  if (entity.entityType.trim().toLowerCase() !== "event") return null;

  const interpreted = parseTemporalInterval(entity.properties.world_time);
  if (interpreted.kind === "supported") {
    const interval = interpreted.value;
    const raw = entity.properties.world_time;
    const declared = isRecord(raw) ? nonEmptyString(raw.precision) : null;
    return interval.point
      ? pointPresentation(interval.from!.source, declared)
      : rangePresentation(interval.from?.source ?? null, interval.until?.source ?? null, declared);
  }

  // Unsupported authored values remain displayable without becoming valid
  // comparison evidence or being rewritten by the editor.
  const worldTime = entity.properties.world_time;
  if (!isRecord(worldTime)) return null;
  const declaredPrecision = nonEmptyString(worldTime.precision);
  const pointSource = temporalSource(worldTime.at) ?? temporalSource(worldTime.date);
  if (pointSource) return pointPresentation(pointSource, declaredPrecision);
  return rangePresentation(temporalSource(worldTime.from), temporalSource(worldTime.until) ?? temporalSource(worldTime.to), declaredPrecision);
}

export function getWorldEventDisplayTime(
  entity: StoryWorldEntityRecord
): string | null {
  return getWorldEventTimePresentation(entity)?.display ?? null;
}

function calendarDayNumber(value: string): number | null {
  const parsed = parseIsoValue(value);
  if (!parsed || parsed.month === null || parsed.day === null) return null;
  return Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86_400_000);
}

export function getWorldEventRelativeTiming(
  entity: StoryWorldEntityRecord,
  chapterStoryDate: unknown,
  eventName = entity.name
): string | null {
  const presentation = getWorldEventTimePresentation(entity);
  if (!presentation?.point || !presentation.calendarDate) return null;

  const precision = normalizeKnownPrecision(presentation.precision);
  if (!precision || PRECISION_RANK[precision] < PRECISION_RANK.day) return null;

  const storySource = temporalSource(chapterStoryDate);
  if (!storySource) return null;
  const storyParsed = parseIsoValue(storySource);
  if (!storyParsed || PRECISION_RANK[storyParsed.inferredPrecision] < PRECISION_RANK.day) {
    return null;
  }

  const eventDay = calendarDayNumber(presentation.calendarDate);
  const storyDay = calendarDayNumber(storySource);
  if (eventDay === null || storyDay === null) return null;

  const difference = storyDay - eventDay;
  const name = eventName.trim() || "the event";

  if (difference === 0) return `On the day of ${name}`;

  const count = Math.abs(difference);
  const unit = count === 1 ? "day" : "days";
  return difference < 0
    ? `${count} ${unit} before ${name}`
    : `${count} ${unit} after ${name}`;
}
