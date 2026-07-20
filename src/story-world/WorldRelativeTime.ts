import { StoryWorldEntityRecord } from "./StoryWorldIndex";
import { getWorldEventTimePresentation } from "./WorldTime";

export const WORLD_EVENT_RELATIVE_TIME_MODES = [
  "automatic",
  "calendar",
  "total-months",
  "total-days"
] as const;

export type WorldEventRelativeTimeMode =
  typeof WORLD_EVENT_RELATIVE_TIME_MODES[number];

export const WORLD_EVENT_RELATIVE_TIME_MODE_OPTIONS: ReadonlyArray<{
  readonly value: WorldEventRelativeTimeMode;
  readonly label: string;
}> = [
  { value: "automatic", label: "Automatic" },
  { value: "calendar", label: "Calendar interval" },
  { value: "total-months", label: "Total months" },
  { value: "total-days", label: "Total days" }
];

export interface WorldEventRelativeTimingPresentation {
  readonly display: string;
  readonly exactTotalDayDisplay: string;
  readonly exactTotalDays: number;
  readonly requestedMode: WorldEventRelativeTimeMode;
  readonly resolvedMode: Exclude<WorldEventRelativeTimeMode, "automatic">;
}

interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

interface CalendarInterval {
  readonly years: number;
  readonly months: number;
  readonly days: number;
}

interface TotalMonthInterval {
  readonly months: number;
  readonly days: number;
}

const ISO_VALUE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:[Tt ](\d{2})(?::(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?(?:[Zz]|[+-]\d{2}(?::?\d{2})?)?)?)?)?$/;

function temporalSource(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

function parseCivilDate(value: unknown): CivilDate | null {
  const source = temporalSource(value);
  if (!source) return null;

  const match = ISO_VALUE_PATTERN.exec(source);
  if (!match || match[2] === undefined || match[3] === undefined) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return { year, month, day };
}

/** Gregorian civil-day ordinal. Only differences are significant. */
function civilDayNumber(date: CivilDate): number {
  let year = date.year;
  const month = date.month;
  year -= month <= 2 ? 1 : 0;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const monthPrime = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * monthPrime + 2) / 5) + date.day - 1;
  const dayOfEra = yearOfEra * 365
    + Math.floor(yearOfEra / 4)
    - Math.floor(yearOfEra / 100)
    + dayOfYear;
  return era * 146_097 + dayOfEra;
}

function compareCivilDates(left: CivilDate, right: CivilDate): number {
  return civilDayNumber(left) - civilDayNumber(right);
}

function addYearsClamped(date: CivilDate, years: number): CivilDate {
  const year = date.year + years;
  return {
    year,
    month: date.month,
    day: Math.min(date.day, daysInMonth(year, date.month))
  };
}

function addMonthsClamped(date: CivilDate, months: number): CivilDate {
  const monthIndex = date.year * 12 + date.month - 1 + months;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12 + 1;

  return {
    year,
    month,
    day: Math.min(date.day, daysInMonth(year, month))
  };
}

function wholeYearsBetween(earlier: CivilDate, later: CivilDate): number {
  let years = Math.max(0, later.year - earlier.year);
  while (years > 0 && compareCivilDates(addYearsClamped(earlier, years), later) > 0) {
    years -= 1;
  }
  return years;
}

function wholeMonthsBetween(earlier: CivilDate, later: CivilDate): number {
  let months = Math.max(
    0,
    (later.year - earlier.year) * 12 + later.month - earlier.month
  );
  while (months > 0 && compareCivilDates(addMonthsClamped(earlier, months), later) > 0) {
    months -= 1;
  }
  return months;
}

function calendarInterval(earlier: CivilDate, later: CivilDate): CalendarInterval {
  const years = wholeYearsBetween(earlier, later);
  const afterYears = addYearsClamped(earlier, years);
  const months = wholeMonthsBetween(afterYears, later);
  const afterMonths = addMonthsClamped(afterYears, months);

  return {
    years,
    months,
    days: civilDayNumber(later) - civilDayNumber(afterMonths)
  };
}

