import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { projectStoryWorldTimeline, timelineAllFilterLabel, timelineReferenceLabel } from "../src/story-world/StoryWorldTimeline";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function event(path: string, worldTime: unknown, options: { scope?: string[]; status?: string | null; sources?: string[]; type?: string } = {}): StoryWorldEntityRecord {
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  return { path, basename: name, entityType: options.type ?? "event", name, aliases: [], facets: [], scope: options.scope ?? [],
    status: options.status ?? null, summary: null, firstAppearance: null, sources: options.sources ?? [], links: [], properties: { world_time: worldTime } };
}

test("extracts only primary event entities and groups point, range, unsupported and undated times", () => {
  const result = projectStoryWorldTimeline([
    event("World/Day.md", { at: "2026-04-03", precision: "day" }),
    event("World/Range.md", { from: "2026-04-04", until: "2026-04-06", precision: "day" }),
    event("World/Approx.md", { at: "about 2026", precision: "approximate" }),
    event("World/Undated.md", undefined), event("World/Character.md", "2020", { type: "character" })
  ]);
  deepEqual(result.points.map((item) => item.name), ["Day"]);
  deepEqual(result.ranges.map((item) => item.name), ["Range"]);
  deepEqual(result.unsupported.map((item) => item.name), ["Approx"]);
  deepEqual(result.undated.map((item) => item.name), ["Undated"]);
});

test("timeline uses the shared explicit shape interpretation", () => {
  const result = projectStoryWorldTimeline([
    event("World/The Article.md", { shape: "point", from: "2029-04-19T09:00:00+01:00", precision: "hour" }),
    event("World/Range.md", { shape: "range", from: "2029-04-20", to: "2029-04-21", precision: "day" })
  ]);
  equal(result.points[0].displayTime, "Thursday, 19 April 2029, 09:00");
  equal(result.ranges.length, 1);
  equal(result.unsupported.length, 0);
});

test("orders exact year, month, day and minute points oldest first with deterministic path ties", () => {
  const result = projectStoryWorldTimeline([
    event("Z/Same.md", "2026-04-03"), event("A/Same.md", "2026-04-03"), event("World/Minute.md", "2026-04-03T09:15+01:00"),
    event("World/Month.md", "2026-03"), event("World/Year.md", "2025")
  ]);
  deepEqual(result.points.map((item) => item.path), ["World/Year.md", "World/Month.md", "A/Same.md", "Z/Same.md", "World/Minute.md"]);
  deepEqual(result.points.map((item) => item.precision), ["year", "month", "day", "day", "minute"]);
});

test("keeps every supported point and range precision out of the unsupported group", () => {
  const supported = [
    ["Year", { from: "2026", precision: "year" }, { from: "2026", until: "2027", precision: "year" }],
    ["Month", { from: "2026-04", precision: "month" }, { from: "2026-04", until: "2026-05", precision: "month" }],
    ["Day", { from: "2026-04-03T09:31:00+01:00", precision: "day" }, { from: "2026-04-03", until: "2026-04-04", precision: "day" }],
    ["Hour", { from: "2026-04-03T09:00:00+01:00", precision: "hour" }, { from: "2026-04-03T09:00:00+01:00", until: "2026-04-03T11:00:00+01:00", precision: "hour" }],
    ["Minute", { from: "2026-04-03T09:15:00+01:00", precision: "minute" }, { from: "2026-04-03T09:15:00+01:00", until: "2026-04-03T09:45:00+01:00", precision: "minute" }]
  ] as const;
  const entities = supported.flatMap(([label, point, range]) => [event(`${label} point.md`, point), event(`${label} range.md`, range)]);
  const result = projectStoryWorldTimeline(entities);
  deepEqual(result.points.map((item) => item.precision).sort(), ["day", "hour", "minute", "month", "year"]);
  deepEqual(result.ranges.map((item) => item.precision).sort(), ["day", "hour", "minute", "month", "year"]);
  deepEqual(result.unsupported, []);
});

test("reserves unsupported grouping for approximate, uncertain, unknown or malformed values", () => {
  const result = projectStoryWorldTimeline([
    event("Approximate.md", { at: "about 2026", precision: "approximate" }),
    event("Uncertain.md", { at: "2026", precision: "year", uncertain: true }),
    event("Unknown.md", { at: "2026", precision: "season" }),
    event("Malformed.md", { from: "2026-02-30", until: "2026-03-01", precision: "day" })
  ]);
  deepEqual(result.unsupported.map((item) => item.name), ["Approximate", "Malformed", "Uncertain", "Unknown"]);
  deepEqual(result.points, []);
  deepEqual(result.ranges, []);
});

test("scope, status and precision filters affect only the projection and preserve unknown values as options", () => {
  const entities = [
    event("A.md", "2026", { scope: ["Book One"], status: "rumoured" }),
    event("B.md", "2027-02", { scope: ["Book Two", "Shared"], status: "custom-canon" }),
    event("C.md", undefined),
    event("D.md", { at: "about 2028", precision: "observed-window" }, { scope: ["Book Two"] })
  ];
  const all = projectStoryWorldTimeline(entities);
  deepEqual(all.scopes, ["Book One", "Book Two", "Shared"]);
  deepEqual(all.statuses, ["custom-canon", "rumoured", "Unspecified"]);
  deepEqual(all.precisions, ["month", "observed-window", "undated", "year"]);
  equal(projectStoryWorldTimeline(entities, undefined, { scope: "Book Two" }).points[0]?.name, "B");
  equal(projectStoryWorldTimeline(entities, undefined, { status: "rumoured", precision: "year" }).points[0]?.name, "A");
  equal(projectStoryWorldTimeline(entities, undefined, { precision: "observed-window" }).unsupported[0]?.name, "D");
});

test("projects only explicit world_sources links and keeps unresolved sources visible", () => {
  const result = projectStoryWorldTimeline([
    event("World/Event.md", "2026-04-03", { sources: ["[[Books/Scene|Opening scene]]", "[[Missing Scene]]", "author note"] })
  ], (linkpath) => linkpath === "Books/Scene" ? "Books/Scene.md" : null);
  deepEqual(result.points[0].sources, [
    { raw: "[[Books/Scene|Opening scene]]", label: "Opening scene", resolvedPath: "Books/Scene.md" },
    { raw: "[[Missing Scene]]", label: "Missing Scene", resolvedPath: null },
    { raw: "author note", label: "author note", resolvedPath: null }
  ]);
});

test("shows calendar intervals only where exact day precision supports them", () => {
  const result = projectStoryWorldTimeline([event("A.md", "2026-01-01"), event("B.md", "2027-02-03")]);
  equal(result.points[1].relativeToPrevious, "1 year, 1 month, 2 days after A");
});

test("uses grammatical filter plurals and readable scope link labels", () => {
  equal(timelineAllFilterLabel("Scope"), "All scopes");
  equal(timelineAllFilterLabel("Status"), "All statuses");
  equal(timelineAllFilterLabel("Precision"), "All precisions");
  equal(timelineReferenceLabel("[[Books/BOOK 1 - EMERGENCE|Emergence]]"), "Emergence");
  equal(timelineReferenceLabel("[[Books/BOOK 1 - EMERGENCE]]"), "BOOK 1 - EMERGENCE");
});
