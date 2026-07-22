export type TemporalPrecision = "year" | "month" | "day" | "hour" | "minute";

export interface TemporalEndpoint {
  readonly source: string;
  readonly precision: TemporalPrecision;
  readonly offset: string | null;
  readonly minimum: number;
  readonly maximum: number;
  readonly timed: boolean;
}

export interface TemporalInterval {
  readonly source: string;
  readonly precision: TemporalPrecision;
  readonly from: TemporalEndpoint | null;
  readonly until: TemporalEndpoint | null;
  readonly point: boolean;
}

export type TemporalParseResult =
  | { readonly kind: "missing" }
  | { readonly kind: "supported"; readonly value: TemporalInterval }
  | { readonly kind: "malformed"; readonly raw: unknown; readonly reason: string }
  | { readonly kind: "unsupported"; readonly raw: unknown; readonly reason: string };

const PRECISIONS: readonly TemporalPrecision[] = ["year", "month", "day", "hour", "minute"];
const EXACT = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:[Tt ](\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?)?)?)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function civilDayNumber(year: number, month: number, day: number): number {
  let adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const monthPrime = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * monthPrime + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365
    + Math.floor(yearOfEra / 4)
    - Math.floor(yearOfEra / 100)
    + dayOfYear;
  return era * 146_097 + dayOfEra;
}

function offsetMinutes(value: string | null): number | null {
  if (!value) return null;
  if (value.toUpperCase() === "Z") return 0;
  const sign = value[0] === "-" ? -1 : 1;
  const digits = value.slice(1).replace(":", "");
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2));
  if (hours > 23 || minutes > 59) return null;
  return sign * (hours * 60 + minutes);
}

function inferredPrecision(match: RegExpExecArray): TemporalPrecision {
  return match[5] !== undefined
    ? "minute"
    : match[4] !== undefined
      ? "hour"
      : match[3] !== undefined
        ? "day"
        : match[2] !== undefined
          ? "month"
          : "year";
}

function numericYearSource(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }
  const source = String(value);
  return /^\d{4}$/.test(source) ? source : null;
}

function endpoint(source: unknown, declared: TemporalPrecision | null): TemporalEndpoint | null {
  const text = typeof source === "string" ? source.trim() : numericYearSource(source);
  if (!text) return null;
  const match = EXACT.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = match[2] === undefined ? null : Number(match[2]);
  const day = match[3] === undefined ? null : Number(match[3]);
  const hour = match[4] === undefined ? null : Number(match[4]);
  const minute = match[5] === undefined ? null : Number(match[5]);
  const offset = match[6] ?? null;
  if (month !== null && (month < 1 || month > 12)) return null;
  if (day !== null && (month === null || day < 1 || day > daysInMonth(year, month))) return null;
  if (hour !== null && (hour < 0 || hour > 23)) return null;
  if (minute !== null && (minute < 0 || minute > 59)) return null;
  if (offset && offsetMinutes(offset) === null) return null;

  const evident = inferredPrecision(match);
  const precision = declared ?? evident;
  if (PRECISIONS.indexOf(precision) > PRECISIONS.indexOf(evident)) return null;

  const minimumMonth = precision === "year" ? 1 : month!;
  const maximumMonth = precision === "year" ? 12 : month!;
  const minimumDay = precision === "year" || precision === "month" ? 1 : day!;
  const maximumDay = precision === "year"
    ? 31
    : precision === "month"
      ? daysInMonth(year, maximumMonth)
      : day!;
  const minimumHour = ["year", "month", "day"].includes(precision) ? 0 : hour!;
  const maximumHour = ["year", "month", "day"].includes(precision) ? 23 : hour!;
  const minimumMinute = precision === "minute" ? minute! : 0;
  const maximumMinute = precision === "minute" ? minute! : 59;

  return {
    source: text,
    precision,
    offset,
    minimum: civilDayNumber(year, minimumMonth, minimumDay) * 1440
      + minimumHour * 60 + minimumMinute,
    maximum: civilDayNumber(year, maximumMonth, maximumDay) * 1440
      + maximumHour * 60 + maximumMinute,
    timed: precision === "hour" || precision === "minute"
  };
}

function declaredPrecision(value: unknown): TemporalPrecision | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const normalized = value.trim().toLowerCase();
  return (PRECISIONS as readonly string[]).includes(normalized)
    ? normalized as TemporalPrecision
    : "invalid";
}

