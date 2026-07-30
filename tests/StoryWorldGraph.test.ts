import { deepEqual, equal, notEqual, ok } from "node:assert/strict";
import { test } from "node:test";
import { buildStoryWorldGraph, layoutStoryWorldGraph, STORY_WORLD_GRAPH_DENSITIES, storyWorldGraphNodeShape, storyWorldGraphStatusIsProvisional, storyWorldGraphValidity } from "../src/story-world/StoryWorldGraph";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";
import { observeIncompleteEntityRelationships } from "../src/story-world/StoryWorldObservations";
import { selectStoryWorldGraphNode, storyWorldGraphEdgeOpenPath, storyWorldGraphNodeOpenPath, StoryWorldGraphNavigation } from "../src/story-world/StoryWorldGraphNavigation";

function entity(path: string, properties: Record<string, unknown> = {}, options: Partial<StoryWorldEntityRecord> = {}): StoryWorldEntityRecord {
  const basename = path.split("/").pop()!.replace(/\.md$/, "");
  return { path, basename, entityType: "character", name: basename, aliases: [], facets: [], scope: [], status: "confirmed", summary: null,
    firstAppearance: null, sources: [], links: [], properties: { world_entity: "character", ...properties }, ...options };
}
function resolver(paths: readonly string[]) {
  return (reference: unknown) => {
    if (typeof reference !== "string") return null;
    const target = /^\[\[([^|\]]+)/.exec(reference)?.[1]; if (!target) return null;
    const path = target.endsWith(".md") ? target : `${target}.md`;
    return paths.includes(path) ? path : null;
  };
}

test("builds a deterministic directed one-hop neighbourhood from relationship projections", () => {
  const a = entity("World/A.md", { world_relationships: [
    { predicate: "knows", target: "[[World/B]]", status: "confirmed" },
    { predicate: "custom_predicate", target: "[[World/C]]", status: "planned" }
  ] }, { entityType: "custom-person" });
  const b = entity("World/B.md", { world_relationships: [{ predicate: "knows", target: "[[World/D]]", status: "confirmed" }] });
  const c = entity("World/C.md", { world_relationships: [{ predicate: "supports", target: "[[World/A]]", status: "confirmed" }] });
  const d = entity("World/D.md"); const entities = [a, b, c, d];
  const first = buildStoryWorldGraph({ selectedPath: a.path, entities, resolve: resolver(entities.map((item) => item.path)) });
  const second = buildStoryWorldGraph({ selectedPath: a.path, entities, resolve: resolver(entities.map((item) => item.path)) });
  deepEqual(second, first);
  deepEqual(first.nodes.map((node) => node.path).sort(), [a.path, b.path, c.path].sort());
  equal(first.nodes.some((node) => node.path === d.path), false);
  equal(first.edges.length, 3);
  ok(first.edges.every((edge) => edge.direction === "authored"));
  equal(first.edges.some((edge) => edge.from === `note:${c.path}` && edge.to === `note:${a.path}`), true);
  equal(first.edges.some((edge) => edge.from === `note:${a.path}` && edge.to === `note:${c.path}` && edge.label === "supports"), false);
  ok(first.availablePredicates.includes("custom_predicate"));
  equal(first.nodes.find((node) => node.path === a.path)?.entityType, "custom-person");
});

test("one hop retains focused centre edges instead of unrelated neighbour-to-neighbour assertions", () => {
  const a = entity("World/A.md", { world_relationships: ["B", "C"].map((target) => ({ predicate: "knows", target: `[[World/${target}]]`, status: "confirmed" })) });
  const b = entity("World/B.md", { world_relationships: [{ predicate: "knows", target: "[[World/C]]", status: "confirmed" }] });
  const c = entity("World/C.md"); const graph = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b, c], resolve: resolver([a.path, b.path, c.path]) });
  equal(graph.edges.length, 2);
  equal(graph.edges.some((edge) => edge.from === `note:${b.path}` && edge.to === `note:${c.path}`), false);
});

