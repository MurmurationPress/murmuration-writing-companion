import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { projectStoryWorldTimeline } from "../src/story-world/StoryWorldTimeline";
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

test("orders exact year, month, day and minute points oldest first with deterministic path ties", () => {
  const result = projectStoryWorldTimeline([
    event("Z/Same.md", "2026-04-03"), event("A/Same.md", "2026-04-03"), event("World/Minute.md", "2026-04-03T09:15+01:00"),
    event("World/Month.md", "2026-03"), event("World/Year.md", "2025")
  ]);
  deepEqual(result.points.map((item) => item.path), ["World/Year.md", "World/Month.md", "A/Same.md", "Z/Same.md", "World/Minute.md"]);
  deepEqual(result.points.map((item) => item.precision), ["year", "month", "day", "day", "minute"]);
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
