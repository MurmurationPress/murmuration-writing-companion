import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import {
  parseStoryWorldEntity,
  parseWikilink,
  StoryWorldDocument,
  StoryWorldIndex
} from "../src/story-world/StoryWorldIndex";

function document(
  path: string,
  frontmatter: Record<string, unknown> | null | undefined,
  basename = path.split("/").pop()?.replace(/\.md$/i, "") ?? path
): StoryWorldDocument {
  return { path, basename, frontmatter };
}

test("discovers only explicitly opted-in Story World notes", () => {
  const index = new StoryWorldIndex();

  index.rebuild([
    document("World/Tobias.md", {
      world_entity: "character",
      world_name: "Tobias Hale"
    }),
    document("World/Notes.md", {
      title: "Ordinary planning note",
      type: "character"
    }),
    document("World/Empty.md", {
      world_entity: "   "
    })
  ]);

  equal(index.size, 1);
  equal(index.getByPath("World/Tobias.md")?.name, "Tobias Hale");
  equal(index.getByPath("World/Notes.md"), null);
  deepEqual(index.findByType("character").map((entity) => entity.path), [
    "World/Tobias.md"
  ]);
});

test("indexes names, aliases, type and common permissive properties", () => {
  const aliases = ["Persistent Recurrence in Machine Ecology", " Prime ", ""];
  const frontmatter: Record<string, unknown> = {
    world_entity: "adaptive-intelligence",
    world_facets: ["character", "distributed-system", "character"],
    world_name: "PRIME",
    aliases,
    world_scope: ["[[PRIME Trilogy]]", "series"],
    world_status: "confirmed",
    world_summary: "Distributed adaptive intelligence.",
    world_first_appearance: "[[The Router]]",
    world_sources: ["[[The Router]]", "[[The Article]]"],
    world_designations: [
      {
        name: "PA-01",
        assigned_by: "[[JANUS]]",
        source: "[[JANUS Monitoring]]"
      }
    ],
    world_custom_detail: {
      interpreted_by: "[[Pip]]"
    },
    custom_non_world_property: "preserved"
  };

  const index = new StoryWorldIndex();
  index.upsert(document("World/PRIME.md", frontmatter));
  const prime = index.getByPath("World/PRIME.md");

  ok(prime);
  equal(prime.entityType, "adaptive-intelligence");
  deepEqual(prime.facets, ["character", "distributed-system"]);
  deepEqual(prime.aliases, [
    "Persistent Recurrence in Machine Ecology",
    "Prime"
  ]);
  deepEqual(prime.scope, ["[[PRIME Trilogy]]", "series"]);
  equal(prime.status, "confirmed");
  equal(prime.summary, "Distributed adaptive intelligence.");
  equal(prime.firstAppearance, "[[The Router]]");
  deepEqual(prime.sources, ["[[The Router]]", "[[The Article]]"]);
  deepEqual([...prime.links].sort(), [
    "[[JANUS Monitoring]]",
    "[[JANUS]]",
    "[[PRIME Trilogy]]",
    "[[Pip]]",
    "[[The Article]]",
    "[[The Router]]"
  ].sort());
  equal(prime.properties.custom_non_world_property, "preserved");
  deepEqual(index.findByNameOrAlias("prime").map((entity) => entity.path), [
    "World/PRIME.md"
  ]);
  deepEqual(
    index.findByNameOrAlias("Persistent Recurrence in Machine Ecology")
      .map((entity) => entity.path),
    ["World/PRIME.md"]
  );

  frontmatter.world_name = "Changed externally";
  aliases.push("Changed alias");
  equal(prime.name, "PRIME");
  deepEqual(prime.aliases, [
    "Persistent Recurrence in Machine Ecology",
    "Prime"
  ]);
});

test("malformed optional properties fail softly without rejecting the entity", () => {
  const parsed = parseStoryWorldEntity(document("World/Tobias.md", {
    world_entity: "character",
    world_name: { unsupported: true },
    title: "Tobias Hale",
    aliases: [42, "Tobias", null, ""],
    world_facets: { unsupported: true },
    world_scope: ["[[EMERGENCE]]", 2026],
    world_status: ["confirmed"],
    world_summary: false,
    world_sources: ["[[Quiet Load]]", { unsupported: true }]
  }));

  ok(parsed);
  equal(parsed.name, "Tobias Hale");
  deepEqual(parsed.aliases, ["Tobias"]);
  deepEqual(parsed.facets, []);
  deepEqual(parsed.scope, ["[[EMERGENCE]]"]);
  equal(parsed.status, null);
  equal(parsed.summary, null);
  deepEqual(parsed.sources, ["[[Quiet Load]]"]);
});

