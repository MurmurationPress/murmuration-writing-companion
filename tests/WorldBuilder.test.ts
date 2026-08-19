import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  filterStoryWorldBuilderItems,
  groupStoryWorldBuilderItems,
  parseStoryWorldBuilderItem,
  projectStoryWorldBuilderGroups,
  storyWorldCustomCategoryLabel,
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

test("groups recognised entity types semantically in stable category order", () => {
  const items = storyWorldBuilderItems([
    { path: "A.md", basename: "A", frontmatter: { world_entity: "character" } },
    { path: "I.md", basename: "I", frontmatter: { world_entity: "intelligence" } },
    { path: "P.md", basename: "P", frontmatter: { world_entity: "pov-profile" } },
    { path: "L.md", basename: "L", frontmatter: { world_entity: "location" } },
    { path: "O.md", basename: "O", frontmatter: { world_entity: "organization" } },
    { path: "E.md", basename: "E", frontmatter: { world_entity: "event" } },
    { path: "T.md", basename: "T", frontmatter: { world_entity: "technology" } },
    { path: "K.md", basename: "K", frontmatter: { world_entity: "concept" } },
    { path: "R.md", basename: "R", frontmatter: { world_entity: "Reference" } },
    { path: "C.md", basename: "C", frontmatter: { world_model: "continuity" } }
  ]);
  const groups = groupStoryWorldBuilderItems(items);
  deepEqual(groups.map((group) => [group.label, group.items.map((item) => item.type)]), [
    ["Characters", ["character"]],
    ["Intelligences", ["intelligence"]],
    ["POV Profiles", ["pov-profile"]],
    ["Locations", ["location"]],
    ["Organisations", ["organization"]],
    ["Events", ["event"]],
    ["Technologies", ["technology"]],
    ["Concepts", ["concept"]],
    ["References", ["Reference"]],
    ["Supporting models", ["continuity"]]
  ]);
});

test("keeps custom entity types visible in deterministic human-readable categories", () => {
  const groups = groupStoryWorldBuilderItems(storyWorldBuilderItems([
    { path: "Storm/B.md", basename: "B", frontmatter: { world_entity: "weather-system", world_name: "Zephyr" } },
    { path: "Elsewhere/A.md", basename: "A", frontmatter: { world_entity: "weather_system", world_name: "Aurora" } },
    { path: "Dialect.md", basename: "Dialect", frontmatter: { world_entity: "dialect" } }
  ]));
  deepEqual(groups.map((group) => [group.key, group.label, group.items.map((item) => item.name)]), [
    ["custom:dialect", "Dialects", ["Dialect"]],
    ["custom:weather-system", "Weather Systems", ["Aurora", "Zephyr"]]
  ]);
  equal(storyWorldCustomCategoryLabel("weather-system"), "Weather Systems");
});

test("semantic categories and entity order are independent of physical folders", () => {
  const before = storyWorldBuilderItems([
    { path: "Story World/Characters/Z.md", basename: "Z", frontmatter: { world_entity: "character", world_name: "Pip" } },
    { path: "Archive/A.md", basename: "A", frontmatter: { world_entity: "character", world_name: "Eleanor" } }
  ]);
  const moved = storyWorldBuilderItems([
    { path: "Anywhere/Z.md", basename: "Z", frontmatter: { world_entity: "character", world_name: "Pip" } },
    { path: "Story World/POV Profiles/A.md", basename: "A", frontmatter: { world_entity: "character", world_name: "Eleanor" } }
  ]);
  deepEqual(groupStoryWorldBuilderItems(before).map((group) => [group.label, group.items.map((item) => item.name)]),
    groupStoryWorldBuilderItems(moved).map((group) => [group.label, group.items.map((item) => item.name)]));
});

test("omits empty categories", () => {
  const groups = groupStoryWorldBuilderItems(storyWorldBuilderItems([
    { path: "Pip.md", basename: "Pip", frontmatter: { world_entity: "character" } }
  ]));
  deepEqual(groups.map((group) => group.label), ["Characters"]);
});

test("search reveals matching collapsed categories without changing saved state", () => {
  const items = storyWorldBuilderItems([
    { path: "Pip.md", basename: "Pip", frontmatter: { world_entity: "character", world_name: "Pip" } },
    { path: "Janus.md", basename: "Janus", frontmatter: { world_entity: "intelligence", world_name: "JANUS" } }
  ]);
  const collapsed = new Set(["intelligences"]);
  deepEqual(projectStoryWorldBuilderGroups(items, "jan", collapsed).map((group) => [group.label, group.collapsed]), [
    ["Intelligences", false]
  ]);
  deepEqual([...collapsed], ["intelligences"]);
  deepEqual(projectStoryWorldBuilderGroups(items, "", collapsed).map((group) => [group.label, group.collapsed]), [
    ["Characters", false], ["Intelligences", true]
  ]);
});

test("tree projection does not mutate entity records, ordering, properties or collapse state", () => {
  const items = storyWorldBuilderItems([
    { path: "B.md", basename: "B", frontmatter: { world_entity: "location", world_name: "B", custom: { untouched: true } } },
    { path: "A.md", basename: "A", frontmatter: { world_entity: "location", world_name: "A" } }
  ]);
  const collapsed = new Set(["locations"]);
  const before = JSON.stringify(items);
  projectStoryWorldBuilderGroups(items, "b", collapsed);
  equal(JSON.stringify(items), before);
  deepEqual([...collapsed], ["locations"]);
});

test("unrelated index additions retain collapse projection for existing categories", () => {
  const collapsed = new Set(["characters"]);
  const initial = storyWorldBuilderItems([
    { path: "Pip.md", basename: "Pip", frontmatter: { world_entity: "character" } }
  ]);
  const refreshed = storyWorldBuilderItems([
    { path: "Pip.md", basename: "Pip", frontmatter: { world_entity: "character" } },
    { path: "London.md", basename: "London", frontmatter: { world_entity: "location" } }
  ]);
  equal(projectStoryWorldBuilderGroups(initial, "", collapsed)[0]?.collapsed, true);
  equal(projectStoryWorldBuilderGroups(refreshed, "", collapsed)[0]?.collapsed, true);
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

test("orders dated events oldest first and leaves undated events last", () => {
  const items = storyWorldBuilderItems([
    { path: "Later.md", basename: "Later", frontmatter: { world_entity: "event", world_name: "Later", world_time: { at: "2029-01-01" } } },
    { path: "Undated.md", basename: "Undated", frontmatter: { world_entity: "event", world_name: "Undated" } },
    { path: "Earlier.md", basename: "Earlier", frontmatter: { world_entity: "event", world_name: "Earlier", world_time: { at: "2026-04-03" } } }
  ]);
  const events = groupStoryWorldBuilderItems(items).find((group) => group.key === "events");
  deepEqual(events?.items.map((item) => item.name), ["Earlier", "Later", "Undated"]);
});

test("preserves chronological ordering in filtered event results", () => {
  const items = storyWorldBuilderItems([
    { path: "B.md", basename: "B", frontmatter: { world_entity: "event", world_name: "Network Event B", world_time: { at: "2028-01-01" } } },
    { path: "A.md", basename: "A", frontmatter: { world_entity: "event", world_name: "Network Event A", world_time: { at: "2026-01-01" } } }
  ]);
  deepEqual(filterStoryWorldBuilderItems(items, "network").map((item) => item.name), ["Network Event A", "Network Event B"]);
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
