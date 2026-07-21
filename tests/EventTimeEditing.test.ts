import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { parseEventTime, projectEventTime, serialiseEventTime, SupportedEventTime } from "../src/story-world/EventTimeEditing";

function supported(value: unknown): SupportedEventTime {
  const parsed = parseEventTime(value);
  if (parsed.kind !== "supported") throw new Error("Expected supported event time");
  return parsed.value;
}

test("parses and projects year, month, day and minute points", () => {
  equal(supported("2026").precision, "year");
  equal(projectEventTime(supported("2026-07")), "July 2026");
  equal(projectEventTime(supported({ at: "2026-07-16", precision: "day" })), "Thursday, 16 July 2026");
  equal(projectEventTime(supported({ at: "2026-07-16T14:22+01:00", precision: "minute" })), "Thursday, 16 July 2026, 14:22");
});

test("parses and serialises ranges with distinct endpoints", () => {
  const value = supported({ from: "2026-07-16", until: "2026-07-18", precision: "day" });
  equal(value.mode, "range");
  deepEqual(serialiseEventTime(value), { from: "2026-07-16", until: "2026-07-18", precision: "day" });
  equal(projectEventTime(value), "Thursday, 16 July 2026 – Saturday, 18 July 2026");
});

test("parses and serialises hour-precision points and ranges", () => {
  const point = supported({ at: "2026-07-16T14+01:00", precision: "hour" });
  equal(point.precision, "hour");
  equal(point.from.time, "14:00");
  deepEqual(serialiseEventTime(point), { at: "2026-07-16T14:00+01:00", precision: "hour" });
  const range = supported({ from: "2026-07-16T14:00+01:00", until: "2026-07-16T16:00+01:00", precision: "hour" });
  equal(range.mode, "range");
  deepEqual(serialiseEventTime(range), { from: "2026-07-16T14:00+01:00", until: "2026-07-16T16:00+01:00", precision: "hour" });
});

test("accepts established single-from points and safely projects finer ISO detail", () => {
  const day = supported({ from: "2027-06-23T09:31:00+01:00", precision: "day" });
  equal(day.mode, "point");
  equal(day.precision, "day");
  equal(projectEventTime(day), "Wednesday, 23 June 2027");
  const hour = supported({ from: "2029-04-19T09:00:00+01:00", precision: "hour" });
  equal(hour.precision, "hour");
  equal(hour.from.time, "09:00");
  equal(hour.from.offset, "+01:00");
  const minute = supported({ from: "2029-06-29T19:40:00+01:00", precision: "minute" });
  equal(minute.precision, "minute");
  equal(minute.from.time, "19:40");
});

test("preserves written timezone offsets without conversion", () => {
  const value = supported({ at: "2026-07-16T00:30+14:00", precision: "minute" });
  equal(value.from.offset, "+14:00");
  deepEqual(serialiseEventTime(value), { at: "2026-07-16T00:30+14:00", precision: "minute" });
});

test("marks approximate, qualified and unknown structured values unsupported", () => {
  equal(parseEventTime({ at: "about 2026", precision: "approximate" }).kind, "unsupported");
  const original = { from: "2026-01-01", until: "2026-02-01", precision: "observed-window", source: "[[Clock]]" };
  const parsed = parseEventTime(original);
  equal(parsed.kind, "unsupported");
  if (parsed.kind === "unsupported") deepEqual(parsed.preserved, original);
});

test("explicit replacement serialises a supported value while an absent value is undated", () => {
  equal(parseEventTime(undefined).kind, "undated");
  deepEqual(serialiseEventTime(supported("2028-03")), { at: "2028-03", precision: "month" });
});
