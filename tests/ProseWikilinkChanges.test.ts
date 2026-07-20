import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  findProseWikilinks,
  ProseWikilinkChangeTracker,
  selectChangedProseWikilink
} from "../src/companion/ProseWikilinkChanges";

test("finds ordinary alias and path-qualified prose wikilinks", () => {
  const links = findProseWikilinks(
    "After [[The Failure]], Tobias remembered [[Events/First Contact|contact]]."
  );
  deepEqual(links.map((link) => ({
    raw: link.raw,
    linkpath: link.linkpath,
    displayText: link.displayText
  })), [
    { raw: "[[The Failure]]", linkpath: "The Failure", displayText: null },
    {
      raw: "[[Events/First Contact|contact]]",
      linkpath: "Events/First Contact",
      displayText: "contact"
    }
  ]);
});

test("excludes frontmatter code comments embeds and escaped links", () => {
  const text = [
    "---",
    "world_context: [[Frontmatter Event]]",
    "---",
    "Visible [[Real Event]].",
    "`[[Inline Code]]`",
    "```md",
    "[[Fenced Code]]",
    "```",
    "<!-- [[HTML Comment]] -->",
    "%% [[Obsidian Comment]] %%",
    "![[Embedded Event]]",
    "\\[[Escaped Event]]"
  ].join("\n");

  deepEqual(findProseWikilinks(text).map((link) => link.raw), ["[[Real Event]]"]);
});

test("does not treat existing links as newly authored when tracking begins", () => {
  const tracker = new ProseWikilinkChangeTracker();
  tracker.seed("Scene.md", "Existing [[Old Event]].");
  equal(tracker.update("Scene.md", "Existing [[Old Event]]. More prose.", 34), null);
});

test("detects a newly completed wikilink at the cursor", () => {
  const previous = "The alarm became [[The Failure]";
  const current = "The alarm became [[The Failure]]";
  const selected = selectChangedProseWikilink(previous, current, current.length);
  equal(selected?.raw, "[[The Failure]]");
});

test("detects a materially edited wikilink but ignores edits elsewhere", () => {
  const changed = selectChangedProseWikilink(
    "Before [[The Failur]].",
    "Before [[The Failure]].",
    21
  );
  equal(changed?.linkpath, "The Failure");

  equal(selectChangedProseWikilink(
    "Before [[The Failure]].",
    "Before [[The Failure]]. Later.",
    30
  ), null);
});
