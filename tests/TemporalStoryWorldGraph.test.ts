import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { buildStoryWorldGraph } from "../src/story-world/StoryWorldGraph";
import { extractTemporalGraphEvidence } from "../src/story-world/TemporalGraphEvidence";
import {
  buildTemporalGraphModel, moveTemporalPoint, projectTemporalGraph, reduceTemporalRelationshipState,
  TemporalChangeKind, TemporalGraphEvidence
} from "../src/story-world/TemporalStoryWorldGraph";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

const relationshipId = "relationship:World_A.md:0:World_B.md";
function evidence(id: string, date: string | null, change: TemporalChangeKind = "introduction", sequence: number | null = null, knownTo: readonly string[] = []): TemporalGraphEvidence {
  return { id, relationshipId, effectiveDate: date, sourcePath: `Sources/${id}.md`, supportingPath: `Book/${id}.md`, supportingLabel: id,
    manuscriptSequence: sequence, change, explicitTime: true, entityPaths: ["World/A.md", "World/B.md"], knownTo };
}
function entity(path: string, properties: Record<string, unknown> = {}, entityType = "character"): StoryWorldEntityRecord {
  const name = path.split("/").pop()!.replace(/\.md$/, "");
  return { path, basename: name, entityType, name, aliases: [], facets: [], scope: [], status: "confirmed", summary: null,
    firstAppearance: null, sources: [], links: [], properties: { world_entity: entityType, ...properties } };
}
const resolve = (reference: unknown): string | null => typeof reference === "string" ? `${/^\[\[([^\]]+)/.exec(reference)?.[1]}.md` : null;

test("change points use dated evidence only and sort date, manuscript sequence, path and stable identity", () => {
  const model = buildTemporalGraphModel([
    evidence("z", "2026-02-01", "introduction", 3), evidence("b", "2026-01-01", "introduction", 2),
    evidence("a", "2026-01-01", "introduction", 1), evidence("undated", null), evidence("invalid", "not-a-date")
  ]);
  deepEqual(model.changePoints.map((point) => point.date), ["2026-01-01", "2026-02-01"]);
  deepEqual(model.changePoints[0].evidence.map((item) => item.id), ["a", "b"]);
  equal(model.undated.length, 1); equal(model.diagnostics[0].diagnostic, "invalid-date");
});

test("same-date evidence forms one deterministic change point with a change count", () => {
  const model = buildTemporalGraphModel([evidence("one", "2026-01-01"), evidence("two", "2026-01-01", "contradiction")]);
  equal(model.changePoints.length, 1); equal(model.changePoints[0].evidence.length, 2);
  deepEqual(model.changePoints[0].affectedRelationshipIds, [relationshipId]);
});

test("cumulative world state introduces, persists through silence and closes only explicitly", () => {
  const items = [evidence("start", "2026-01-01"), evidence("unrelated-point", "2026-02-01")];
  const model = buildTemporalGraphModel(items);
  equal(reduceTemporalRelationshipState(items, model.changePoints[0], "world", "World/A.md").get(relationshipId)?.current, true);
  equal(reduceTemporalRelationshipState(items, model.changePoints[1], "world", "World/A.md").get(relationshipId)?.current, true);
  const ended = [...items, evidence("end", "2026-03-01", "ending")]; const endedModel = buildTemporalGraphModel(ended);
  equal(reduceTemporalRelationshipState(ended, endedModel.changePoints[2], "world", "World/A.md").get(relationshipId)?.current, false);
});

test("contradiction and supersession remain explicit evidence and do not collapse into current truth", () => {
  for (const change of ["contradiction", "supersession"] as const) {
    const items = [evidence("start", "2026-01-01"), evidence(change, "2026-02-01", change)];
    const state = reduceTemporalRelationshipState(items, buildTemporalGraphModel(items).changePoints[1], "world", "World/A.md").get(relationshipId)!;
    equal(state.current, false); equal(state.change, change); equal(state.evidence.length, 2);
  }
});

test("entity knowledge requires explicit knowledge signals, respects cutoff and never uses topology", () => {
  const items = [evidence("known", "2026-01-01", "introduction", 0, ["World/A.md"]), evidence("unknown", "2026-02-01", "introduction", 1)];
  const model = buildTemporalGraphModel(items);
  equal(reduceTemporalRelationshipState(items, model.changePoints[0], "entity", "World/A.md").size, 1);
  equal(reduceTemporalRelationshipState(items, model.changePoints[1], "entity", "World/B.md").size, 0);
});

test("reader knowledge follows manuscript sequence when reveal order differs from world chronology", () => {
  const laterWorldRevealedFirst = evidence("future", "2030-01-01", "introduction", 0);
  const earlierWorldRevealedLater = evidence("past", "2020-01-01", "introduction", 5);
  const point = { date: "2030-01-01", evidence: [laterWorldRevealedFirst], supportingLabel: null, manuscriptSequence: 0, affectedRelationshipIds: [relationshipId] };
  const state = reduceTemporalRelationshipState([earlierWorldRevealedLater, laterWorldRevealedFirst], point, "reader", "World/A.md");
  equal(state.get(relationshipId)?.evidence.some((item) => item.id === "future"), true);
  equal(state.get(relationshipId)?.evidence.some((item) => item.id === "past"), false);
});

