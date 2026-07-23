import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  compareTemporalIntervals,
  parseTemporalInterval
} from "../src/observations/TemporalInterval";

function supported(value: unknown) {
  const parsed = parseTemporalInterval(value);
  if (parsed.kind !== "supported") throw new Error(`Expected supported value: ${String(value)}`);
  return parsed.value;
}

test("preserves authored precision and proves only disjoint partial-date intervals", () => {
  equal(supported(2027).precision, "year");
  equal(supported(2027).source, "2027");
  equal(supported("2026").precision, "year");
  equal(supported("2026-07").precision, "month");
  equal(supported("2026-07-16").precision, "day");
  equal(supported("2026-07-16T14").precision, "hour");
  equal(supported("2026-07-16T14:22+01:00").precision, "minute");

  equal(compareTemporalIntervals(supported("2026"), supported("2027")), "before");
  equal(compareTemporalIntervals(supported("2026"), supported("2026-07")), "overlap");
  equal(compareTemporalIntervals(supported("2026-07"), supported("2026-08-01")), "before");
  equal(compareTemporalIntervals(supported("2026-07"), supported("2026-07-31")), "overlap");
});

test("supports numeric YAML years without coercing unrelated numbers", () => {
  equal(supported(2027).precision, "year");
  equal(supported({ at: 2027 }).precision, "year");
  equal(supported({ from: 2027 }).precision, "year");
  equal(parseTemporalInterval(2027.5).kind, "malformed");
  equal(parseTemporalInterval(27).kind, "malformed");
  equal(parseTemporalInterval(Number.NaN).kind, "malformed");
});

test("handles closed and open ranges conservatively", () => {
  equal(
    compareTemporalIntervals(
      supported({ from: "2027-01", until: "2027-03", precision: "month" }),
      supported("2026")
    ),
    "after"
  );
  equal(
    compareTemporalIntervals(supported({ from: "2027-01" }), supported("2026-12-31")),
    "after"
  );
  equal(
    compareTemporalIntervals(supported({ until: "2027-01" }), supported("2026-12-31")),
    "indeterminate"
  );
});

test("uses explicit offsets for instant comparison and rejects mixed offset authority", () => {
  equal(
    compareTemporalIntervals(
      supported("2026-07-16T10:00+02:00"),
      supported("2026-07-16T09:00Z")
    ),
    "before"
  );
  equal(
    compareTemporalIntervals(
      supported("2026-07-16T10:00+02:00"),
      supported("2026-07-16T09:00")
    ),
    "indeterminate"
  );
});

test("separates malformed and unsupported values", () => {
  equal(parseTemporalInterval("2026-02-30").kind, "malformed");
  equal(parseTemporalInterval({ at: "2026-01-01", precision: "approximate" }).kind, "unsupported");
  equal(parseTemporalInterval({ at: "2026-01-01", source: "[[Note]]" }).kind, "unsupported");
});

test("interprets explicit point shapes at every supported precision without requiring an end", () => {
  const values = [
    ["year", "2029"],
    ["month", "2029-04"],
    ["day", "2029-04-19"],
    ["hour", "2029-04-19T09:00:00+01:00"],
    ["minute", "2029-04-19T09:17:00+01:00"]
  ] as const;
  for (const [precision, from] of values) {
    const value = supported({ shape: "point", from, precision });
    equal(value.point, true);
    equal(value.authoredShape, "point");
    equal(value.until?.source, from);
  }
});

test("validates explicit ranges and reports one shape-specific failure", () => {
  equal(parseTemporalInterval({ shape: "range", from: "2029-04-19", precision: "day" }).kind, "malformed");
  const missing = parseTemporalInterval({ shape: "range", from: "2029-04-19", precision: "day" });
  if (missing.kind === "malformed") equal(missing.reason, "range_missing_end");
  const reversed = parseTemporalInterval({ shape: "range", from: "2029-04-20", to: "2029-04-19", precision: "day" });
  if (reversed.kind === "malformed") equal(reversed.reason, "reversed_temporal_range");
  const point = parseTemporalInterval({ shape: "point", precision: "hour" });
  if (point.kind === "malformed") equal(point.reason, "point_missing_time");
  const unknown = parseTemporalInterval({ shape: "window", from: "2029" });
  if (unknown.kind === "unsupported") equal(unknown.reason, "unsupported_temporal_shape");
});

test("compares point precision envelopes without inventing conflicts", () => {
  const april = supported({ shape: "point", from: "2029-04", precision: "month" });
  const day = supported({ shape: "point", from: "2029-04-19", precision: "day" });
  const may = supported({ shape: "point", from: "2029-05-01", precision: "day" });
  const range = supported({ shape: "range", from: "2029-04-18", to: "2029-04-20", precision: "day" });
  equal(compareTemporalIntervals(april, day), "overlap");
  equal(compareTemporalIntervals(day, range), "overlap");
  equal(compareTemporalIntervals(day, may), "before");
  equal(compareTemporalIntervals(may, day), "after");
});
