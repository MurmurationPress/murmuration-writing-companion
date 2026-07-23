import { equal, match } from "node:assert/strict";
import { test } from "node:test";
import { evenlySpacedManuscriptOrderKeys, manuscriptOrderKeyBetween } from "../src/manuscript/ManuscriptOrderKey";
import {
  defaultManuscriptSceneParent,
  manuscriptSceneDefaultFolder,
  manuscriptScenePlacements,
  ManuscriptSceneCreationSnapshot,
  planManuscriptSceneCreation,
  revalidateManuscriptScenePlan,
  serializeManuscriptScene
} from "../src/manuscript/ManuscriptSceneCreation";

const bookPath = "Books/BOOK 4.md";
const partPath = "Books/BOOK 4/FEVER.md";
const otherPartPath = "Books/BOOK 4/AFTER.md";
const keys = evenlySpacedManuscriptOrderKeys(3);

function snapshot(overrides: Partial<ManuscriptSceneCreationSnapshot> = {}): ManuscriptSceneCreationSnapshot {
  return {
    selectedBookPath: bookPath, selectionRevision: 7, contextPath: partPath,
    book: { path: bookPath, title: "Book 4", source: "distributed", diagnostics: [], associatedFolder: "Books/BOOK 4" },
    parents: [
      { path: bookPath, title: "Book 4", kind: "book", associatedFolder: "Books/BOOK 4" },
      { path: partPath, title: "FEVER", kind: "part", associatedFolder: "Books/BOOK 4/FEVER" },
      { path: otherPartPath, title: "AFTER", kind: "part", associatedFolder: null }
    ],
    orderedEntries: [
      { path: "Books/Prologue.md", title: "Prologue", kind: "scene", parentPath: bookPath, orderKey: keys[0] },
      { path: partPath, title: "FEVER", kind: "part", parentPath: bookPath, orderKey: keys[1] },
      { path: "Books/BOOK 4/FEVER/Opening.md", title: "Opening", kind: "scene", parentPath: partPath, orderKey: keys[0] },
      { path: otherPartPath, title: "AFTER", kind: "part", parentPath: bookPath, orderKey: keys[2] }
    ],
    orderedScenes: [
      { path: "Books/Prologue.md", title: "Prologue", frontmatter: { story_date: "2033-04-12" } },
      { path: "Books/BOOK 4/FEVER/Opening.md", title: "Opening", frontmatter: undefined }
    ],
    entries: [{ path: "Books", kind: "folder" }, { path: "Books/BOOK 4", kind: "folder" }],
    ...overrides
  };
}

const input = { title: "First Light", path: "Books/BOOK 4/FEVER/First Light.md", parentPath: partPath, placementId: "start", acceptDate: false };

test("defaults to selected Part context and falls back to Book for Scene context", () => {
  equal(defaultManuscriptSceneParent(snapshot()), partPath);
  equal(defaultManuscriptSceneParent(snapshot({ contextPath: "Books/Prologue.md" })), bookPath);
});

test("allows another recognised Part in the Book but rejects stale and cross-Book parents", () => {
  equal(planManuscriptSceneCreation(snapshot(), { ...input, parentPath: otherPartPath }).errors.length, 0);
  match(planManuscriptSceneCreation(snapshot(), { ...input, parentPath: "Other/Part.md" }).errors.join(" "), /no longer recognised/);
  match(planManuscriptSceneCreation(snapshot({ contextPath: "Missing.md" }), input).errors.join(" "), /context is stale/);
});

test("uses mixed direct Book children and only direct Scenes under a Part", () => {
  equal(manuscriptScenePlacements(snapshot(), bookPath).map((item) => item.label).join("|"),
    "At beginning — before Prologue — Scene|After Prologue — Scene|After FEVER — Part|At end — after AFTER — Part");
  equal(manuscriptScenePlacements(snapshot(), partPath).length, 2);
});

test("plans empty, beginning, middle and end keys deterministically", () => {
  const emptyBook = snapshot({ book: { path: bookPath, title: "Book 4", source: "none", diagnostics: [], associatedFolder: null }, parents: [{ path: bookPath, title: "Book 4", kind: "book", associatedFolder: null }], orderedEntries: [], orderedScenes: [], contextPath: bookPath });
  equal(planManuscriptSceneCreation(emptyBook, { ...input, parentPath: bookPath }).orderKey, manuscriptOrderKeyBetween(null, null));
  equal(planManuscriptSceneCreation(snapshot(), input).orderKey, manuscriptOrderKeyBetween(null, keys[0]));
  equal(planManuscriptSceneCreation(snapshot(), { ...input, placementId: "after:Books/BOOK 4/FEVER/Opening.md" }).orderKey, manuscriptOrderKeyBetween(keys[0], null));
  const first = planManuscriptSceneCreation(snapshot(), input);
  equal(first.orderKey, planManuscriptSceneCreation(snapshot(), input).orderKey);
});

test("serializes the exact minimal contract and accepted canonical date", () => {
  equal(serializeManuscriptScene("First Light", partPath, "000000000A", null),
    "---\ntype: scene\ntitle: \"First Light\"\nparent: \"[[Books/BOOK 4/FEVER]]\"\nmanuscript_order_key: \"000000000A\"\n---\n");
  equal(serializeManuscriptScene("First Light", partPath, "000000000A", "2033-04-12"),
    "---\ntype: scene\ntitle: \"First Light\"\nparent: \"[[Books/BOOK 4/FEVER]]\"\nmanuscript_order_key: \"000000000A\"\nstory_date: 2033-04-12\n---\n");
});