test("projects explicit event participants and optional manuscript provenance", () => {
  const event = entity("Events/Launch.md", {
    world_entity: "event", world_participants: ["[[World/A]]", "[[World/B]]"], world_sources: ["[[Book/Scene 1]]"]
  }, { entityType: "event", sources: ["[[Book/Scene 1]]"] });
  const a = entity("World/A.md"); const b = entity("World/B.md"); const paths = [event.path, a.path, b.path, "Book/Scene 1.md"];
  const graph = buildStoryWorldGraph({ selectedPath: event.path, entities: [event, a, b], resolve: resolver(paths), includeProvenance: true,
    scene: (path) => path === "Book/Scene 1.md" ? { label: "Scene One" } : null });
  equal(graph.edges.filter((edge) => edge.kind === "participation").length, 2);
  equal(graph.edges.filter((edge) => edge.kind === "provenance").length, 1);
  equal(graph.nodes.find((node) => node.path === "Book/Scene 1.md")?.kind, "scene");
});

test("includes explicit supporting models but does not infer model edges", () => {
  const a = entity("World/A.md", {}, { entityType: "event" }); const b = entity("World/B.md", {}, { entityType: "event" });
  const graph = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve: resolver([a.path, b.path]), documents: [
    { path: "Models/Explicit.md", basename: "Explicit", frontmatter: { world_model: "relationship", world_model_subject: "[[World/A]]" } },
    { path: "Models/Timeline.md", basename: "Timeline", frontmatter: { world_model: "timeline", world_assertions: [{ subject: "[[World/A]]", predicate: "precedes", target: "[[World/B]]" }] } },
    { path: "Models/Unrelated.md", basename: "Unrelated", frontmatter: { world_model: "relationship", prose_link: "[[World/A]]" } }
  ] });
  equal(graph.edges.filter((edge) => edge.kind === "supporting-model").length, 2);
  equal(graph.edges.some((edge) => edge.from === `note:${a.path}` && edge.to === `note:${b.path}` && edge.label === "precedes"), true);
  equal(graph.nodes.some((node) => node.path === "Models/Unrelated.md"), false);
});

test("includes a Reference as a generic node without inferring identifier or URL edges", () => {
  const reference = entity("References/Source.md", {
    world_entity: "reference", reference_doi: "10.xxxx/example", reference_isbn: "9780000000000",
    link: "https://example.org/source"
  }, { entityType: "reference", name: "Source" });
  const graph = buildStoryWorldGraph({ selectedPath: reference.path, entities: [reference], resolve: resolver([reference.path]) });
  equal(graph.nodes.length, 1);
  equal(graph.nodes[0].entityType, "reference");
  equal(graph.edges.length, 0);
});

test("filters predicate, status, node type and explicit Book scope without mutation", () => {
  const a = entity("World/A.md", { world_relationships: [
    { predicate: "knows", target: "[[World/B]]", status: "confirmed" },
    { predicate: "works_for", target: "[[World/C]]", status: "superseded" }
  ] });
  const b = entity("World/B.md"); const c = entity("World/C.md"); const entities = [a, b, c]; const before = JSON.stringify(entities);
  const base = { selectedPath: a.path, entities, resolve: resolver(entities.map((item) => item.path)) };
  equal(buildStoryWorldGraph({ ...base, predicate: "knows" }).edges.length, 1);
  equal(buildStoryWorldGraph({ ...base, status: "superseded" }).edges[0].to, `note:${c.path}`);
  equal(buildStoryWorldGraph({ ...base, nodeType: "event" }).nodes.length, 1);
  equal(buildStoryWorldGraph({ ...base, allowedPaths: new Set([a.path, b.path]) }).edges.length, 1);
  equal(JSON.stringify(entities), before);
});

test("classifies active, future, expired and indeterminate validity with shared temporal rules", () => {
  equal(storyWorldGraphValidity({ from: "2026-01-01", until: "2026-12-31" }, "2026-06-01"), "active");
  equal(storyWorldGraphValidity({ from: "2027", until: "2028" }, "2026"), "future");
  equal(storyWorldGraphValidity({ from: "2024", until: "2025" }, "2026"), "expired");
  equal(storyWorldGraphValidity({ from: "unknown" }, "2026"), "indeterminate");
  equal(storyWorldGraphValidity({ from: "2026" }, undefined), "indeterminate");
});

