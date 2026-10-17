import { deepEqual, equal, ok, rejects } from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { projectAnnotationBoard } from "../src/companion/AnnotationBoardProjection";
import { buildManuscriptOrder, ManuscriptDocumentRecord } from "../src/manuscript/ManuscriptOrder";
import type { Annotation, EditorialStore } from "../src/editorial/EditorialNote";

const entry = (path: string, kind: "book" | "part" | "scene", parentPath: string | null, orderKey: string): ManuscriptDocumentRecord =>
  ({ path, kind, parentPath, orderKey, orderKeyPresent: true, title: path, basename: path, bookPath: "Book.md" });
const annotation = (id: string, line = 1, category = "Editorial", status: "open" | "resolved" = "open"): Annotation =>
  ({ id, body: `Synthetic ${id}`, anchor: { text: "Repeated extract", line }, category, status, created: "2026-01-01", updated: "2026-01-01" });
function fixture() {
  const book = entry("Book.md", "book", null, "0000000001");
  const direct = entry("Direct.md", "scene", book.path, "0000000001");
  const part = entry("Part.md", "part", book.path, "0000000002");
  const child = entry("Child.md", "scene", part.path, "0000000001");
  const last = entry("Last.md", "scene", book.path, "0000000003");
  const entries = [child, last, part, direct];
  const result = buildManuscriptOrder(book, undefined, entries, () => null);
  const store: EditorialStore = { pages: {} };
  const put = (path: string, annotations: Annotation[]) => { store.pages[path] = { chapterNote: { body: "", created: "", updated: "" }, annotations }; };
  put(direct.path, [annotation("late", 8), annotation("early", 2), annotation("resolved", 3, "Canon", "resolved")]);
  put(child.path, [annotation("part", 1, "Continuity")]);
  put(last.path, [annotation("legacy", 1, "Legacy category")]);
  put("Other Book.md", [annotation("unrelated")]);
  put("Deleted.md", [annotation("deleted")]); store.pages["Deleted.md"].deletedAt = "2026-01-01";
  return { book: { record: book, result }, store, put, direct, child };
}

test("Book isolation and mixed direct/Part ordering follow the authoritative tree, never file or category sort", () => {
  const { book, store } = fixture();
  const result = projectAnnotationBoard(book, store);
  deepEqual(result.cards.map(card => card.annotation.id), ["early", "late", "part", "legacy"]);
  equal(result.cards[2].part, "Part.md"); equal(result.cards[0].part, null);
  ok(result.categories.includes("Legacy category"));
  equal(Object.keys(store.pages).length, 5); // Read-only; no synthetic pages.
});

test("source position and stable IDs deterministically order ties, including legacy and stale snapshots", () => {
  const { book, store, put } = fixture();
  const a = annotation("a", 5), b = annotation("b", 5), c = annotation("c", 5), missing = annotation("missing");
  delete missing.anchor.line;
  a.anchor.range = { from: 20, to: 30, sourceSha256: "old", basis: "markdown-body-v1" };
  b.anchor.range = { from: 10, to: 15, sourceSha256: "new", basis: "markdown-body-v1" };
  put("Direct.md", [missing, c, a, b]);
  deepEqual(projectAnnotationBoard(book, store).cards.filter(card => card.path === "Direct.md").map(card => card.annotation.id), ["b", "a", "c", "missing"]);
  put("Direct.md", [annotation("z", 1), annotation("a", 1)]);
  deepEqual(projectAnnotationBoard(book, store).cards.slice(0, 2).map(card => card.annotation.id), ["a", "z"]);
});

test("Part, chapter, category and resolved filters compose with honest empty states", () => {
  const { book, store } = fixture();
  equal(projectAnnotationBoard(book, store, { part: "Part.md" }).cards.length, 1);
  equal(projectAnnotationBoard(book, store, { chapter: "Direct.md" }).cards.length, 2);
  equal(projectAnnotationBoard(book, store, { category: "Canon" }).cards.length, 0);
  const resolved = projectAnnotationBoard(book, store, { category: "Canon", showResolved: true });
  equal(resolved.cards[0].annotation.id, "resolved"); equal(resolved.total, 5);
  equal(projectAnnotationBoard(book, store, { part: "Part.md", chapter: "Direct.md" }).cards.length, 0);
});

