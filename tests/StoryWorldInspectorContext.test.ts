import { equal } from "node:assert/strict";
import { test } from "node:test";
import { reconcileStoryWorldInspectorPath } from "../src/story-world/StoryWorldInspectorContext";

test("retains the selected entity when sidebar interaction leaves no active Markdown view", () => {
  equal(
    reconcileStoryWorldInspectorPath("Story World/Characters/Pip.md", null),
    "Story World/Characters/Pip.md"
  );
});

test("tracks a genuinely opened Story World entity Markdown note", () => {
  equal(
    reconcileStoryWorldInspectorPath("Story World/Characters/Pip.md", {
      path: "Story World/Locations/Enfield.md",
      isStoryWorldItem: true
    }),
    "Story World/Locations/Enfield.md"
  );
});

test("clears entity inspector context when another ordinary Markdown note is opened", () => {
  equal(
    reconcileStoryWorldInspectorPath("Story World/Characters/Pip.md", {
      path: "Books/PRIME/Chapter 1.md",
      isStoryWorldItem: false
    }),
    null
  );
});
