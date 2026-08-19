import { deepEqual, equal, notEqual } from "node:assert/strict";
import { test } from "node:test";
import {
  createStoryWorldCategoryPreferenceKey,
  parseStoryWorldCategoryState,
  StoryWorldCategoryPreferences,
  StoryWorldCategoryPreferenceStorage
} from "../src/story-world/StoryWorldCategoryPreferences";

class MemoryStorage implements StoryWorldCategoryPreferenceStorage {
  readonly values = new Map<string, string>();
  writes = 0;
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.writes += 1; this.values.set(key, value); }
}

class ThrowingStorage implements StoryWorldCategoryPreferenceStorage {
  getItem(): string | null { throw new Error("unavailable"); }
  setItem(): void { throw new Error("unavailable"); }
}

test("persists categories independently and restores open-world keys", () => {
  const storage = new MemoryStorage();
  const preferences = new StoryWorldCategoryPreferences(storage, "categories");
  equal(preferences.setCollapsed("characters", true), true);
  equal(preferences.setCollapsed("custom:weather-system", true), true);
  equal(preferences.setCollapsed("characters", true), false);
  equal(storage.writes, 2);
  deepEqual([...preferences.snapshot()].sort(), ["characters", "custom:weather-system"]);
  const reloaded = new StoryWorldCategoryPreferences(storage, "categories");
  equal(reloaded.isCollapsed("characters"), true);
  equal(reloaded.isCollapsed("custom:weather-system"), true);
  equal(reloaded.isCollapsed("locations"), false);
});

test("expansion removes only the selected category", () => {
  const storage = new MemoryStorage();
  storage.values.set("categories", JSON.stringify({ version: 1, collapsed: ["characters", "locations"] }));
  const preferences = new StoryWorldCategoryPreferences(storage, "categories");
  equal(preferences.setCollapsed("characters", false), true);
  deepEqual([...preferences.snapshot()], ["locations"]);
});

test("malformed, old and unavailable storage degrades to in-memory state", () => {
  deepEqual([...parseStoryWorldCategoryState("{ malformed")], []);
  deepEqual([...parseStoryWorldCategoryState(JSON.stringify({ version: 2, collapsed: ["characters"] }))], []);
  const preferences = new StoryWorldCategoryPreferences(new ThrowingStorage(), "categories");
  equal(preferences.setCollapsed("pov-profiles", true), true);
  equal(preferences.isCollapsed("pov-profiles"), true);
});

test("preference keys are stable and isolated by vault identity", () => {
  const first = createStoryWorldCategoryPreferenceKey("mwc", "Prime", "app://local/Prime");
  equal(first, createStoryWorldCategoryPreferenceKey("mwc", "Prime", "app://local/Prime"));
  notEqual(first, createStoryWorldCategoryPreferenceKey("mwc", "Prime", "app://local/Other"));
});