test("round-trips validated temporal precision through the exact YAML scalar", () => {
  for (const value of ["2033", "2033-04", "2033-04-12", "2033-04-12T09", "2033-04-12T09:30+01:00"]) {
    const markdown = serializeManuscriptScene("First Light", partPath, "000000000A", value);
    const scalar = /^story_date: (.+)$/m.exec(markdown)?.[1] ?? "";
    equal(scalar, value);
  }
  let rejected = false;
  try { serializeManuscriptScene("First Light", partPath, "000000000A", "tomorrow"); } catch { rejected = true; }
  equal(rejected, true);
});

test("date proposal is unchecked, omitted when declined and included only after acceptance", () => {
  const declined = planManuscriptSceneCreation(snapshot(), input);
  equal(declined.dateProposal?.sourcePath, "Books/Prologue.md");
  equal(declined.acceptDate, false); equal(declined.markdown.includes("story_date"), false);
  const accepted = planManuscriptSceneCreation(snapshot(), { ...input, acceptDate: true });
  match(accepted.markdown, /story_date: 2033-04-12/);
});

test("computes Book-wide hypothetical position across an earlier Part", () => {
  const plan = planManuscriptSceneCreation(snapshot(), input);
  equal(plan.globalPosition, 1);
  equal(plan.dateProposal?.sourcePath, "Books/Prologue.md");
});

test("blocks duplicate title only beneath the same parent and keeps siblings immutable", () => {
  const before = JSON.stringify(snapshot().orderedEntries);
  match(planManuscriptSceneCreation(snapshot(), { ...input, title: " opening " }).errors.join(" "), /already exists/);
  equal(planManuscriptSceneCreation(snapshot(), { ...input, parentPath: otherPartPath, title: "Opening" }).errors.length, 0);
  equal(JSON.stringify(snapshot().orderedEntries), before);
});

test("blocks malformed, duplicate, exhausted, legacy and unsafe structures", () => {
  const malformed = snapshot({ orderedEntries: [{ path: partPath, title: "FEVER", kind: "part", parentPath: bookPath, orderKey: "bad" }] });
  match(planManuscriptSceneCreation(malformed, { ...input, parentPath: bookPath }).errors.join(" "), /safe direct-child/);
  const exhaustedChildren = [
    { path: "Books/A.md", title: "A", kind: "scene" as const, parentPath: bookPath, orderKey: "000000000A" },
    { path: "Books/B.md", title: "B", kind: "scene" as const, parentPath: bookPath, orderKey: "000000000B" }
  ];
  match(planManuscriptSceneCreation(snapshot({ orderedEntries: exhaustedChildren, contextPath: bookPath }), { ...input, parentPath: bookPath, placementId: "after:Books/A.md" }).errors.join(" "), /No order-key space/);
  match(planManuscriptSceneCreation(snapshot({ book: { path: bookPath, title: "Book 4", source: "legacy", diagnostics: [], associatedFolder: null } }), input).errors.join(" "), /Prepare or reconcile/);
  match(planManuscriptSceneCreation(snapshot({ book: { path: bookPath, title: "Book 4", source: "distributed", diagnostics: [{ kind: "duplicate_order_key", message: "unsafe" }], associatedFolder: null } }), input).errors.join(" "), /structural notices/);
});

test("reuses path collision rules and deterministic default folders", () => {
  match(planManuscriptSceneCreation(snapshot({ entries: [{ path: "books/book 4/fever/first light.MD", kind: "file" }] }), input).errors.join(" "), /already exists/);
  match(planManuscriptSceneCreation(snapshot(), { ...input, path: "Books/../First.md" }).errors.join(" "), /traversal/);
  equal(manuscriptSceneDefaultFolder(snapshot(), partPath), "Books/BOOK 4/FEVER");
});

test("stale validation is boundary- and accepted-date-specific", () => {
  const preview = planManuscriptSceneCreation(snapshot(), { ...input, acceptDate: true });
  const moved = snapshot({ orderedEntries: snapshot().orderedEntries.filter((entry) => entry.path !== "Books/Prologue.md") });
  match(revalidateManuscriptScenePlan(preview, moved).errors.join(" "), /boundary changed|story date changed/);
  const redated = snapshot({ orderedScenes: [{ path: "Books/Prologue.md", title: "Prologue", frontmatter: { story_date: "2033-04-13" } }, snapshot().orderedScenes[1]] });
  match(revalidateManuscriptScenePlan(preview, redated).errors.join(" "), /story date changed/);
  const movedSource = snapshot({ orderedScenes: [snapshot().orderedScenes[1], snapshot().orderedScenes[0]] });
  match(revalidateManuscriptScenePlan(preview, movedSource).errors.join(" "), /story date changed/);
  const unrelated = snapshot({ entries: [...snapshot().entries, { path: "Archive/Note.md", kind: "file" }] });
  equal(revalidateManuscriptScenePlan(preview, unrelated).errors.length, 0);
});
