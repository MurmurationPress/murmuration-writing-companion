import { deepEqual, equal, throws } from "node:assert/strict";
import { test } from "node:test";
import {
  applyManuscriptStoryDateOffer,
  manuscriptStoryDateOffer,
  ManuscriptStoryDateOfferSnapshot,
  sameManuscriptStoryDateOffer
} from "../src/manuscript/ManuscriptStoryDateOffer";

const scenes = [
  { path: "Part One/Dated.md", title: "Domestic Distance", frontmatter: { narrative_date: "2029-01-12" } },
  { path: "Part One/Undated.md", title: "Quiet Bridge", frontmatter: {} },
  { path: "Part Two/Target.md", title: "Arrival", frontmatter: { story_day: 42 } }
];

function snapshot(patch: Partial<ManuscriptStoryDateOfferSnapshot> = {}): ManuscriptStoryDateOfferSnapshot {
  const orderedScenes = patch.orderedScenes ?? scenes;
  return {
    activePath: "Part Two/Target.md",
    targetPath: "Part Two/Target.md",
    targetTitle: "Arrival",
    targetParentPath: "Part Two.md",
    targetOrderKey: "000000000C",
    targetPosition: 2,
    targetMtime: 10,
    targetSize: 100,
    targetFrontmatter: { story_day: 42 },
    bookPath: "Book 4.md",
    structurallySafe: true,
    ...patch,
    orderedScenes,
    sourceFileStateByPath: patch.sourceFileStateByPath
      ?? new Map(orderedScenes.map((scene, index) => [scene.path, { mtime: index + 1, size: 100 + index }]))
  };
}

test("reuses authoritative flattened order across Parts and intervening undated Scenes", () => {
  const offer = manuscriptStoryDateOffer(snapshot());
  equal(offer?.sourcePath, "Part One/Dated.md");
  equal(offer?.sourceTitle, "Domestic Distance");
  equal(offer?.property, "narrative_date");
  equal(offer?.value, "2029-01-12");
  equal(offer?.precision, "day");
});

test("eligibility requires an active undated authoritative Scene in safe non-first order", () => {
  equal(manuscriptStoryDateOffer(snapshot({ activePath: "Elsewhere.md" })), null);
  equal(manuscriptStoryDateOffer(snapshot({ structurallySafe: false })), null);
  equal(manuscriptStoryDateOffer(snapshot({ targetPosition: 0 })), null);
  equal(manuscriptStoryDateOffer(snapshot({ targetPosition: 4 })), null);
  equal(manuscriptStoryDateOffer(snapshot({ orderedScenes: [], targetPosition: 0 })), null);
  equal(manuscriptStoryDateOffer(snapshot({ targetFrontmatter: { story_date: "2029-01-13" } })), null);
  equal(manuscriptStoryDateOffer(snapshot({ targetFrontmatter: { storydate: "2029-01" } })), null);
  equal(manuscriptStoryDateOffer(snapshot({ targetFrontmatter: { narrative_date: "tomorrow" } })), null);
  equal(manuscriptStoryDateOffer(snapshot())?.targetPath, "Part Two/Target.md");
});

test("malformed, range and story_day preceding values are ignored", () => {
  const orderedScenes = [
    { path: "Good.md", title: "Good", frontmatter: { story_date: "2028" } },
    { path: "Day.md", title: "Day", frontmatter: { story_day: 4 } },
    { path: "Range.md", title: "Range", frontmatter: { story_date: { shape: "range", from: "2029-01-01", to: "2029-01-02", precision: "day" } } },
    { path: "Bad.md", title: "Bad", frontmatter: { story_date: "soon" } },
    scenes[2]
  ];
  equal(manuscriptStoryDateOffer(snapshot({ orderedScenes, targetPosition: 4 }))?.sourcePath, "Good.md");
  equal(manuscriptStoryDateOffer(snapshot({ orderedScenes: [orderedScenes[1], scenes[2]], targetPosition: 1 })), null);
});

test("acceptance writes one canonical property while preserving unrelated target metadata", () => {
  const frontmatter: Record<string, unknown> = {
    type: "scene", title: "Arrival", parent: "[[Part Two]]", manuscript_order_key: "000000000C",
    storydate: "", pov: "[[Robin]]", world_context: ["[[Prime]]"], custom: { retained: true }
  };
  applyManuscriptStoryDateOffer(frontmatter, "2029-01-12");
  deepEqual(frontmatter, {
    type: "scene", title: "Arrival", parent: "[[Part Two]]", manuscript_order_key: "000000000C",
    story_date: "2029-01-12", pov: "[[Robin]]", world_context: ["[[Prime]]"], custom: { retained: true }
  });
  throws(() => applyManuscriptStoryDateOffer(frontmatter, "2030-01-01"));
});

test("stale review blocks target movement, source changes, deletion and nearer insertion", () => {
  const reviewed = manuscriptStoryDateOffer(snapshot())!;
  equal(sameManuscriptStoryDateOffer(reviewed, manuscriptStoryDateOffer(snapshot())), true);
  equal(sameManuscriptStoryDateOffer(reviewed, manuscriptStoryDateOffer(snapshot({ targetOrderKey: "moved" }))), false);
  equal(sameManuscriptStoryDateOffer(reviewed, manuscriptStoryDateOffer(snapshot({
    orderedScenes: [{ ...scenes[0], frontmatter: { narrative_date: "2029-01-13" } }, scenes[1], scenes[2]]
  }))), false);
  equal(sameManuscriptStoryDateOffer(reviewed, manuscriptStoryDateOffer(snapshot({ orderedScenes: [scenes[1], scenes[2]], targetPosition: 1 }))), false);
  const nearer = { path: "Nearer.md", title: "Nearer", frontmatter: { story_date: "2029-01-11" } };
  equal(sameManuscriptStoryDateOffer(reviewed, manuscriptStoryDateOffer(snapshot({ orderedScenes: [scenes[0], nearer, scenes[2]] }))), false);
  equal(sameManuscriptStoryDateOffer(reviewed, manuscriptStoryDateOffer(snapshot({ targetMtime: 11 }))), false);
  equal(sameManuscriptStoryDateOffer(reviewed, manuscriptStoryDateOffer(snapshot({
    sourceFileStateByPath: new Map(scenes.map((scene, index) => [scene.path, { mtime: index === 0 ? 99 : index + 1, size: 100 + index }]))
  }))), false);
});

test("accepted canonical value has no dependency or cascading state", () => {
  const target: Record<string, unknown> = {};
  applyManuscriptStoryDateOffer(target, "2029-01");
  deepEqual(target, { story_date: "2029-01" });
  const sourceAfterRenameAndRedate = { path: "Renamed.md", story_date: "2031" };
  equal(target.story_date, "2029-01");
  equal(Object.keys(target).some((key) => key.includes("inherit") || key.includes("source")), false);
  equal(sourceAfterRenameAndRedate.story_date, "2031");
});
