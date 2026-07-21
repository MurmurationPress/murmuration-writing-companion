import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  filterStoryWorldBuilderItems,
  groupStoryWorldBuilderItems,
  parseStoryWorldBuilderItem,
  storyWorldBuilderItems
} from "../src/story-world/WorldBuilder";

test("includes only explicit entities and supporting models", () => {
  const items = storyWorldBuilderItems([
    { path: "Pip.md", basename: "Pip", frontmatter: { world_entity: "character", world_name: "Pip" } },
    { path: "Timeline.md", basename: "Timeline", frontmatter: { world_model: "timeline", title: "Book timeline" } },
    { path: "Ordinary.md", basename: "Ordinary", frontmatter: { title: "Ordinary" } }
  ]);
  deepEqual(items.map((item) => [item.kind, item.name]), [
    ["model", "Book timeline"],
    ["entity", "Pip"]
  ]);
});

test("groups known types, unknown entities and models without changing type values", () => {
  const items = storyWorldBuilderItems([
    { path: "A.md", basename: "A", frontmatter: { world_entity: "character" } },
    { path: "B.md", basename: "B", frontmatter: { world_entity: "weather-system" } },
    { path: "C.md", basename: "C", frontmatter: { world_model: "continuity" } }
  ]);
  const groups = groupStoryWorldBuilderItems(items);
  deepEqual(groups.map((group) => [group.label, group.items.map((item) => item.type)]), [
    ["Characters", ["character"]],
    ["Other entities", ["weather-system"]],
    ["Supporting models", ["continuity"]]
  ]);
});

test("searches canonical names, aliases and filenames", () => {
  const items = storyWorldBuilderItems([
    {
      path: "Story World/Tobias.md",
      basename: "Tobias",
      frontmatter: { world_entity: "character", world_name: "Tobias Hale", aliases: ["Tobias"] }
    }
  ]);
  equal(filterStoryWorldBuilderItems(items, "hale").length, 1);
  equal(filterStoryWorldBuilderItems(items, "tobias").length, 1);
  equal(filterStoryWorldBuilderItems(items, "pip").length, 0);
});

test("preserves structured inspector values", () => {
  const item = parseStoryWorldBuilderItem({
    path: "Event.md",
    basename: "Event",
    frontmatter: {
      world_entity: "event",
      world_name: "The Event",
      world_scope: ["[[PLURALITY]]"],
      world_status: "confirmed",
      world_time: { at: "2029-06-28", precision: "day" },
      custom_property: "preserved"
    }
  });
  equal(item?.type, "event");
  deepEqual(item?.scope, ["[[PLURALITY]]"]);
  equal(item?.properties.custom_property, "preserved");
});
