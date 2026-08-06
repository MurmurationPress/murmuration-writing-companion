import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "node:test";
import { planWorldSourceAddition } from "../src/companion/StoryWorldSourceAuthoring";

const resolve = (linkpath: string): string | null => ({
  "Scene 1": "Books/Part/Scene 1.md",
  "Books/Part/Scene 1": "Books/Part/Scene 1.md",
  "Opening": "Books/Part/Scene 1.md",
  "Reference": "Research/Reference.md"
} as Record<string, string>)[linkpath] ?? null;

test("adds exactly one canonical source and preserves existing provenance", () => {
  const plan = planWorldSourceAddition(["[[Reference]]"], "Books/Part/Scene 1.md", "[[Scene 1]]", resolve);
  equal(plan.changed, true);
  deepEqual(plan.values, ["[[Reference]]", "[[Scene 1]]"]);
});

test("resolved paths and aliases prevent duplicate sources", () => {
  for (const current of ["[[Scene 1]]", ["[[Books/Part/Scene 1]]"], ["[[Opening|The opening scene]]"]]) {
    const plan = planWorldSourceAddition(current, "Books/Part/Scene 1.md", "[[Scene 1]]", resolve);
    equal(plan.changed, false);
  }
});

test("declining is represented by not planning and malformed authority blocks safely", () => {
  throws(() => planWorldSourceAddition({ bad: true }, "Books/Part/Scene 1.md", "[[Scene 1]]", resolve), /not a string or list/);
});
