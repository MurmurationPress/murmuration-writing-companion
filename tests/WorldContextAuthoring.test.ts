import { deepEqual, equal, match, ok, rejects } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";
import {
  InvalidWorldContextPropertyError,
  planWorldContextAddition,
  planWorldContextRemoval,
  searchWorldContextCandidates,
  serializeWorldContextEntityReference
} from "../src/story-world/WorldContextAuthoring";
import {
  buildWorldContext,
  collectSemanticManuscriptReferences
} from "../src/story-world/WorldContext";
import { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";
import {
  buildStoryWorldReview,
  StoryWorldReviewDocument
} from "../src/story-world/StoryWorldReview";
import {
  addIndexedEntityToWorldContext,
  removeIndexedEntityFromWorldContext
} from "../src/companion/ObsidianWorldContextAuthoring";

function entity(
  pathValue: string,
  name: string,
  entityType = "event",
  aliases: readonly string[] = []
): StoryWorldEntityRecord {
  return {
    path: pathValue,
    basename: pathValue.split("/").pop()?.replace(/\.md$/iu, "") ?? pathValue,
    entityType,
    name,
    aliases,
    facets: [],
    scope: [],
    status: "confirmed",
    summary: null,
    firstAppearance: null,
    sources: [],
    links: [],
    properties: { world_entity: entityType, world_name: name, aliases: [...aliases] }
  };
}

function mappedResolver(
  values: Readonly<Record<string, StoryWorldEntityRecord | null>>
) {
  return (reference: string) => values[reference] ?? null;
}

test("adds indexed entity types without replacing authored scalar, list or custom YAML", () => {
  const event = entity("Story World/Events/Intervention.md", "First Routing Intervention");
  const resolve = mappedResolver({ "[[First Routing Intervention]]": event });

  const absent = planWorldContextAddition({ type: "scene", custom: { retained: true } }, event, resolve);
  deepEqual(absent.values, ["[[First Routing Intervention]]"]);
  equal(absent.property, "world_context");

  const scalar = planWorldContextAddition({ "world-context": "[[PRIME]]" }, event, resolve);
  deepEqual(scalar.values, ["[[PRIME]]", "[[First Routing Intervention]]"]);
  equal(scalar.property, "world-context");

  const list = ["[[PRIME]]", "[[Unknown Event]]"];
  const frontmatter = { world_context: list, custom: { untouched: true } };
  const before = JSON.stringify(frontmatter);
  deepEqual(planWorldContextAddition(frontmatter, event, resolve).values, [
    "[[PRIME]]",
    "[[Unknown Event]]",
    "[[First Routing Intervention]]"
  ]);
  equal(JSON.stringify(frontmatter), before);
  deepEqual(list, ["[[PRIME]]", "[[Unknown Event]]"]);
});

test("serializes canonical names when unique and path-qualified links when required", () => {
  const ordinary = entity("World/Events/Intervention.md", "First Routing Intervention");
  equal(serializeWorldContextEntityReference(ordinary, mappedResolver({
    "[[First Routing Intervention]]": ordinary
  })), "[[First Routing Intervention]]");

  const renamed = entity("World/Events/Internal filename.md", "Public Event Name", "event", ["Old Event"]);
  equal(serializeWorldContextEntityReference(renamed, mappedResolver({
    "[[Public Event Name]]": renamed
  })), "[[Public Event Name]]");

  const colliding = entity("Story World/Events/Collision.md", "Shared Name");
  equal(serializeWorldContextEntityReference(colliding, mappedResolver({
    "[[Shared Name]]": null,
    "[[Collision]]": null,
    "[[Story World/Events/Collision]]": colliding
  })), "[[Story World/Events/Collision]]");
});

test("never guesses a candidate that cannot be serialized unambiguously", () => {
  const ambiguous = entity("World/Ambiguous.md", "Shared");
  rejects(async () => serializeWorldContextEntityReference(
    ambiguous,
    () => null
  ), /cannot be serialized as an unambiguous wikilink/u);
});

test("prevents semantic duplicates across canonical alias and qualified forms", () => {
  const event = entity("World/Events/Intervention.md", "First Routing Intervention", "event", ["Routing"]);
  const resolve = mappedResolver({
    "[[First Routing Intervention]]": event,
    "[[Routing]]": event,
    "[[World/Events/Intervention]]": event
  });

  for (const reference of [
    "[[First Routing Intervention]]",
    "[[Routing]]",
    "[[World/Events/Intervention]]"
  ]) {
    const plan = planWorldContextAddition({ world_context: [reference] }, event, resolve);
    equal(plan.changed, false);
    deepEqual(plan.values, [reference]);
  }
});

test("removes only equivalent explicit references and preserves unresolved values and derived fields", () => {
  const event = entity("World/Event.md", "Event");
  const other = entity("World/Other.md", "Other", "character");
  const resolve = mappedResolver({
    "[[Event]]": event,
    "[[Event Alias]]": event,
    "[[Other]]": other
  });
  const frontmatter = {
    pov: "[[Pip]]",
    location: "[[Reserve]]",
    world_context: ["[[Other]]", "[[Unknown]]", "[[Event Alias]]"],
    custom: "preserved"
  };
  const before = JSON.stringify(frontmatter);
  const plan = planWorldContextRemoval(frontmatter, event, resolve);
  equal(plan.changed, true);
  deepEqual(plan.values, ["[[Other]]", "[[Unknown]]"]);
  equal(JSON.stringify(frontmatter), before);
  equal(frontmatter.pov, "[[Pip]]");
  equal(frontmatter.location, "[[Reserve]]");
});

test("removing explicit POV context leaves the same entity available through POV", () => {
  const tobias = entity("Story World/Characters/Tobias.md", "Tobias", "character");
  const resolve = mappedResolver({ "[[Tobias]]": tobias });
  const frontmatter = {
    pov: "[[Tobias]]",
    world_context: ["[[Tobias]]"]
  };

  const before = buildWorldContext(frontmatter, resolve);
  equal(before.entries.length, 1);
  deepEqual(before.entries[0].reasons, ["explicit", "pov"]);

  const removal = planWorldContextRemoval(frontmatter, tobias, resolve);
  deepEqual(removal.values, []);
  const after = buildWorldContext({ pov: frontmatter.pov, world_context: removal.values }, resolve);
  equal(after.entries.length, 1);
  equal(after.entries[0].entity.path, tobias.path);
  deepEqual(after.entries[0].reasons, ["pov"]);
});

test("malformed properties are refused without mutation", () => {
  const event = entity("World/Event.md", "Event");
  const frontmatter = { world_context: { invalid: true }, custom: "safe" };
  const before = JSON.stringify(frontmatter);
  try {
    planWorldContextAddition(frontmatter, event, () => event);
    throw new Error("Expected invalid world_context to be refused");
  } catch (error) {
    ok(error instanceof InvalidWorldContextPropertyError);
  }
  equal(JSON.stringify(frontmatter), before);
});

test("picker projection searches cached names and aliases, filters types and orders Events first", () => {
  const entities = [
    entity("World/Pip.md", "Pip", "character", ["Philippa"]),
    entity("World/PRIME.md", "PRIME", "intelligence"),
    entity("World/Reserve.md", "Coastal Reserve", "location"),
    entity("World/Reference.md", "Research Paper", "reference"),
    entity("World/Profile.md", "PRIME POV", "pov-profile"),
    entity("World/Custom.md", "Atlantic Front", "weather-system"),
    entity("World/Event.md", "Routing Intervention", "event", ["First intervention"])
  ];
  equal(searchWorldContextCandidates(entities, "intervention")[0].entityType, "event");
  deepEqual(searchWorldContextCandidates(entities, "philippa").map((item) => item.name), ["Pip"]);
  deepEqual(searchWorldContextCandidates(entities, "", "location").map((item) => item.name), ["Coastal Reserve"]);
  equal(searchWorldContextCandidates(entities, "", "weather-system").length, 1);
});

test("added references feed the shared #234 semantic collector and orphan analysis", () => {
  const event = entity("World/Event.md", "Event");
  const resolveEntity = mappedResolver({ "[[Event]]": event });
  const plan = planWorldContextAddition({ type: "scene" }, event, resolveEntity);
  const sceneFrontmatter = { type: "scene", world_context: [...plan.values] };
  deepEqual(collectSemanticManuscriptReferences(sceneFrontmatter), [
    { reference: "[[Event]]", reason: "explicit" }
  ]);

  const storyWorldDocument: StoryWorldReviewDocument = {
    path: event.path,
    basename: event.basename,
    frontmatter: event.properties
  };
  const scene: StoryWorldReviewDocument = {
    path: "Books/Scene.md",
    basename: "Scene",
    frontmatter: sceneFrontmatter,
    links: []
  };
  const resolveReview = (reference: string) => resolveEntity(reference)
    ? { path: event.path, indexed: true }
    : null;
  equal(buildStoryWorldReview([storyWorldDocument, scene], [event], resolveReview)
    .observations.some((item) => item.kind === "story-world.entity.orphan"), false);

  const removal = planWorldContextRemoval(sceneFrontmatter, event, resolveEntity);
  const withoutReference = { type: "scene", world_context: [...removal.values] };
  const updatedScene = { ...scene, frontmatter: withoutReference };
  equal(buildStoryWorldReview([storyWorldDocument, updatedScene], [event], resolveReview)
    .observations.some((item) => item.kind === "story-world.entity.orphan"), true);
});

test("the Obsidian adapter mutates only after explicit add/remove and preserves prose and unknown YAML", async () => {
  const event = entity("World/Event.md", "Event");
  const other = entity("World/Other.md", "Other", "reference");
  const frontmatter: Record<string, unknown> = {
    type: "scene",
    pov: "[[Pip]]",
    location: "[[Reserve]]",
    world_context: ["[[Other]]", "[[Unknown]]"],
    custom: { retained: true }
  };
  const prose = "Scene prose with [[Other|display text]].\r\n";
  let writes = 0;
  const app = {
    fileManager: {
      processFrontMatter: async (_scene: unknown, mutate: (value: Record<string, unknown>) => void) => {
        writes += 1;
        mutate(frontmatter);
      }
    }
  };
  const values = mappedResolver({ "[[Event]]": event, "[[Other]]": other });
  const index = {
    index: { getByPath: (pathValue: string) => pathValue === event.path ? event : null },
    resolveWikilink: (reference: string) => values(reference)
  };
  const scene = { path: "Books/Scene.md" };

  equal(writes, 0);
  equal(await addIndexedEntityToWorldContext(app as never, index as never, scene as never, event), true);
  equal(writes, 1);
  deepEqual(frontmatter.world_context, ["[[Other]]", "[[Unknown]]", "[[Event]]"]);
  equal(prose, "Scene prose with [[Other|display text]].\r\n");
  deepEqual(frontmatter.custom, { retained: true });
  equal(frontmatter.pov, "[[Pip]]");
  equal(frontmatter.location, "[[Reserve]]");

  equal(await addIndexedEntityToWorldContext(app as never, index as never, scene as never, event), false);
  equal(await removeIndexedEntityFromWorldContext(app as never, index as never, scene as never, event), true);
  deepEqual(frontmatter.world_context, ["[[Other]]", "[[Unknown]]"]);
});

test("a newly indexed entity becomes addable through the next ordinary index snapshot without polling", async () => {
  const created = entity("World/New Event.md", "New Event");
  const frontmatter: Record<string, unknown> = { type: "scene" };
  let indexed: StoryWorldEntityRecord | null = null;
  const app = {
    fileManager: {
      processFrontMatter: async (_scene: unknown, mutate: (value: Record<string, unknown>) => void) => mutate(frontmatter)
    }
  };
  const index = {
    index: { getByPath: () => indexed },
    resolveWikilink: (reference: string) => reference === "[[New Event]]" ? indexed : null
  };

  await rejects(
    addIndexedEntityToWorldContext(app as never, index as never, { path: "Books/Scene.md" } as never, created),
    /no longer indexed/u
  );
  deepEqual(frontmatter, { type: "scene" });

  indexed = created;
  equal(await addIndexedEntityToWorldContext(
    app as never,
    index as never,
    { path: "Books/Scene.md" } as never,
    created
  ), true);
  deepEqual((frontmatter as Record<string, unknown>).world_context, ["[[New Event]]"]);
});

test("the picker is read-only and the UI exposes removal only for explicit entries", async () => {
  const picker = (await readFile(
    path.join(process.cwd(), "src/companion/WorldContextEntityPickerModal.ts"),
    "utf8"
  )).replace(/\r\n?/gu, "\n");
  const view = (await readFile(
    path.join(process.cwd(), "src/companion/CollapsibleWritingCompanionView.ts"),
    "utf8"
  )).replace(/\r\n?/gu, "\n");
  const renderer = (await readFile(
    path.join(process.cwd(), "src/ui/WorldContext.ts"),
    "utf8"
  )).replace(/\r\n?/gu, "\n");

  equal(/processFrontMatter|vault\.modify|vault\.create/u.test(picker), false);
  match(view, /text: "Add World Context"/u);
  match(view, /entities: this\.plugin\.storyWorldIndex\.index\.getAll\(\)/u);
  match(picker, /cls: "mwc-world-context-picker-primary"/u);
  match(picker, /cls: "mwc-world-context-picker-metadata"/u);
  match(picker, /cls: "mwc-world-context-picker-type"/u);
  match(picker, /cls: "mwc-world-context-picker-path"/u);
  match(renderer, /entry\.reasons\.includes\("explicit"\)/u);
  match(renderer, /Remove .* from explicit World Context/u);
});
