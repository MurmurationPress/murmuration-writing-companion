import { deepEqual, equal, match } from "node:assert/strict";
import { test } from "node:test";
import { graphSelectionProjection, projectEventSceneGraph, projectTimelineAssertions } from "../src/story-world/StoryWorldEventSceneGraph";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";
import { projectStoryWorldTimeline } from "../src/story-world/StoryWorldTimeline";

function event(path: string, worldTime: unknown, sources: string[] = [], scope: string[] = []): StoryWorldEntityRecord {
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  return { path, basename: name, entityType: "event", name, aliases: [], facets: [], scope, status: "confirmed", summary: null,
    firstAppearance: null, sources, links: [], properties: { world_time: worldTime } };
}
function timeline(entities: StoryWorldEntityRecord[], scope?: string) {
  return projectStoryWorldTimeline(entities, (link) => link === "Broken" ? null : `${link}.md`, { scope });
}

test("projects one event with several explicit scenes and readable scene descriptions", () => {
  const graph = projectEventSceneGraph(timeline([event("Events/A.md", "2026-01-01", ["[[S1]]", "[[S2]]", "[[Broken]]"])]),
    (path) => ({ path, title: path === "S1.md" ? "Opening scene" : "Second scene", context: "Book One" }));
  equal(graph.events.length, 1); equal(graph.scenes.length, 3); equal(graph.edges.length, 3);
  equal(graph.scenes.find((node) => node.path === "S1.md")?.label, "Opening scene");
  equal(graph.scenes.find((node) => node.kind === "unresolved")?.label, "Broken");
});

test("several events share one resolved scene while every explicit edge remains", () => {
  const entities = [event("Events/A.md", "2026-01-01", ["[[Shared]]"]), event("Events/B.md", "2026-01-02", ["[[Shared]]"])];
  const graph = projectEventSceneGraph(timeline(entities), (path) => ({ path, title: "Shared scene", context: null }));
  equal(graph.scenes.length, 1); equal(graph.edges.length, 2); equal(graph.edges[0].sceneId, graph.edges[1].sceneId);
});

test("keeps no-source events and all placement categories visible", () => {
  const graph = projectEventSceneGraph(timeline([
    event("Year.md", "2026"), event("Month.md", "2026-02"), event("Day.md", "2026-02-03"), event("Minute.md", "2026-02-03T10:20+01:00"),
    event("Range.md", { from: "2026-02-01", until: "2026-02-04", precision: "day" }),
    event("Unsupported.md", { at: "about then", precision: "approximate" }), event("Undated.md", undefined)
  ]));
  deepEqual(graph.events.map((node) => node.placement), ["point-year", "point-month", "point-day", "point-minute", "range", "unsupported", "undated"]);
  equal(graph.edges.length, 0);
});

test("graph filtering is exactly the filtered chronology projection", () => {
  const entities = [event("A.md", "2026", [], ["Book One"]), event("B.md", "2027", ["[[S1]]"], ["Book Two"])];
  const graph = projectEventSceneGraph(timeline(entities, "Book Two"), (path) => ({ path, title: "Scene", context: null }));
  deepEqual(graph.events.map((node) => node.path), ["B.md"]); equal(graph.edges.length, 1);
});

test("graph identity, ordering and selection projection are deterministic", () => {
  const entities = [event("B.md", "2026-01-02", ["[[Shared]]"]), event("A.md", "2026-01-01", ["[[Shared]]", "[[Broken]]"])];
  const build = () => projectEventSceneGraph(timeline(entities), (path) => ({ path, title: path, context: null }));
  deepEqual(build(), build());
  const graph = build(); const shared = graph.scenes.find((node) => node.path === "Shared.md")!;
  const selection = graphSelectionProjection(graph, shared.id);
  equal(selection.edges.length, 2); equal(selection.nodes.length, 3);
  deepEqual(graphSelectionProjection(graph, null), { nodes: [], edges: [] });
  deepEqual(graphSelectionProjection(graph, "missing"), { nodes: [], edges: [] });
});

test("projects explicit sequence assertions separately and explains date conflicts", () => {
  const entities = [event("Events/A.md", "2027-01-01"), event("Events/B.md", "2026-01-01")];
  const docs = [{ path: "Models/Sequence.md", name: "Sequence", frontmatter: { world_model: "timeline", world_assertions: [
    { subject: "[[Events/A]]", predicate: "precedes", target: "[[Events/B]]", status: "confirmed", confidence: "authorial" },
    { subject: "[[Events/B]]", predicate: "custom_sequence", predicate_label: "echoes after", target: "[[Events/A]]", status: "disputed", unknown: { keep: true } }
  ] } }, { path: "Models/Other.md", name: "Other", frontmatter: { world_model: "causal", world_assertions: [
    { subject: "[[Events/A]]", predicate: "causes", target: "[[Events/B]]" }
  ] } }];
  const assertions = projectTimelineAssertions(docs, entities, (reference) => reference.includes("Events/A") ? "Events/A.md" : reference.includes("Events/B") ? "Events/B.md" : null);
  equal(assertions.length, 2); match(assertions[0].conflict ?? "", /conflicts/); equal(assertions[1].predicateLabel, "echoes after");
  deepEqual(assertions[1].qualifiers.unknown, { keep: true });
});
