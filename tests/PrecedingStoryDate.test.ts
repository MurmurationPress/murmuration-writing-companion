import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { precedingStoryDate } from "../src/manuscript/PrecedingStoryDate";

const scene = (path: string, frontmatter: Record<string, unknown> = {}) => ({ path, title: path.replace(/\.md$/, ""), frontmatter });

test("finds the nearest preceding supported date across Parts and undated Scenes", () => {
  const scenes = [scene("Earlier Part/Opening.md", { story_date: "2033-04-12" }), scene("FEVER/Undated.md")];
  deepEqual(precedingStoryDate(scenes, 2), {
    sourcePath: "Earlier Part/Opening.md", sourceTitle: "Earlier Part/Opening", sourcePosition: 0, property: "story_date",
    raw: "2033-04-12", value: "2033-04-12", precision: "day"
  });
});

test("recognises legacy aliases but never story_day", () => {
  equal(precedingStoryDate([scene("A.md", { story_day: 1017 })], 1), null);
  equal(precedingStoryDate([scene("A.md", { narrative_date: "2033-04" })], 1)?.property, "narrative_date");
  equal(precedingStoryDate([scene("A.md", { storydate: "2033" })], 1)?.precision, "year");
});

test("ignores malformed, unsupported and range-shaped values", () => {
  const scenes = [
    scene("Good.md", { story_date: "2032-01-01" }),
    scene("Range.md", { story_date: { shape: "range", from: "2033-01-01", to: "2033-01-02", precision: "day" } }),
    scene("Bad.md", { story_date: "tomorrow" }),
    scene("Unsupported.md", { story_date: ["2033-01-01"] })
  ];
  equal(precedingStoryDate(scenes, 4)?.sourcePath, "Good.md");
  equal(precedingStoryDate(scenes, 0), null);
});

test("preserves supported point precision and canonical source", () => {
  const proposal = precedingStoryDate([scene("A.md", { story_date: "2033-04-12T09:30+01:00" })], 1);
  equal(proposal?.value, "2033-04-12T09:30+01:00");
  equal(proposal?.precision, "minute");
});