function totalMonthInterval(earlier: CivilDate, later: CivilDate): TotalMonthInterval {
  const months = wholeMonthsBetween(earlier, later);
  const afterMonths = addMonthsClamped(earlier, months);

  return {
    months,
    days: civilDayNumber(later) - civilDayNumber(afterMonths)
  };
}

function unit(value: number, singular: string): string {
  return `${value} ${value === 1 ? singular : `${singular}s`}`;
}

function formatCalendarInterval(interval: CalendarInterval): string {
  return [
    interval.years > 0 ? unit(interval.years, "year") : "",
    interval.months > 0 ? unit(interval.months, "month") : "",
    interval.days > 0 ? unit(interval.days, "day") : ""
  ].filter(Boolean).join(", ");
}

function formatTotalMonthInterval(interval: TotalMonthInterval): string {
  return [
    interval.months > 0 ? unit(interval.months, "month") : "",
    interval.days > 0 ? unit(interval.days, "day") : ""
  ].filter(Boolean).join(", ");
}

function formatRelative(
  magnitude: string,
  difference: number,
  eventName: string
): string {
  return difference < 0
    ? `${magnitude} before ${eventName}`
    : `${magnitude} after ${eventName}`;
}

function hasUsableDayPrecision(precision: string | null): boolean {
  if (!precision) return false;
  switch (precision.trim().toLowerCase()) {
    case "day":
    case "days":
    case "hour":
    case "hours":
    case "minute":
    case "minutes":
    case "second":
    case "seconds":
      return true;
    default:
      return false;
  }
}

export function isWorldEventRelativeTimeMode(
  value: unknown
): value is WorldEventRelativeTimeMode {
  return typeof value === "string"
    && (WORLD_EVENT_RELATIVE_TIME_MODES as readonly string[]).includes(value);
}

export function getWorldEventRelativeTimingPresentation(
  entity: StoryWorldEntityRecord,
  chapterStoryDate: unknown,
  eventName = entity.name,
  requestedMode: WorldEventRelativeTimeMode = "automatic"
): WorldEventRelativeTimingPresentation | null {
  const eventPresentation = getWorldEventTimePresentation(entity);
  if (
    !eventPresentation?.point
    || !eventPresentation.calendarDate
    || !hasUsableDayPrecision(eventPresentation.precision)
  ) {
    return null;
  }

  const eventDate = parseCivilDate(eventPresentation.calendarDate);
  const storyDate = parseCivilDate(chapterStoryDate);
  if (!eventDate || !storyDate) return null;

  const difference = civilDayNumber(storyDate) - civilDayNumber(eventDate);
  const name = eventName.trim() || "the event";
  if (difference === 0) {
    const display = `On the day of ${name}`;
    return {
      display,
      exactTotalDayDisplay: display,
      exactTotalDays: 0,
      requestedMode,
      resolvedMode: "total-days"
    };
  }

  const earlier = difference < 0 ? storyDate : eventDate;
  const later = difference < 0 ? eventDate : storyDate;
  const totalDays = Math.abs(difference);
  const calendar = calendarInterval(earlier, later);
  const totalMonths = totalMonthInterval(earlier, later);
  const resolvedMode: Exclude<WorldEventRelativeTimeMode, "automatic"> =
    requestedMode === "automatic"
      ? calendar.years > 0
        ? "calendar"
        : totalMonths.months > 0
          ? "total-months"
          : "total-days"
      : requestedMode;

  const magnitude = resolvedMode === "calendar"
    ? formatCalendarInterval(calendar)
    : resolvedMode === "total-months"
      ? formatTotalMonthInterval(totalMonths)
      : unit(totalDays, "day");
  const display = formatRelative(magnitude || unit(totalDays, "day"), difference, name);
  const exactTotalDayDisplay = formatRelative(unit(totalDays, "day"), difference, name);

  return {
    display,
    exactTotalDayDisplay,
    exactTotalDays: totalDays,
    requestedMode,
    resolvedMode
  };
}
