import { deepEqual, equal, match } from "node:assert/strict";
import { test } from "node:test";
import { evenlySpacedManuscriptOrderKeys, manuscriptOrderKeyBetween } from "../src/manuscript/ManuscriptOrderKey";
import {
  manuscriptPartDefaultFolder,
  manuscriptPartPlacements,
  ManuscriptPartCreationSnapshot,
  planManuscriptPartCreation,
  revalidateManuscriptPartPlan,
  serializeManuscriptPart
} from "../src/manuscript/ManuscriptPartCreation";

const bookPath = "Books/BOOK 4.md";
const keys = evenlySpacedManuscriptOrderKeys(3);
const child = (path: string, title: string, kind: "part" | "scene", key: string) => ({ path, title, kind, parentPath: bookPath, orderKey: key });
const children = [
  child("Books/BOOK 4/Prologue.md", "Prologue", "scene", keys[0]),
  child("Books/BOOK 4/ABSENCE.md", "ABSENCE", "part", keys[1]),
  child("Books/BOOK 4/Finale.md", "Finale", "scene", keys[2])
];

function snapshot(overrides: Partial<ManuscriptPartCreationSnapshot> = {}): ManuscriptPartCreationSnapshot {
  return {
    selectedBookPath: bookPath,
    selectionRevision: 4,
    book: { path: bookPath, title: "Book 4", source: "distributed", diagnostics: [] },
    directChildren: children,
    parts: [{ path: children[1].path, title: children[1].title, bookPath }],
    entries: [{ path: "Books", kind: "folder" }, { path: "Books/BOOK 4", kind: "folder" }],
    associatedBookFolder: "Books/BOOK 4",
    ...overrides
  };
}

const input = { title: "FEVER", path: "Books/BOOK 4/FEVER.md", placementId: `after:${children[0].path}` };

test("serializes the exact minimal Part contract with path-qualified parent and quoted key", () => {
  equal(serializeManuscriptPart("FEVER", bookPath, "000000000A"),
    "---\ntype: part\ntitle: \"FEVER\"\nparent: \"[[Books/BOOK 4]]\"\nmanuscript_order_key: \"000000000A\"\n---\n");
});

test("offers one readable option per unique direct-child boundary", () => {
  deepEqual(manuscriptPartPlacements(children).map((placement) => placement.label), [
    "At beginning — before Prologue — Scene",
    "After Prologue — Scene",
    "After ABSENCE — Part",
    "At end — after Finale — Scene"
  ]);
  equal(manuscriptPartPlacements([])[0].label, "At beginning — Book is empty");
});

test("plans empty, beginning, middle and final keys with the existing allocator", () => {
  const empty = snapshot({ book: { path: bookPath, title: "Book 4", source: "none", diagnostics: [] }, directChildren: [], parts: [] });
  equal(planManuscriptPartCreation(empty, { ...input, placementId: "start" }).orderKey, manuscriptOrderKeyBetween(null, null));
  equal(planManuscriptPartCreation(snapshot(), { ...input, placementId: "start" }).orderKey, manuscriptOrderKeyBetween(null, keys[0]));
  equal(planManuscriptPartCreation(snapshot(), input).orderKey, manuscriptOrderKeyBetween(keys[0], keys[1]));
  equal(planManuscriptPartCreation(snapshot(), { ...input, placementId: `after:${children[2].path}` }).orderKey, manuscriptOrderKeyBetween(keys[2], null));
});

test("preserves mixed direct children and changes no sibling key", () => {
  const before = JSON.stringify(children);
  const plan = planManuscriptPartCreation(snapshot(), input);
  equal(plan.errors.length, 0);
  equal(JSON.stringify(children), before);
  equal(plan.previous?.path, children[0].path);
  equal(plan.next?.path, children[1].path);
});

test("planning is deterministic and preview bytes contain its exact key", () => {
  const first = planManuscriptPartCreation(snapshot(), input);
  const second = planManuscriptPartCreation(snapshot(), input);
  equal(first.orderKey, second.orderKey);
  match(first.markdown, new RegExp(`manuscript_order_key: "${first.orderKey}"`));
});