test("unknown entity types remain valid and indexable", () => {
  const index = new StoryWorldIndex();
  index.upsert(document("World/Shared Layer.md", {
    world_entity: "emergent-ecology",
    world_name: "Shared Layer",
    world_unrecognised_property: {
      retained: true
    }
  }));

  const entity = index.getByPath("World/Shared Layer.md");
  ok(entity);
  equal(entity.entityType, "emergent-ecology");
  deepEqual(entity.properties.world_unrecognised_property, { retained: true });
  deepEqual(index.findByType("emergent-ecology").map((item) => item.path), [
    "World/Shared Layer.md"
  ]);
});

test("duplicate names and aliases remain distinguishable by path and scope", () => {
  const index = new StoryWorldIndex();
  index.rebuild([
    document("World/Book One/Robin.md", {
      world_entity: "character",
      world_name: "Robin",
      aliases: "Bird",
      world_scope: "[[EMERGENCE]]"
    }),
    document("World/Book Two/Robin.md", {
      world_entity: "concept",
      world_name: "Robin",
      aliases: "Bird",
      world_scope: "[[PLURALITY]]"
    })
  ]);

  const byName = index.findByNameOrAlias("Robin");
  deepEqual(byName.map((entity) => entity.path), [
    "World/Book One/Robin.md",
    "World/Book Two/Robin.md"
  ]);
  deepEqual(byName.map((entity) => entity.scope), [
    ["[[EMERGENCE]]"],
    ["[[PLURALITY]]"]
  ]);
  equal(index.findByNameOrAlias("Bird").length, 2);
});

test("metadata updates replace secondary name and type indexes cleanly", () => {
  const index = new StoryWorldIndex();
  index.upsert(document("World/Tobias.md", {
    world_entity: "character",
    world_name: "Tobias",
    aliases: "Tobias Hale"
  }));

  index.upsert(document("World/Tobias.md", {
    world_entity: "observer",
    world_name: "Tobias Hale",
    aliases: "Tobias"
  }));

  equal(index.findByType("character").length, 0);
  deepEqual(index.findByType("observer").map((entity) => entity.path), [
    "World/Tobias.md"
  ]);
  equal(index.findByNameOrAlias("Tobias Hale").length, 1);
  equal(index.findByNameOrAlias("Tobias").length, 1);
});

test("rename removes the old path and retains the entity under the new path", () => {
  const index = new StoryWorldIndex();
  index.upsert(document("World/Tobias.md", {
    world_entity: "character",
    world_name: "Tobias Hale"
  }));

  equal(index.rename(
    "World/Tobias.md",
    document("World/Characters/Tobias Hale.md", {
      world_entity: "character",
      world_name: "Tobias Hale"
    })
  ), true);

  equal(index.getByPath("World/Tobias.md"), null);
  equal(index.getByPath("World/Characters/Tobias Hale.md")?.name, "Tobias Hale");
  deepEqual(index.findByNameOrAlias("Tobias Hale").map((entity) => entity.path), [
    "World/Characters/Tobias Hale.md"
  ]);
});

test("delete and recreation update the derived index without retained storage", () => {
  const index = new StoryWorldIndex();
  const path = "World/JANUS.md";

  index.upsert(document(path, {
    world_entity: "intelligence",
    world_name: "JANUS"
  }));
  equal(index.remove(path), true);
  equal(index.size, 0);

  index.upsert(document(path, {
    world_entity: "system",
    world_name: "JANUS",
    world_status: "planned"
  }));

  equal(index.size, 1);
  equal(index.getByPath(path)?.entityType, "system");
  equal(index.getByPath(path)?.status, "planned");
});

test("rebuild reconstructs the index and removes stale entities", () => {
  const index = new StoryWorldIndex();
  index.rebuild([
    document("World/Old.md", {
      world_entity: "concept",
      world_name: "Old model"
    })
  ]);

  equal(index.rebuild([
    document("World/PRIME.md", {
      world_entity: "intelligence",
      world_name: "PRIME"
    }),
    document("Notes/Unrelated.md", {
      title: "Not part of the Story World"
    })
  ]), true);

  equal(index.getByPath("World/Old.md"), null);
  equal(index.getByPath("World/PRIME.md")?.name, "PRIME");
  equal(index.size, 1);

  equal(index.rebuild([
    document("World/PRIME.md", {
      world_entity: "intelligence",
      world_name: "PRIME"
    })
  ]), false);
});

test("parses ordinary, display and path-qualified wikilinks", () => {
  deepEqual(parseWikilink("[[Tobias Hale]]"), {
    linkpath: "Tobias Hale",
    displayText: null
  });
  deepEqual(parseWikilink("[[Characters/Tobias Hale|Tobias]]"), {
    linkpath: "Characters/Tobias Hale",
    displayText: "Tobias"
  });
  deepEqual(parseWikilink("[[PRIME#Public naming|PRIME]]"), {
    linkpath: "PRIME",
    displayText: "PRIME"
  });
  deepEqual(parseWikilink("[[Concepts/A\\|B|A|B]]"), {
    linkpath: "Concepts/A\\|B",
    displayText: "A|B"
  });
  equal(parseWikilink("Tobias Hale"), null);
  equal(parseWikilink("[[]]"), null);
});
