import { deepEqual, equal, ok, rejects, throws } from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { projectAnnotationBoard, annotationBoardDragCard } from "../src/companion/AnnotationBoardProjection";
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
  const host = Object.assign(Object.create(exports.EditorialStoreService.prototype), { ready: true, saves: Promise.resolve(), annotationUpdates: Promise.resolve(), store: { pages: { [file.path]: { annotations: [current] } } },
    plugin: { app: { vault: { getAbstractFileByPath: () => file } } },
    portableStorage: { save: async () => { if (fail) throw Error("disk unavailable"); } },
    syncOpenAnnotationProperty: async (_: unknown, page: { annotations: Annotation[] }) => { counts = page.annotations.filter(a => a.status === "open").length; },
    onChange: () => { events++; } });
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
  const host = Object.assign(Object.create(exports.EditorialStoreService.prototype), { ready: true, saves: Promise.resolve(), annotationUpdates: Promise.resolve(), store: { pages: { [file.path]: { annotations: [current] } } },
    plugin: { app: { vault: { getAbstractFileByPath: () => file } } },
    portableStorage: { save: async () => { if (++saves === 1) throw Error("first failed"); } }, syncOpenAnnotationProperty: async () => {}, onChange: () => {} });
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

test("duplicate and missing legacy IDs remain visible with distinct stable keys, and empty categories are filterable", () => {
  const { book, store, put } = fixture();
  put("Direct.md", [annotation("duplicate"), annotation("duplicate"), annotation(""), annotation("blank", 1, "")]);
  const first = projectAnnotationBoard(book, store), second = projectAnnotationBoard(book, store);
  equal(new Set(first.cards.map(card => card.key)).size, first.cards.length);
  deepEqual(first.cards.map(card => card.key), second.cards.map(card => card.key));
  equal(first.cards.filter(card => card.identityProblem).length, 3);
  deepEqual(projectAnnotationBoard(book, store, { category: "" }).cards.map(card => card.annotation.id), ["blank"]);
});

test("queued board updates validate immutable revision and membership at the actual write boundary", async () => {
  const { exports: storage, TFile } = await moduleFrom("src/editorial/EditorialStore.ts");
  const { exports: ui } = await moduleFrom("src/companion/AnnotationBoardView.ts");
  const { book, store } = fixture(), file = new TFile();
  const card = projectAnnotationBoard(book, store).cards[0];
  const service = Object.assign(Object.create(storage.EditorialStoreService.prototype), {
    ready: true, saves: Promise.resolve(), annotationUpdates: Promise.resolve(), store,
    plugin: { app: { vault: { getAbstractFileByPath: () => file } } },
    portableStorage: { save: async () => {} }, syncOpenAnnotationProperty: async () => {}, onChange: () => {}
  });
  // Use current() as a narrow membership boundary; the real method is covered by navigation tests.
  const board = { settled: async () => {}, host: { storeService: service },
    current: () => ({ file, annotation: card.annotation }) };
  let release!: () => void;
  service.annotationUpdates = new Promise<void>(resolve => { release = resolve; });
  const newer = service.updateAnnotation(file, card.annotation, { body: "newer body" });
  const stale = ui.AnnotationBoard.prototype.update.call(board, "Book.md", card, { body: "stale draft", category: "Pace" });
  release(); await newer; await rejects(stale, /changed elsewhere/);
  equal(card.annotation.body, "newer body"); equal(card.annotation.category, "Editorial");
  // An ordinary failed-write retry also retains its original revision.
  await rejects(ui.AnnotationBoard.prototype.update.call(board, "Book.md", card, { category: "Canon" }), /changed elsewhere/);
});

test("failed annotation candidates are never visible to another save, while successful candidates publish before subsequent snapshots", async () => {
  const { exports, TFile } = await moduleFrom("src/editorial/EditorialStore.ts");
  const file = new TFile(), current = annotation("stable");
  const page = { annotations: [current], chapterNote: { body: "old" } };
  let release!: () => void, entered!: () => void, fail = true;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  let writes = 0, durable: any;
  const host = Object.assign(Object.create(exports.EditorialStoreService.prototype), {
    ready: true, saves: Promise.resolve(), annotationUpdates: Promise.resolve(), store: { pages: { [file.path]: page } },
    plugin: { app: { vault: { getAbstractFileByPath: () => file } } },
    portableStorage: { save: async (candidate: unknown) => {
      const snapshot = JSON.parse(JSON.stringify(candidate));
      if (++writes === 1) { entered(); await gate; if (fail) throw Error("failed candidate"); }
      durable = snapshot;
    } }, syncOpenAnnotationProperty: async () => {}, onChange: () => {}
  });
  const update = host.updateAnnotation(file, current, { body: "uncommitted candidate" });
  await started;
  equal(current.body, "Synthetic stable");
  page.chapterNote.body = "separate chapter edit";
  const separate = host.save(); release(); await rejects(update, /failed candidate/); await separate;
  equal(durable.pages[file.path].annotations[0].body, "Synthetic stable");
  equal(durable.pages[file.path].chapterNote.body, "separate chapter edit");
  fail = false;
  const success = host.updateAnnotation(file, current, { body: "committed" }); await success;
  await host.save(); equal(durable.pages[file.path].annotations[0].body, "committed");
});