test("external lifecycle, category, membership, order and deletion changes use current authority", () => {
  const { book, store } = fixture();
  store.pages["Direct.md"].annotations[0].status = "resolved";
  store.pages["Child.md"].annotations[0].category = "Pace";
  equal(projectAnnotationBoard(book, store).cards.length, 3);
  equal(projectAnnotationBoard(book, store, { category: "Pace" }).cards[0].path, "Child.md");
  const moved = { ...book, result: { ...book.result, roots: [...book.result.roots].reverse() } };
  equal(projectAnnotationBoard(moved, store).cards[0].path, "Last.md");
  const detached = { ...book, result: { ...book.result, roots: book.result.roots.filter(node => node.entry.path !== "Direct.md") } };
  ok(projectAnnotationBoard(detached, store).cards.every(card => card.path !== "Direct.md"));
  equal(store.pages["Direct.md"].annotations.length, 3);
  store.pages["Child.md"].deletedAt = "now";
  equal(projectAnnotationBoard(book, store, { part: "Part.md" }).cards.length, 0);
});

async function moduleFrom(path: string) {
  const { build } = createRequire(import.meta.url)("esbuild") as typeof import("esbuild");
  const result = await build({ entryPoints: [path], bundle: true, platform: "node", format: "cjs", external: ["obsidian"], write: false });
  const module = { exports: {} as any };
  class TFile { path = "Direct.md"; }
  class MarkdownView {}
  const obsidian = new Proxy({ TFile, MarkdownView }, { get: (target, name) => target[name as keyof typeof target] ?? class {} });
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: () => obsidian, crypto: globalThis.crypto });
  return { exports: module.exports, TFile, MarkdownView };
}

test("existing update operation rolls back failed body/category/status saves; retry retains identity and exact anchor; counts follow lifecycle", async () => {
  const { exports, TFile } = await moduleFrom("src/editorial/EditorialStore.ts");
  const file = new TFile(), current = annotation("stable");
  const anchor = current.anchor;
  let fail = true, events = 0, counts = 0;
  const host = { annotationUpdates: Promise.resolve(), store: { pages: { [file.path]: { annotations: [current] } } },
    plugin: { app: { vault: { getAbstractFileByPath: () => file } } },
    save: async () => { if (fail) throw Error("disk unavailable"); },
    syncOpenAnnotationProperty: async (_: unknown, page: { annotations: Annotation[] }) => { counts = page.annotations.filter(a => a.status === "open").length; },
    onChange: () => { events++; } };
  const update = (patch: Partial<Annotation>) => exports.EditorialStoreService.prototype.updateAnnotation.call(host, file, current, patch);
  await rejects(update({ category: "Pace", body: "edit", status: "resolved" }), /disk unavailable/);
  equal(current.category, "Editorial"); equal(current.status, "open"); equal(current.body, "Synthetic stable"); equal(events, 0);
  fail = false;
  await update({ category: "Pace", body: "edit" }); equal(current.category, "Pace"); equal(counts, 1);
  await update({ status: "resolved" }); equal(counts, 0);
  await update({ status: "open" }); equal(counts, 1);
  equal(current.anchor, anchor); equal(current.id, "stable"); equal(events, 3);
  // Reject deleted/replaced records rather than mutating a detached object.
  host.store.pages[file.path].annotations = [];
  await rejects(update({ body: "wrong" }), /no longer available/);
});

test("concurrent failed updates cannot roll back a later successful update", async () => {
  const { exports, TFile } = await moduleFrom("src/editorial/EditorialStore.ts");
  const file = new TFile(), current = annotation("stable"); let saves = 0;
  const host = { annotationUpdates: Promise.resolve(), store: { pages: { [file.path]: { annotations: [current] } } },
    plugin: { app: { vault: { getAbstractFileByPath: () => file } } },
    save: async () => { if (++saves === 1) throw Error("first failed"); }, syncOpenAnnotationProperty: async () => {}, onChange: () => {} };
  const update = (patch: Partial<Annotation>) => exports.EditorialStoreService.prototype.updateAnnotation.call(host, file, current, patch);
  const first = update({ category: "Pace" }), second = update({ body: "second" });
  await rejects(first); await second;
  equal(current.category, "Editorial"); equal(current.body, "second");
});