test("display modes separate point evidence, cumulative current state and explicit changes", () => {
  const a = entity("World/A.md", { world_relationships: [{ predicate: "knows", target: "[[World/B]]", status: "confirmed" }] });
  const b = entity("World/B.md"); const graph = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve });
  const id = graph.edges[0].id;
  const items = [{ ...evidence("start", "2026-01-01"), relationshipId: id }, { ...evidence("end", "2026-02-01", "ending"), relationshipId: id }];
  const model = buildTemporalGraphModel(items);
  equal(projectTemporalGraph(graph, model, { perspective: "world", displayMode: "evidence", pointIndex: 0, centrePath: a.path }).edges.length, 1);
  const older = projectTemporalGraph(graph, model, { perspective: "world", displayMode: "known", pointIndex: 0, centrePath: a.path }).edges[0];
  equal(older.temporal?.change, "introduction"); equal(older.temporal?.subdued, false);
  equal(projectTemporalGraph(graph, model, { perspective: "world", displayMode: "known", pointIndex: 1, centrePath: a.path }).edges.length, 0);
  equal(projectTemporalGraph(graph, model, { perspective: "world", displayMode: "changes", pointIndex: 1, centrePath: a.path }).edges[0].temporal?.change, "ending");
});

test("slider positions clamp cleanly for zero, one and multiple points", () => {
  equal(moveTemporalPoint(0, 1, 0), 0); equal(moveTemporalPoint(0, 1, 1), 0);
  equal(moveTemporalPoint(0, 1, 3), 1); equal(moveTemporalPoint(2, 1, 3), 2); equal(moveTemporalPoint(0, -1, 3), 0);
});

test("extractor derives valid_from, valid_to, source sequence and conservative knowledge without writes", () => {
  const a = entity("World/A.md", { world_relationships: [{ predicate: "knows", target: "[[World/B]]", status: "confirmed", valid_from: "2026-01-01", valid_to: "2026-02-01", source: "[[Book/Scene]]", known_to: "[[World/A]]" }] });
  const b = entity("World/B.md"); const graph = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve });
  const before = JSON.stringify([a, b]);
  const items = extractTemporalGraphEvidence({ graph, entities: [a, b], resolve, documents: [{ path: "Book/Scene.md", label: "Scene", frontmatter: { story_date: "2026-01-01" }, manuscriptSequence: 7 }] });
  equal(items.length, 2); equal(items[0].effectiveDate, "2026-01-01"); equal(items[1].change, "ending");
  equal(items[0].manuscriptSequence, 7); ok(items[0].knownTo.includes(a.path)); equal(JSON.stringify([a, b]), before);
});

test("extractor keeps undated evidence separate and preserves Event effective time apart from Scene reveal time", () => {
  const event = entity("World/Event.md", { world_time: "2026-02-01", world_participants: ["[[World/A]]"], world_sources: ["[[Book/Scene]]"] }, "event");
  const a = entity("World/A.md"); const graph = buildStoryWorldGraph({ selectedPath: event.path, entities: [event, a], resolve });
  const conflict = extractTemporalGraphEvidence({ graph, entities: [event, a], resolve, documents: [{ path: "Book/Scene.md", label: "Scene", frontmatter: { story_date: "2026-01-01" }, manuscriptSequence: 0 }] });
  equal(conflict[0].diagnostic, undefined); equal(conflict[0].effectiveDate, "2026-02-01");
  equal(conflict[0].manuscriptSequence, 0);
  const undatedEvent = entity("World/Undated.md", { world_participants: ["[[World/A]]"] }, "event");
  const undatedGraph = buildStoryWorldGraph({ selectedPath: undatedEvent.path, entities: [undatedEvent, a], resolve });
  const undated = buildTemporalGraphModel(extractTemporalGraphEvidence({ graph: undatedGraph, entities: [undatedEvent, a], resolve, documents: [] }));
  equal(undated.changePoints.length, 0); equal(undated.undated.length, 1);
});

test("genuinely malformed effective evidence is excluded with its exact parser reason", () => {
  const a = entity("World/A.md", { world_relationships: [{ predicate: "knows", target: "[[World/B]]", status: "confirmed", valid_from: "not-a-date" }] });
  const b = entity("World/B.md"); const graph = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve });
  const [item] = extractTemporalGraphEvidence({ graph, entities: [a, b], resolve, documents: [] });
  equal(item.effectiveDate, null); equal(item.diagnostic, "invalid-date"); equal(item.diagnosticDetail, "invalid_iso_temporal_value");
});

test("a later manuscript Scene may reveal an explicitly earlier relationship without a false date conflict", () => {
  const a = entity("World/A.md", { world_relationships: [{ predicate: "knows", target: "[[World/B]]", status: "confirmed", valid_from: "2020-01-01", source: "[[Book/Later Reveal]]" }] });
  const b = entity("World/B.md"); const graph = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve });
  const [item] = extractTemporalGraphEvidence({ graph, entities: [a, b], resolve, documents: [{ path: "Book/Later Reveal.md", label: "Later Reveal", frontmatter: { story_date: "2030-01-01" }, manuscriptSequence: 9 }] });
  equal(item.effectiveDate, "2020-01-01"); equal(item.manuscriptSequence, 9); equal(item.diagnostic, undefined);
});

test("entity-level world_sources do not date every relationship when assertion-specific provenance exists", () => {
  const a = entity("World/A.md", { world_sources: ["[[Book/Entity Source]]"], world_relationships: [{ predicate: "knows", target: "[[World/B]]", status: "confirmed", source: "[[Book/Relationship Source]]" }] });
  const b = entity("World/B.md"); const graph = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve });
  const [item] = extractTemporalGraphEvidence({ graph, entities: [a, b], resolve, documents: [
    { path: "Book/Entity Source.md", label: "Entity Source", frontmatter: { story_date: "2000-01-01" }, manuscriptSequence: 0 },
    { path: "Book/Relationship Source.md", label: "Relationship Source", frontmatter: { story_date: "2020-01-01" }, manuscriptSequence: 1 }
  ] });
  equal(item.effectiveDate, "2020-01-01"); equal(item.supportingLabel, "Relationship Source");
});
