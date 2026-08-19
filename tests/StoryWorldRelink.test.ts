import { equal, throws } from "node:assert/strict";
import { test } from "node:test";
import { relinkStoryWorldOccurrence } from "../src/story-world/StoryWorldRelink";

test("relinks only the selected occurrence and preserves display aliases and surrounding prose", () => {
  const markdown = "First [[Robin|the witness]], then [[Robin|the witness]].\r\nCustom YAML stays elsewhere.";
  const start = markdown.lastIndexOf("[[Robin");
  const raw = "[[Robin|the witness]]";
  const changed = relinkStoryWorldOccurrence(markdown, { raw, start, end: start + raw.length }, "Story World/Robin Marsh.md");
  equal(changed, "First [[Robin|the witness]], then [[Story World/Robin Marsh|the witness]].\r\nCustom YAML stays elsewhere.");
});

test("refuses stale or malformed occurrences without changing content", () => {
  const markdown = "See [[Robin]].";
  throws(() => relinkStoryWorldOccurrence(markdown, { raw: "[[Other]]", start: 4, end: 13 }, "World/Robin.md"), /changed after analysis/u);
  throws(() => relinkStoryWorldOccurrence(markdown, { raw: "Robin", start: 6, end: 11 }, "World/Robin.md"), /supported wikilink/u);
});