test("blocks malformed, duplicate and exhausted direct-child keys", () => {
  const malformed = snapshot({ directChildren: [child("Books/X.md", "X", "scene", "bad")] });
  match(planManuscriptPartCreation(malformed, { ...input, placementId: "start" }).errors.join(" "), /safe direct-child/);
  const duplicate = snapshot({ directChildren: [child("Books/X.md", "X", "scene", keys[0]), child("Books/Y.md", "Y", "part", keys[0])] });
  match(planManuscriptPartCreation(duplicate, { ...input, placementId: "start" }).errors.join(" "), /share manuscript_order_key/);
  const exhausted = snapshot({ directChildren: [child("Books/X.md", "X", "scene", "000000000A"), child("Books/Y.md", "Y", "part", "000000000B")] });
  match(planManuscriptPartCreation(exhausted, { ...input, placementId: "after:Books/X.md" }).errors.join(" "), /No order-key space/);
});

test("blocks legacy and unsafe structures while allowing an empty none source", () => {
  match(planManuscriptPartCreation(snapshot({ book: { path: bookPath, title: "Book 4", source: "legacy", diagnostics: [] } }), input).errors.join(" "), /Prepare or reconcile/);
  match(planManuscriptPartCreation(snapshot({ book: { path: bookPath, title: "Book 4", source: "distributed", diagnostics: [{ kind: "obsolete_order_array", message: "mixed" }] } }), input).errors.join(" "), /structural notices/);
  const empty = snapshot({ book: { path: bookPath, title: "Book 4", source: "none", diagnostics: [] }, directChildren: [], parts: [] });
  equal(planManuscriptPartCreation(empty, { ...input, placementId: "start" }).errors.length, 0);
});

test("blocks duplicate Part titles only inside the selected Book", () => {
  match(planManuscriptPartCreation(snapshot({ parts: [{ path: "Books/P.md", title: " fever ", bookPath }] }), input).errors.join(" "), /already exists/);
  equal(planManuscriptPartCreation(snapshot({ parts: [{ path: "Other/P.md", title: "FEVER", bookPath: "Other/Book.md" }] }), input).errors.length, 0);
});

test("reuses path safety while allowing the same basename elsewhere", () => {
  equal(planManuscriptPartCreation(snapshot({ entries: [{ path: "Archive/FEVER.md", kind: "file" }] }), input).errors.length, 0);
  match(planManuscriptPartCreation(snapshot({ entries: [{ path: "books/book 4/fever.MD", kind: "file" }] }), input).errors.join(" "), /already exists/);
  match(planManuscriptPartCreation(snapshot(), { ...input, path: "Books/../FEVER.md" }).errors.join(" "), /traversal/);
});

test("default location is a proposal using Parts, association, children, then Book parent", () => {
  equal(manuscriptPartDefaultFolder(snapshot()), "Books/BOOK 4");
  equal(manuscriptPartDefaultFolder(snapshot({ parts: [], associatedBookFolder: null })), "Books/BOOK 4");
  equal(manuscriptPartDefaultFolder(snapshot({ parts: [], associatedBookFolder: null, directChildren: [] })), "Books");
});

test("stale validation is boundary-specific", () => {
  const preview = planManuscriptPartCreation(snapshot(), input);
  const unrelated = child("Books/BOOK 4/Later.md", "Later", "scene", manuscriptOrderKeyBetween(keys[2], null)!);
  const safeChange = snapshot({ directChildren: [...children, unrelated] });
  equal(revalidateManuscriptPartPlan(preview, safeChange).errors.length, 0);

  const changedBoundary = snapshot({ directChildren: [children[0], unrelated, children[1], children[2]] });
  match(revalidateManuscriptPartPlan(preview, changedBoundary).errors.join(" "), /boundary changed/);
});

test("stale validation catches selected Book and neighbour-key changes", () => {
  const preview = planManuscriptPartCreation(snapshot(), input);
  match(revalidateManuscriptPartPlan(preview, snapshot({ selectedBookPath: "Other.md", book: null })).errors.join(" "), /selected Book changed/);
  const changed = [...children];
  changed[0] = { ...changed[0], orderKey: manuscriptOrderKeyBetween(null, keys[0])! };
  match(revalidateManuscriptPartPlan(preview, snapshot({ directChildren: changed })).errors.join(" "), /boundary changed/);
});
