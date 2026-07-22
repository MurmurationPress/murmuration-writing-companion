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