test("collapses duplicate visual edges and enforces a deterministic node limit", () => {
  const relationships = Array.from({ length: 8 }, (_, index) => ({ predicate: "knows", target: `[[World/N${index}]]`, status: "confirmed" }));
  relationships.push({ predicate: "knows", target: "[[World/N0]]", status: "confirmed" });
  const centre = entity("World/Centre.md", { world_relationships: relationships });
  const neighbours = Array.from({ length: 8 }, (_, index) => entity(`World/N${index}.md`)); const entities = [centre, ...neighbours];
  const graph = buildStoryWorldGraph({ selectedPath: centre.path, entities, resolve: resolver(entities.map((item) => item.path)), nodeLimit: 5 });
  equal(graph.truncated, true); equal(graph.omittedNodeCount, 4); equal(graph.nodes.length, 5);
  equal(graph.edges.filter((edge) => edge.to === "note:World/N0.md").length, 1);
});

test("keeps malformed relationships diagnostic while valid siblings still form edges and share review identity", () => {
  const a = entity("World/A.md", { world_relationships: [
    { predicate: "knows" },
    { predicate: "knows", target: "[[World/B]]", status: "confirmed" }
  ] });
  const b = entity("World/B.md"); const observations = observeIncompleteEntityRelationships(a);
  const graph = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve: resolver([a.path, b.path]), observations });
  equal(graph.edges.length, 1); equal(graph.diagnostics.length, 1);
  equal(graph.nodes.find((node) => node.path === a.path)?.reviewFingerprints[0], observations[0].fingerprint);
  equal(graph.diagnostics[0].reviewFingerprints[0], observations[0].fingerprint);
});

test("deletion, restoration, rename and unresolved or Trash-like targets follow current resolver truth", () => {
  const a = entity("World/A.md", { world_relationships: [{ predicate: "knows", target: "[[World/B]]", status: "confirmed" }] });
  const b = entity("World/B.md");
  equal(buildStoryWorldGraph({ selectedPath: a.path, entities: [a], resolve: () => null }).edges.length, 0);
  equal(buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve: resolver([a.path, b.path]) }).edges.length, 1);
  const renamed = entity("World/Renamed B.md");
  const updated = entity("World/A.md", { world_relationships: [{ predicate: "knows", target: "[[World/Renamed B]]", status: "confirmed" }] });
  const after = buildStoryWorldGraph({ selectedPath: updated.path, entities: [updated, renamed], resolve: resolver([updated.path, renamed.path]) });
  equal(after.edges.length, 1); notEqual(after.edges[0].to, `note:${b.path}`);
  equal(buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve: () => null }).edges.length, 0);
});

test("stable radial layout is local derived presentation state", () => {
  const a = entity("World/A.md", { world_relationships: [{ predicate: "knows", target: "[[World/B]]", status: "confirmed" }] });
  const b = entity("World/B.md"); const graph = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve: resolver([a.path, b.path]) });
  deepEqual([...layoutStoryWorldGraph(graph, 900, 560)], [...layoutStoryWorldGraph(graph, 900, 560)]);
  equal(layoutStoryWorldGraph(graph, 900, 560).get(`note:${a.path}`)?.x, 450);
});

test("all bounded density presets produce stable distinct layout", () => {
  deepEqual(Object.keys(STORY_WORLD_GRAPH_DENSITIES), ["compact", "comfortable", "spacious"]);
  const a = entity("World/A.md", { world_relationships: [{ predicate: "knows", target: "[[World/B]]", status: "confirmed" }] });
  const b = entity("World/B.md"); const graph = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve: resolver([a.path, b.path]) });
  const positions = (["compact", "comfortable", "spacious"] as const).map((density) => layoutStoryWorldGraph(graph, 900, 560, density).get(`note:${b.path}`));
  ok(positions[0]!.y > positions[1]!.y && positions[1]!.y > positions[2]!.y);
  deepEqual([...layoutStoryWorldGraph(graph, 900, 560, "spacious")], [...layoutStoryWorldGraph(graph, 900, 560, "spacious")]);
});

test("visual grammar separates type, status and centre emphasis", () => {
  equal(storyWorldGraphNodeShape({ kind: "event", entityType: "event" }), "chevron");
  equal(storyWorldGraphNodeShape({ kind: "entity", entityType: "location" }), "rectangle");
  equal(storyWorldGraphStatusIsProvisional("confirmed"), false);
  equal(storyWorldGraphStatusIsProvisional("planned"), true);
  equal(storyWorldGraphStatusIsProvisional(null), false);
});

test("relationship labels omit redundant exact status while inspection retains it", () => {
  const a = entity("World/A.md", { world_relationships: [{ predicate: "protects", target: "[[World/B]]", status: "confirmed" }] });
  const b = entity("World/B.md"); const edge = buildStoryWorldGraph({ selectedPath: a.path, entities: [a, b], resolve: resolver([a.path, b.path]) }).edges[0];
  equal(edge.label, "protects"); equal(edge.status, "confirmed"); equal(edge.label.includes("confirmed"), false);
});