test("board navigation passes the original file/annotation to the existing navigation operation and rejects removed members", async () => {
  const { exports, TFile } = await moduleFrom("src/companion/AnnotationBoardView.ts");
  const { book, store } = fixture(); const file = new TFile();
  const card = projectAnnotationBoard(book, store).cards[0]; let navigated = 0;
  const owner = { file: { path: "Book.md" }, filesByPath: new Map([[file.path, file]]) };
  const host = { manuscriptProjection: { get: () => ({ books: [owner] }) }, storeService: { store },
    app: { vault: { getAbstractFileByPath: () => file } }, navigateToAnnotation: async (note: unknown, a: Annotation) => {
      equal(note, file); equal(a, card.annotation); navigated++;
    } };
  const board = { host, current: exports.AnnotationBoard.prototype.current };
  await exports.AnnotationBoard.prototype.navigate.call(board, "Book.md", card); equal(navigated, 1);
  owner.filesByPath.clear();
  await exports.AnnotationBoard.prototype.navigate.call(board, "Book.md", card); equal(navigated, 1);
});


test("navigation from an editorial tab preserves Reading mode and never selects or edits manuscript text", async () => {
  const { exports, TFile, MarkdownView } = await moduleFrom("src/main.ts");
  const file = new TFile(); let reveals = 0, active = 0;
  const view = Object.assign(new MarkdownView(), { file, getMode: () => "preview", contentEl: {}, containerEl: {},
    editor: { setSelection: () => { throw Error("Reading view must not touch editor"); } } });
  const leaf = { view, openFile: async (note: unknown, options: any) => { equal(note, file); equal(options.state.mode, "preview"); } };
  const host = { readingNavigationGeneration: 0, annotationLocator: { clear: () => {} },
    app: { workspace: { iterateAllLeaves: (visit: any) => visit(leaf), getMostRecentLeaf: () => ({ view: { containerEl: {} } }),
      getLeavesOfType: () => [leaf], revealLeaf: async (target: unknown) => { equal(target, leaf); },
      setActiveLeaf: () => { active++; } }, vault: { read: async () => "passage" } },
    findChapterLeaf: () => leaf, readingAnnotationCapture: { reveal: () => { reveals++; return true; } } };
  await exports.default.prototype.navigateToAnnotation.call(host, file, { ...annotation("reading"), anchor: { text: "passage", line: 1 } }, leaf);
  equal(reveals, 1); equal(active, 1); equal(view.getMode(), "preview");
});

test("activation derives Book from actual Book/Part/Scene context and opens a picker for tools, never a stale getActiveFile", async () => {
  const { exports, MarkdownView } = await moduleFrom("src/companion/AnnotationBoardView.ts");
  let picked = 0; const states: any[] = [];
  const leaf = { setViewState: async (state: any) => { states.push(state); } };
  const workspace = { activeLeaf: { view: { getViewType: () => "tool" } as any },
    getMostRecentLeaf: () => null, getActiveFile: () => { throw Error("stale file must not be consulted"); },
    getLeavesOfType: () => [], getLeaf: () => leaf, revealLeaf: async () => {} };
  const host = { app: { workspace }, manuscriptProjection: { get: () => ({
    books: [{ file: { path: "Book.md" } }], owningBookPathByFile: new Map([["Part.md", "Book.md"], ["Scene.md", "Book.md"]])
  }) } };
  const board = { host, disposed: false, pick: () => { picked++; } };
  await exports.AnnotationBoard.prototype.openOnce.call(board); equal(picked, 1); equal(states.length, 0);
  for (const path of ["Book.md", "Part.md", "Scene.md"]) {
    workspace.activeLeaf.view = Object.assign(new MarkdownView(), { getViewType: () => "markdown", file: { path } });
    await exports.AnnotationBoard.prototype.openOnce.call(board);
    equal(states.at(-1).state.bookPath, "Book.md");
  }
});