/** Parses only the explicit temporal forms required by chapter continuity rules. */
export function parseTemporalInterval(value: unknown): TemporalParseResult {
  if (value === undefined || value === null || value === "") return { kind: "missing" };
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { kind: "malformed", raw: value, reason: "invalid_date" };
    }
    const source = value.toISOString();
    const midnight = value.getUTCHours() === 0
      && value.getUTCMinutes() === 0
      && value.getUTCSeconds() === 0
      && value.getUTCMilliseconds() === 0;
    const authored = midnight ? source.slice(0, 10) : source.slice(0, 16) + "Z";
    const precision: TemporalPrecision = midnight ? "day" : "minute";
    const parsed = endpoint(authored, precision);
    return parsed
      ? { kind: "supported", value: { source: authored, precision, from: parsed, until: parsed, point: true } }
      : { kind: "malformed", raw: source, reason: "invalid_date" };
  }
  if (typeof value === "string") {
    const parsed = endpoint(value, null);
    return parsed
      ? { kind: "supported", value: { source: parsed.source, precision: parsed.precision, from: parsed, until: parsed, point: true } }
      : { kind: "malformed", raw: value, reason: "invalid_iso_temporal_value" };
  }
  if (typeof value === "number") {
    const source = numericYearSource(value);
    const parsed = source ? endpoint(source, "year") : null;
    return parsed
      ? { kind: "supported", value: { source: parsed.source, precision: "year", from: parsed, until: parsed, point: true } }
      : { kind: "malformed", raw: value, reason: "invalid_numeric_year" };
  }
  if (!isRecord(value)) {
    return { kind: "unsupported", raw: value, reason: "unsupported_temporal_shape" };
  }

  const keys = Object.keys(value).filter((key) => key !== "position");
  const allowed = new Set(["at", "from", "until", "precision"]);
  if (keys.some((key) => !allowed.has(key))) {
    return { kind: "unsupported", raw: value, reason: "unsupported_temporal_qualifier" };
  }
  const precision = declaredPrecision(value.precision);
  if (precision === "invalid") {
    return { kind: "unsupported", raw: value, reason: "unsupported_temporal_precision" };
  }
  if (value.at !== undefined) {
    if (value.from !== undefined || value.until !== undefined) {
      return { kind: "malformed", raw: value, reason: "point_and_range_combined" };
    }
    const parsed = endpoint(value.at, precision);
    return parsed
      ? { kind: "supported", value: { source: parsed.source, precision: parsed.precision, from: parsed, until: parsed, point: true } }
      : { kind: "malformed", raw: value, reason: "invalid_point_endpoint" };
  }

  const from = value.from === undefined ? null : endpoint(value.from, precision);
  const until = value.until === undefined ? null : endpoint(value.until, precision);
  if (value.from !== undefined && !from || value.until !== undefined && !until) {
    return { kind: "malformed", raw: value, reason: "invalid_range_endpoint" };
  }
  if (!from && !until) {
    return { kind: "malformed", raw: value, reason: "missing_temporal_endpoint" };
  }
  if (from && until && compareEndpoints(from, until) === "after") {
    return { kind: "malformed", raw: value, reason: "reversed_temporal_range" };
  }
  const effectivePrecision = from?.precision ?? until!.precision;
  if (from && until && from.precision !== until.precision) {
    return { kind: "unsupported", raw: value, reason: "mixed_range_precision" };
  }
  return {
    kind: "supported",
    value: {
      source: [from?.source ?? "", until?.source ?? ""].join("/"),
      precision: effectivePrecision,
      from,
      until,
      point: false
    }
  };
}

function comparableBounds(
  left: TemporalEndpoint,
  right: TemporalEndpoint
): { leftMinimum: number; leftMaximum: number; rightMinimum: number; rightMaximum: number } | null {
  if (!left.timed && !right.timed) {
    return { leftMinimum: left.minimum, leftMaximum: left.maximum, rightMinimum: right.minimum, rightMaximum: right.maximum };
  }
  if (left.offset !== null && right.offset !== null) {
    const leftOffset = offsetMinutes(left.offset)!;
    const rightOffset = offsetMinutes(right.offset)!;
    return {
      leftMinimum: left.minimum - leftOffset,
      leftMaximum: left.maximum - leftOffset,
      rightMinimum: right.minimum - rightOffset,
      rightMaximum: right.maximum - rightOffset
    };
  }
  if (left.offset === null && right.offset === null) {
    return { leftMinimum: left.minimum, leftMaximum: left.maximum, rightMinimum: right.minimum, rightMaximum: right.maximum };
  }
  return null;
}

export type ProvenTemporalOrder = "before" | "after" | "overlap" | "indeterminate";

export function compareEndpoints(left: TemporalEndpoint, right: TemporalEndpoint): ProvenTemporalOrder {
  const bounds = comparableBounds(left, right);
  if (!bounds) return "indeterminate";
  if (bounds.leftMaximum < bounds.rightMinimum) return "before";
  if (bounds.leftMinimum > bounds.rightMaximum) return "after";
  return "overlap";
}

/** Returns an order only when the complete authored intervals prove it. */
export function compareTemporalIntervals(
  left: TemporalInterval,
  right: TemporalInterval
): ProvenTemporalOrder {
  if (left.until && right.from) {
    const before = compareEndpoints(left.until, right.from);
    if (before === "before") return "before";
  }
  if (left.from && right.until) {
    const after = compareEndpoints(left.from, right.until);
    if (after === "after") return "after";
  }
  if (!left.from || !left.until || !right.from || !right.until) return "indeterminate";
  const starts = compareEndpoints(left.from, right.until);
  const ends = compareEndpoints(left.until, right.from);
  return starts === "indeterminate" || ends === "indeterminate" ? "indeterminate" : "overlap";
}