test("entity and event activation recentre without invoking an opener, while a source Scene only selects detail", () => {
  const navigation = new StoryWorldGraphNavigation(); navigation.follow("World/A.md");
  const entityNode = { id: "note:World/B.md", kind: "entity" as const, entityType: "character", label: "B", path: "World/B.md", central: false, status: null, scope: [], reviewFingerprints: [], manuscriptImpactCount: null };
  const eventNode = { ...entityNode, id: "note:Events/C.md", kind: "event" as const, entityType: "event", label: "C", path: "Events/C.md" };
  const sceneNode = { ...entityNode, id: "note:Book/Scene.md", kind: "scene" as const, entityType: "scene", label: "Scene", path: "Book/Scene.md" };
  equal(selectStoryWorldGraphNode(navigation, entityNode), "recenter"); equal(navigation.get().centrePath, entityNode.path);
  equal(selectStoryWorldGraphNode(navigation, eventNode), "recenter"); equal(navigation.get().centrePath, eventNode.path);
  equal(selectStoryWorldGraphNode(navigation, sceneNode), "detail"); equal(navigation.get().centrePath, eventNode.path);
  equal(storyWorldGraphNodeOpenPath(sceneNode), sceneNode.path);
});

test("supporting models can become graph centres and explicit open targets remain separate", () => {
  const a = entity("World/A.md");
  const documents = [{ path: "Models/A.md", basename: "Model A", frontmatter: { world_model: "relationship", world_model_subject: "[[World/A]]" } }];
  const graph = buildStoryWorldGraph({ selectedPath: "Models/A.md", entities: [a], documents, resolve: resolver([a.path]) });
  equal(graph.nodes.find((node) => node.central)?.kind, "model"); equal(graph.edges.length, 1);
  const navigation = new StoryWorldGraphNavigation(); navigation.follow(a.path);
  const model = graph.nodes.find((node) => node.central)!;
  equal(selectStoryWorldGraphNode(navigation, model), "recenter"); equal(navigation.get().centrePath, model.path);
  equal(storyWorldGraphNodeOpenPath(model), "Models/A.md");
  equal(storyWorldGraphEdgeOpenPath(graph.edges[0]), "Models/A.md");
});

test("Back, Forward, branching and duplicate suppression are deterministic local state", () => {
  const navigation = new StoryWorldGraphNavigation(); navigation.follow("A.md"); navigation.navigate("B.md"); navigation.navigate("C.md");
  equal(navigation.back(), "B.md"); equal(navigation.get().canForward, true);
  equal(navigation.forward(), "C.md"); navigation.navigate("C.md");
  equal(navigation.back(), "B.md"); navigation.navigate("D.md");
  equal(navigation.get().centrePath, "D.md"); equal(navigation.get().canForward, false);
  equal(navigation.back(), "B.md"); equal(navigation.back(), "A.md"); equal(navigation.back(), null);
});

test("active-note following stops after manual traversal and explicit Follow resynchronises", () => {
  const navigation = new StoryWorldGraphNavigation(); navigation.initialise("A.md");
  equal(navigation.observeActive("B.md"), true); equal(navigation.get().centrePath, "B.md");
  navigation.navigate("C.md"); equal(navigation.get().followsActiveNote, false);
  equal(navigation.observeActive("D.md"), false); equal(navigation.get().centrePath, "C.md");
  navigation.follow("D.md"); equal(navigation.get().centrePath, "D.md"); equal(navigation.get().followsActiveNote, true);
});

test("history reconciles deletion and rename without authority writes", () => {
  const navigation = new StoryWorldGraphNavigation(); navigation.follow("A.md"); navigation.navigate("B.md"); navigation.navigate("C.md");
  navigation.reconcile(new Set(["A.md", "Renamed B.md"]), new Map([["B.md", "Renamed B.md"]]));
  equal(navigation.get().centrePath, "Renamed B.md"); equal(navigation.back(), "A.md");
  navigation.reconcile(new Set()); equal(navigation.get().centrePath, null); equal(navigation.get().followsActiveNote, true);
  navigation.reconcile(new Set(["C.md"])); equal(navigation.get().centrePath, null);
});