test("shared chapter updates use record identity rather than the first matching legacy ID, and reject replaced objects", async () => {
  const { exports, TFile } = await moduleFrom("src/editorial/EditorialStore.ts");
  const file = new TFile(), first = annotation("same"), second = annotation("same");
  const page = { annotations: [first, second] };
  const host = Object.assign(Object.create(exports.EditorialStoreService.prototype), {
    ready: true, saves: Promise.resolve(), annotationUpdates: Promise.resolve(), store: { pages: { [file.path]: page } },
    plugin: { app: { vault: { getAbstractFileByPath: () => file } } },
    portableStorage: { save: async () => {} }, syncOpenAnnotationProperty: async () => {}, onChange: () => {}
  });
  await host.updateAnnotation(file, second, { body: "second only" });
  equal(first.body, "Synthetic same"); equal(second.body, "second only");
  page.annotations = [{ ...second }];
  await rejects(host.updateAnnotation(file, second, { body: "detached" }), /no longer available/);
});

test("derived-count retry reads current authority without replaying an earlier lifecycle patch", async () => {
  const { exports, TFile } = await moduleFrom("src/editorial/EditorialStore.ts");
  const file = new TFile(), current = annotation("stable"); let failCount = true, count = -1;
  const host = Object.assign(Object.create(exports.EditorialStoreService.prototype), {
    ready: true, saves: Promise.resolve(), annotationUpdates: Promise.resolve(), store: { pages: { [file.path]: { annotations: [current] } } },
    plugin: { app: { vault: { getAbstractFileByPath: () => file } } }, portableStorage: { save: async () => {} },
    syncOpenAnnotationProperty: async () => { if (failCount) throw Error("count failure"); count = current.status === "open" ? 1 : 0; }, onChange: () => {}
  });
  await rejects(host.updateAnnotation(file, current, { status: "resolved" }), /Annotation saved/);
  equal(current.status, "resolved"); failCount = false;
  await host.updateAnnotation(file, current, { status: "open" });
  await host.retryAnnotationCount(file);
  equal(count, 1); equal(current.status, "open");
});


test("drag snapshots reject changed annotations and foreign boards without selecting a different record", () => {
  const { book, store } = fixture();
  const card = projectAnnotationBoard(book, store).cards[0];
  const data = JSON.stringify({ scope: "this board", key: card.key, revision: card.revision });
  equal(annotationBoardDragCard(data, "this board", [card]), card);
  equal(annotationBoardDragCard(data, "different board", [card]), null);
  equal(annotationBoardDragCard("invalid data", "this board", [card]), null);
  store.pages[card.path].annotations.find(a => a.id === card.annotation.id)!.category = "Pace";
  throws(() => annotationBoardDragCard(data, "this board", projectAnnotationBoard(book, store).cards), /changed while dragging/);
  throws(() => annotationBoardDragCard(data, "this board", []), /changed while dragging/);
});

test("popout navigation chooses a manuscript pane owned by the board window instead of a remembered main pane", async () => {
  const { exports } = await moduleFrom("src/companion/AnnotationBoardView.ts");
  const mainDocument = {}, popoutDocument = {};
  const main = { view: { containerEl: { ownerDocument: mainDocument } } };
  const popout = { view: { containerEl: { ownerDocument: popoutDocument } } };
  const note = annotation("owned"); let destination: unknown;
  const board = { manuscriptLeaf: main, current: () => ({ file: {}, annotation: note }),
    host: { app: { workspace: { getLeavesOfType: () => [main, popout] } },
      navigateToAnnotation: async (_file: unknown, _annotation: unknown, leaf: unknown) => { destination = leaf; } } };
  await exports.AnnotationBoard.prototype.navigate.call(board, "Book.md", {}, popoutDocument);
  equal(destination, popout);
});

test("window close and plugin unload discard remembered panes; queued updates check view availability", async () => {
  const { exports } = await moduleFrom("src/companion/AnnotationBoardView.ts");
  const callbacks = new Map<string, (...args: any[]) => void>(), cleanup: (() => void)[] = [];
  const host = { registerView: () => {}, addCommand: () => {}, registerEvent: () => {}, register: (fn: () => void) => cleanup.push(fn),
    app: { workspace: { on: (event: string, fn: (...args: any[]) => void) => callbacks.set(event, fn), getLeavesOfType: () => [] } } };
  const board = new exports.AnnotationBoard(host);
  const doc = {}; board.manuscriptLeaf = { view: { containerEl: { ownerDocument: doc } } };
  callbacks.get("window-close")!({}, { document: doc }); equal(board.manuscriptLeaf, null);
  board.manuscriptLeaf = {}; cleanup[0](); equal(board.manuscriptLeaf, null);
  const current = annotation("closed");
  const queued = { settled: async () => {}, current: () => ({ file: {}, annotation: current }),
    host: { storeService: { updateAnnotation: async (_file: unknown, _note: unknown, _patch: unknown, validate: () => void) => validate() } } };
  await rejects(exports.AnnotationBoard.prototype.update.call(queued, "Book.md", { annotation: current }, {}, () => { throw Error("view closed"); }), /view closed/);
});
