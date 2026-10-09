import { deepEqual, equal, match, ok, rejects } from "node:assert/strict";
import { test } from "node:test";
import { File, preparationHarness } from "./helpers/ManuscriptPreparationHarness";

const supportPaths = ["Contents", "Import Guide", "Conversion Report"].map(name => `The-Structure-of-Aikido/${name}.md`);

for (const typed of [true, false]) {
  test(`actual registered command prepares ${typed ? "typed" : "untyped"} Aikido root/folder: 6 Parts, 40 Scenes, exact Undo`, async () => {
    const h = preparationHarness(typed);
    const originals = new Map(h.contents);
    const operation = h.invoke();
    await h.choose(typed ? h.fixture.root : "The-Structure-of-Aikido");
    const inclusion = h.latest().contentEl;
    match(inclusion.textContent(), /Parent: The-Structure-of-Aikido\/00 Front Matter.md/);
    match(inclusion.textContent(), /Sibling position: 1/);
    for (const path of supportPaths) {
      const control = inclusion.all().find(el => el.attr["aria-label"] === `Include ${path}`)!;
      equal(control.checked, false);
    }
    equal(h.writes(), 0);
    await h.click("Review structural changes");
    match(h.latest().contentEl.textContent(), /6 Parts and 40 Scenes/);
    equal(h.writes(), 0);
    await h.click("Prepare manuscript");
    await operation;
    const library = h.api.buildObsidianManuscriptLibrary(h.app);
    equal(library.books.length, 1);
    const book = library.books[0];
    equal(book.result.source, "distributed"); equal(book.result.diagnostics.length, 0);
    equal(book.result.entries.filter((entry: any) => entry.kind === "part").length, 6);
    equal(book.result.scenes.length, 40);
    for (const path of supportPaths) { equal(h.cache.get(path)?.frontmatter?.type, "scene-draft"); equal(h.cache.get(path)?.frontmatter?.manuscript_order_key, undefined); }
    for (const [path, original] of originals) {
      const prepared = h.contents.get(path)!;
      equal(prepared.replace(/^---\s*\n[\s\S]*?\n---\n/, ""), original.replace(/^---\s*\n[\s\S]*?\n---\n/, ""));
      const fm = h.cache.get(path)?.frontmatter;
      for (const property of ["title", "author", "order", "source_pdf", "source_pdf_pages", "document_role"]) {
        const before = JSON.parse(original.split("---")[1] || "{}")[property];
        if (before !== undefined) deepEqual(fm?.[property], before);
      }
      equal(fm?.book_scene_number, undefined); equal(fm?.series_scene_number, undefined); equal(fm?.manuscript_sequence, undefined);
    }
    const writes = h.writes();
    const second = h.invoke(); await h.choose(); await h.click("Review structural changes"); await second;
    equal(h.writes(), writes); match(h.notices.join("\n"), /already uses distributed/);
    await h.invoke("undo-manuscript-preparation"); await h.tick();
    deepEqual(h.contents, originals);
  });

  test(`preview and both cancellation stages write nothing (${typed ? "typed" : "untyped"})`, async () => {
    const h = preparationHarness(typed); const original = new Map(h.contents);
    const first = h.invoke(); await h.choose(); await h.click("Cancel"); await first;
    const second = h.invoke(); await h.choose(); await h.click("Review structural changes"); await h.click("Cancel"); await second;
    equal(h.writes(), 0); deepEqual(h.contents, original);
  });
}

test("vault-root slash resolves sibling companion folder; nested roots and inside-folder notes still work", () => {
  const h = preparationHarness();
  const root = h.loaded.get(h.fixture.root);
  equal(h.api.expectedAssociatedManuscriptFolderPath(root), "The-Structure-of-Aikido");
  const book = h.api.buildObsidianManuscriptLibrary(h.app).books[0];
  equal(book.result.source, "legacy"); equal(book.result.scenes.length, 43); // Legacy recognition is unchanged before review.
  equal(h.api.associatedManuscriptFolderPath(h.app, root), "The-Structure-of-Aikido");
  const nested = h.add("The-Structure-of-Aikido/00 Front Matter/00 Front Matter.md", {});
  equal(h.api.expectedAssociatedManuscriptFolderPath(nested), "The-Structure-of-Aikido/00 Front Matter");
});

test("untyped inclusion controls can select support notes and exclude a scene through the shared opt-out", async () => {
  const h = preparationHarness(false); const original = new Map(h.contents);
  const scenePath = h.fixture.notes.find(note => note.frontmatter.type === "scene")!.path;
  const operation = h.invoke(); await h.choose();
  for (const [path, included] of [[supportPaths[0], true], [scenePath, false]] as const) {
    const control = h.latest().contentEl.all().find(el => el.attr["aria-label"] === `Include ${path}`)!;
    equal(control.disabled, false); control.checked = included; control.onchange!();
  }
  await h.click("Review structural changes"); await h.click("Prepare manuscript"); await operation;
  const book = h.api.buildObsidianManuscriptLibrary(h.app).books[0];
  equal(book.result.scenes.length, 40);
  ok(book.result.scenes.some((scene: any) => scene.path === supportPaths[0]));
  ok(!book.result.scenes.some((scene: any) => scene.path === scenePath));
  equal(h.cache.get(scenePath)?.frontmatter?.type, "scene-draft");
  equal(h.contents.get(scenePath)!.replace(/^---\s*\n[\s\S]*?\n---\n/, ""), original.get(scenePath)!.replace(/^---\s*\n[\s\S]*?\n---\n/, ""));
});

test("untyped mixed direct Scenes and Parts retain independent natural sibling order", () => {
  const h = preparationHarness(false);
  h.add("The-Structure-of-Aikido/10 Direct Scene.md"); h.add("The-Structure-of-Aikido/7 Direct Scene.md");
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const roots = book.result.roots.map((node: any) => node.entry.basename);
  ok(roots.indexOf("7 Direct Scene") < roots.indexOf("10 Direct Scene"));
  equal(book.result.scenes.length, 42);
  const plan = h.api.planObsidianManuscriptPreparation(h.app, book); equal(plan.canApply, true);
});

test("duplicate numbered siblings and excluded parents receive path-specific blockers", () => {
  const h = preparationHarness(false);
  const duplicate = h.add("The-Structure-of-Aikido/00 Another Part.md");
  let selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  let book = h.api.buildSelectedManuscript(h.app, selection);
  let plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  equal(plan.canApply, false); ok(plan.diagnostics.some((item: any) => item.path === duplicate.path));
  h.loaded.delete(duplicate.path);
  selection = { ...selection, excludedPaths: [...selection.excludedPaths, "The-Structure-of-Aikido/00 Front Matter.md"] };
  book = h.api.buildSelectedManuscript(h.app, selection); plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  equal(plan.canApply, false); ok(plan.diagnostics.some((item: any) => item.path?.includes("01 Title Page")));
});

test("metadata readiness blocks confirmation, and changed excluded inputs or new notes invalidate the reviewed plan", async () => {
  const h = preparationHarness(false);
  const root = h.loaded.get(h.fixture.root);
  const selection = h.api.initialManuscriptPreparationSelection(h.app, root);
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  h.cache.delete(supportPaths[1]);
  const blocked = await h.api.validateManuscriptPreparationPreview(h.app, book, plan);
  equal(blocked.canApply, false); ok(blocked.diagnostics.some((item: any) => item.path === supportPaths[1] && /indexed/.test(item.message)));
  h.cache.set(supportPaths[1], { frontmatter: {} });
  const changed = h.loaded.get(supportPaths[1]) as File; changed.stat.mtime++;
  await rejects(h.api.applyManuscriptPreparation(h.app, book, plan), /changed before preparation/);
  equal(h.writes(), 0);
  const updatedBook = h.api.buildSelectedManuscript(h.app, selection);
  const updatedPlan = h.api.planObsidianManuscriptPreparation(h.app, updatedBook);
  h.add("The-Structure-of-Aikido/New note.md");
  await rejects(h.api.applyManuscriptPreparation(h.app, updatedBook, updatedPlan), /changed before preparation/);
  equal(h.writes(), 0);
});

test("disk/cache disagreement and malformed YAML are diagnosed without writes", async () => {
  const h = preparationHarness();
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  h.cache.set(supportPaths[0], { frontmatter: { type: "scene" } });
  let blocked = await h.api.validateManuscriptPreparationPreview(h.app, book, plan);
  equal(blocked.canApply, false); match(blocked.diagnostics.map((d: any) => d.message).join("\n"), /differs from Obsidian/);
  h.contents.set(supportPaths[1], "---\nnot yaml\n---\nProse");
  blocked = await h.api.validateManuscriptPreparationPreview(h.app, book, plan);
  equal(blocked.canApply, false); match(blocked.diagnostics.map((d: any) => d.message).join("\n"), /malformed/);
  equal(h.writes(), 0);
});

test("the production transaction rolls back failed writes exactly and refuses Undo after authored edits", async () => {
  const h = preparationHarness(false); const original = new Map(h.contents);
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  let book = h.api.buildSelectedManuscript(h.app, selection);
  let plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  h.failAt(3);
  await rejects(h.api.applyManuscriptPreparation(h.app, book, plan), /Injected write failure/);
  deepEqual(h.contents, original);
  book = h.api.buildSelectedManuscript(h.app, selection); plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  const token = await h.api.applyManuscriptPreparation(h.app, book, plan);
  const file = h.loaded.get(h.fixture.root) as File;
  await h.app.vault.modify(file, h.contents.get(file.path)! + "\nAuthor's new prose.");
  const edited = new Map(h.contents);
  await rejects(h.api.undoManuscriptPreparation(h.app, token), /Undo is not safe/);
  deepEqual(h.contents, edited);
});

test("prepared keys, explicit parents, non-manuscript types and legacy migration authority are preserved", () => {
  const h = preparationHarness();
  const scenePath = h.fixture.notes.find(note => note.frontmatter.type === "scene")!.path;
  h.add("The-Structure-of-Aikido/999 Research.md", { type: "character", custom: "retain" });
  let selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  let book = h.api.buildSelectedManuscript(h.app, selection);
  let plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  ok(!plan.files.some((file: any) => file.path.endsWith("Research.md")));
  h.add(scenePath, { type: "scene", parent: "[[Missing Parent]]" });
  book = h.api.buildSelectedManuscript(h.app, selection); plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  equal(plan.canApply, false); ok(plan.diagnostics.some((d: any) => d.path === scenePath));
  h.add(scenePath, { type: "scene", manuscript_type: "part" });
  book = h.api.buildSelectedManuscript(h.app, selection); plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  equal(plan.canApply, false);
  h.add(h.fixture.root, { type: "book", manuscript_order: "invalid scalar" });
  book = h.api.buildSelectedManuscript(h.app, selection); plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  equal(plan.canApply, false); equal(plan.source, "invalid");
});

test("a folder without a matching companion asks for an existing root note and prepares its scope", async () => {
  const h = preparationHarness(false);
  h.add("Other manuscript/Start.md", { title: "Other Book" });
  h.add("Other manuscript/1 Scene.md", { custom: "keep" });
  const operation = h.invoke(); await h.choose("Other manuscript");
  equal(h.writes(), 0);
  await h.choose("Other manuscript/Start.md");
  await h.click("Review structural changes"); await h.click("Prepare manuscript"); await operation;
  const books = h.api.buildObsidianManuscriptLibrary(h.app).books;
  equal(books.length, 1); equal(books[0].file.path, "Other manuscript/Start.md"); equal(books[0].result.scenes.length, 1);
  equal(h.cache.get(h.fixture.root)?.frontmatter?.type, undefined);
});

test("duplicate companion notes are diagnosed and explicit Scene types are never promoted to Parts", () => {
  const h = preparationHarness(false);
  const inside = h.add("The-Structure-of-Aikido/00 Front Matter/00 Front Matter.md", {});
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  equal(plan.canApply, false); ok(plan.diagnostics.some((d: any) => d.path === inside.path && /Companion notes/.test(d.message)));
  h.add("The-Structure-of-Aikido/00 Front Matter.md", { type: "scene" });
  const candidates = h.api.manuscriptPreparationCandidates(h.app, selection);
  equal(candidates.find((candidate: any) => candidate.file.path === "The-Structure-of-Aikido/00 Front Matter.md").kind, "scene");
});

test("complete legacy array order wins over filenames and is removed only after child verification", async () => {
  const h = preparationHarness();
  let selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  let book = h.api.buildSelectedManuscript(h.app, selection);
  const order = [...book.result.entries].reverse().map((entry: any) => `[[${entry.path.replace(/\.md$/, "")}]]`);
  h.add(h.fixture.root, { type: "book", manuscript_order: order });
  selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  equal(plan.source, "legacy_array"); equal(plan.canApply, true);
  const firstScene = book.result.scenes[0].path;
  const token = await h.api.applyManuscriptPreparation(h.app, book, plan);
  equal(h.cache.get(h.fixture.root)?.frontmatter?.manuscript_order, undefined);
  equal(h.api.buildObsidianManuscriptLibrary(h.app).books[0].result.scenes[0].path, firstScene);
  await h.api.undoManuscriptPreparation(h.app, token);
  deepEqual(h.cache.get(h.fixture.root)?.frontmatter?.manuscript_order, order);
});

test("valid distributed keys survive partial preparation and duplicate keys block without writes", async () => {
  const h = preparationHarness();
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  let book = h.api.buildSelectedManuscript(h.app, selection);
  await h.api.applyManuscriptPreparation(h.app, book, h.api.planObsidianManuscriptPreparation(h.app, book));
  const retained = new Map([...h.cache].map(([path, cache]) => [path, cache.frontmatter?.manuscript_order_key]));
  h.add("The-Structure-of-Aikido/10 New Direct Scene.md", { type: "scene" });
  book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = h.api.planObsidianManuscriptPreparation(h.app, book); equal(plan.canApply, true);
  await h.api.applyManuscriptPreparation(h.app, book, plan);
  for (const [path, key] of retained) equal(h.cache.get(path)?.frontmatter?.manuscript_order_key, key);
  const newScene = h.cache.get("The-Structure-of-Aikido/10 New Direct Scene.md")!.frontmatter!;
  const firstPart = h.cache.get("The-Structure-of-Aikido/00 Front Matter.md")!.frontmatter!;
  h.add("The-Structure-of-Aikido/10 New Direct Scene.md", { ...newScene, manuscript_order_key: firstPart.manuscript_order_key });
  book = h.api.buildSelectedManuscript(h.app, selection);
  const blocked = h.api.planObsidianManuscriptPreparation(h.app, book); equal(blocked.canApply, false);
  const writes = h.writes(); await rejects(h.api.applyManuscriptPreparation(h.app, book, blocked), /shares manuscript_order_key/); equal(h.writes(), writes);
});


test("valid empty frontmatter is accepted for an untyped root and companion Parts", async () => {
  const h = preparationHarness(false);
  for (const note of h.fixture.notes.filter(note => note.frontmatter.type === "book" || note.frontmatter.type === "part")) {
    const content = "---\n---\nOriginal prose.\n";
    h.contents.set(note.path, content); h.cache.set(note.path, { frontmatter: {} });
    (h.loaded.get(note.path) as File).stat.size = content.length;
  }
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = await h.api.validateManuscriptPreparationPreview(h.app, book, h.api.planObsidianManuscriptPreparation(h.app, book));
  equal(plan.canApply, true); equal(h.writes(), 0);
});

test("excluded support notes with no original frontmatter return to exact bytes on immediate Undo", async () => {
  const h = preparationHarness(false);
  for (const path of supportPaths) {
    const content = `# ${path}\nSupport prose without frontmatter.\n`;
    h.contents.set(path, content); h.cache.set(path, {}); (h.loaded.get(path) as File).stat.size = content.length;
  }
  const original = new Map(h.contents);
  const operation = h.invoke(); await h.choose(); await h.click("Review structural changes"); await h.click("Prepare manuscript"); await operation;
  for (const path of supportPaths) equal(h.cache.get(path)?.frontmatter?.type, "scene-draft");
  await h.invoke("undo-manuscript-preparation"); await h.tick();
  deepEqual(h.contents, original);
});

test("conflicting type lists and parent aliases cannot be hidden by first-property precedence", () => {
  const h = preparationHarness();
  const scenePath = h.fixture.notes.find(note => note.frontmatter.type === "scene")!.path;
  let selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  h.add(scenePath, { type: ["part", "scene"] });
  let book = h.api.buildSelectedManuscript(h.app, selection);
  equal(h.api.planObsidianManuscriptPreparation(h.app, book).canApply, false);
  h.add(scenePath, { type: "scene", parent: "[[The-Structure-of-Aikido/00 Front Matter]]", up: "[[The-Structure-of-Aikido/01 Part I - Foundations]]" });
  book = h.api.buildSelectedManuscript(h.app, selection);
  const blocked = h.api.planObsidianManuscriptPreparation(h.app, book);
  equal(blocked.canApply, false); ok(blocked.diagnostics.some((d: any) => d.path === scenePath && /references.*disagree/.test(d.message)));
  equal(h.writes(), 0);
});

test("an untyped root's complete legacy array remains authoritative for otherwise unclassified notes", async () => {
  const h = preparationHarness(false);
  const root = "Additional Book.md";
  h.add(root, { manuscript_order: ["[[Additional Book/Zeta]]", "[[Additional Book/Alpha]]"] });
  h.add("Additional Book/Alpha.md"); h.add("Additional Book/Zeta.md");
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(root));
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = h.api.planObsidianManuscriptPreparation(h.app, book);
  equal(plan.canApply, true); equal(plan.source, "legacy_array");
  deepEqual(book.result.scenes.map((scene: any) => scene.basename), ["Zeta", "Alpha"]);
  await h.api.applyManuscriptPreparation(h.app, book, plan);
  equal(h.api.buildObsidianManuscriptLibrary(h.app).books[0].result.scenes[0].basename, "Zeta");
});

test("cancelling the root picker performs zero writes and settles the command", async () => {
  const h = preparationHarness(false); const original = new Map(h.contents);
  const operation = h.invoke(); h.latest().close(); await operation;
  equal(h.writes(), 0); deepEqual(h.contents, original);
  equal(h.modals.length, 0);
});


test("cache-only positions do not become properties or prevent preparation", async () => {
  const h = preparationHarness();
  for (const cache of h.cache.values()) cache.frontmatter = { ...cache.frontmatter, position: { start: 0, end: 10 } };
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = await h.api.validateManuscriptPreparationPreview(h.app, book, h.api.planObsidianManuscriptPreparation(h.app, book));
  equal(plan.canApply, true);
  await h.api.applyManuscriptPreparation(h.app, book, plan);
  for (const content of h.contents.values()) ok(!content.includes('"position"'));
});

test("Undo refuses an authored position property edit despite cache position filtering", async () => {
  const h = preparationHarness(false);
  const path = h.fixture.notes.find(note => note.frontmatter.type === "scene")!.path;
  h.add(path, { position: 5, document_role: "chapter" });
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const token = await h.api.applyManuscriptPreparation(h.app, book, h.api.planObsidianManuscriptPreparation(h.app, book));
  const file = h.loaded.get(path) as File;
  await h.app.fileManager.processFrontMatter(file, fm => { fm.position = 6; });
  const edited = new Map(h.contents);
  await rejects(h.api.undoManuscriptPreparation(h.app, token), /Undo is not safe/);
  deepEqual(h.contents, edited);
});

function nestedAssetFixture(typed = false) {
  const h = preparationHarness(typed);
  h.loaded.delete("Assets/figure.png"); h.loaded.delete("Assets"); h.contents.delete("Assets/figure.png");
  h.addAsset("The-Structure-of-Aikido/Assets/figure.png");
  h.add(h.fixture.root, typed ? { type: "book" } : {}, "\nProse. ![Image](The-Structure-of-Aikido/Assets/figure.png)\n");
  h.add("Research.md", { custom: "retain" }, "\n![[The-Structure-of-Aikido/Assets/figure.png|100]]\n");
  return h;
}

for (const typed of [true, false]) {
  test(`asset preparation moves nested Assets to root with reviewed links and exact Undo (${typed})`, async () => {
    const h = nestedAssetFixture(typed), original = new Map(h.contents);
    const operation = h.invoke(); await h.choose();
    match(h.latest().contentEl.textContent(), /Assets belong in vault-root Assets/);
    await h.click("Review structural changes");
    const preview = h.latest().contentEl.textContent();
    match(preview, /The-Structure-of-Aikido\/Assets\/ → Assets\//);
    match(preview, /Research.md/); match(preview, /\[\[Assets\/figure.png\|100\]\]/);
    deepEqual(h.contents, original); equal(h.writes(), 0);
    await h.click("Prepare manuscript"); await operation;
    ok(h.loaded.has("Assets/figure.png")); ok(!h.loaded.has("The-Structure-of-Aikido/Assets"));
    equal(h.contents.get("Assets/figure.png"), "original asset bytes");
    match(h.contents.get(h.fixture.root)!, /!\[Image\]\(Assets\/figure.png\)/);
    match(h.contents.get("Research.md")!, /!\[\[Assets\/figure.png\|100\]\]/);
    const book = h.api.buildObsidianManuscriptLibrary(h.app).books[0];
    equal(book.result.scenes.length, 40); equal(book.result.entries.filter((entry: any) => entry.kind === "part").length, 6);
    const writes = h.writes();
    const second = h.invoke(); await h.choose(); await h.click("Review structural changes"); await second;
    equal(h.writes(), writes);
    await h.invoke("undo-manuscript-preparation"); await h.tick();
    deepEqual(h.contents, original); ok(h.loaded.has("The-Structure-of-Aikido/Assets/figure.png")); ok(!h.loaded.has("Assets"));
  });
}

test("asset preview cancellation and destination conflicts make no writes", async () => {
  const h = nestedAssetFixture(), original = new Map(h.contents);
  const operation = h.invoke(); await h.choose(); await h.click("Review structural changes"); await h.click("Cancel"); await operation;
  deepEqual(h.contents, original); equal(h.writes(), 0); ok(!h.loaded.has("Assets"));
  h.addAsset("Assets/other.png", "root assets");
  const conflict = h.invoke(); await h.choose(); await h.click("Review structural changes");
  match(h.latest().contentEl.textContent(), /Vault-root Assets already exists/);
  ok(!h.latest().contentEl.all().some(el => el.tag === "button" && el.text === "Prepare manuscript"));
  await h.click("Cancel"); await conflict; equal(h.writes(), 0);
});

test("asset edits, new assets and changed external links invalidate approval; rollback restores relocated assets", async () => {
  for (const change of ["asset", "new", "link"]) {
    const h = nestedAssetFixture();
    const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
    const book = h.api.buildSelectedManuscript(h.app, selection);
    const plan = await h.api.validateManuscriptPreparationPreview(h.app, book, h.api.planObsidianManuscriptPreparation(h.app, book));
    if (change === "asset") (h.loaded.get("The-Structure-of-Aikido/Assets/figure.png") as File).stat.mtime++;
    else if (change === "new") h.addAsset("The-Structure-of-Aikido/Assets/new.png");
    else await h.app.vault.modify(h.loaded.get("Research.md") as File, h.contents.get("Research.md")! + "Author edit\n");
    const edited = new Map(h.contents);
    await rejects(h.api.applyManuscriptPreparation(h.app, book, plan), /changed before preparation/);
    deepEqual(h.contents, edited); ok(!h.loaded.has("Assets"));
  }
  const h = nestedAssetFixture(), original = new Map(h.contents);
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = await h.api.validateManuscriptPreparationPreview(h.app, book, h.api.planObsidianManuscriptPreparation(h.app, book));
  h.failAt(4);
  await rejects(h.api.applyManuscriptPreparation(h.app, book, plan), /Injected write failure/);
  deepEqual(h.contents, original); ok(!h.loaded.has("Assets"));
});

test("asset Undo refuses modified assets, destination conflicts and changed external notes", async () => {
  for (const change of ["asset", "destination", "link"]) {
    const h = nestedAssetFixture();
    const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
    const book = h.api.buildSelectedManuscript(h.app, selection);
    const plan = await h.api.validateManuscriptPreparationPreview(h.app, book, h.api.planObsidianManuscriptPreparation(h.app, book));
    const token = await h.api.applyManuscriptPreparation(h.app, book, plan);
    if (change === "asset") (h.loaded.get("Assets/figure.png") as File).stat.mtime++;
    else if (change === "destination") h.folder("The-Structure-of-Aikido/Assets");
    else await h.app.vault.modify(h.loaded.get("Research.md") as File, h.contents.get("Research.md")! + "Edit\n");
    const edited = new Map(h.contents);
    await rejects(h.api.undoManuscriptPreparation(h.app, token), /Assets changed|Undo is not safe/);
    deepEqual(h.contents, edited); ok(h.loaded.has("Assets/figure.png"));
  }
});

test("asset relocation preserves relative Markdown destinations, fragments and wikilink aliases", async () => {
  const h = nestedAssetFixture();
  h.addAsset("The-Structure-of-Aikido/Assets/figure space.png", "second asset");
  const scene = h.fixture.notes.find(note => note.frontmatter.type === "scene")!.path;
  h.add(scene, { document_role: "chapter" }, "\nProse ![Caption](../Assets/figure%20space.png#detail) and ![[The-Structure-of-Aikido/Assets/figure.png#detail|Alias]].\n");
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = await h.api.validateManuscriptPreparationPreview(h.app, book, h.api.planObsidianManuscriptPreparation(h.app, book));
  const token = await h.api.applyManuscriptPreparation(h.app, book, plan);
  match(h.contents.get(scene)!, /!\[Caption\]\(\.\.\/\.\.\/Assets\/figure%20space.png#detail\)/);
  match(h.contents.get(scene)!, /!\[\[Assets\/figure.png#detail\|Alias\]\]/);
  await h.api.undoManuscriptPreparation(h.app, token);
});

test("failed folder renames and compiler rejection restore asset paths and original notes", async () => {
  for (const failure of ["before-rename", "after-rename", "acceptance"]) {
    const h = nestedAssetFixture(), original = new Map(h.contents);
    const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
    const book = h.api.buildSelectedManuscript(h.app, selection);
    const plan = await h.api.validateManuscriptPreparationPreview(h.app, book, h.api.planObsidianManuscriptPreparation(h.app, book));
    const rename = h.app.vault.rename;
    let failed = false;
    h.app.vault.rename = async (file, destination) => {
      if (!failed && failure !== "acceptance") {
        failed = true;
        if (failure === "after-rename") await rename(file, destination);
        throw new Error("Injected rename failure");
      }
      await rename(file, destination);
    };
    await rejects(h.api.applyManuscriptPreparation(h.app, book, plan, { validate: async () => { throw new Error("Compiler rejected"); } }), /Injected rename failure|Compiler rejected/);
    deepEqual(h.contents, original); ok(h.loaded.has("The-Structure-of-Aikido/Assets/figure.png")); ok(!h.loaded.has("Assets"));
  }
});

test("failed Undo rolls restored links and asset location forward; moved notes block Undo", async () => {
  const h = nestedAssetFixture();
  const selection = h.api.initialManuscriptPreparationSelection(h.app, h.loaded.get(h.fixture.root));
  const book = h.api.buildSelectedManuscript(h.app, selection);
  const plan = await h.api.validateManuscriptPreparationPreview(h.app, book, h.api.planObsidianManuscriptPreparation(h.app, book));
  const token = await h.api.applyManuscriptPreparation(h.app, book, plan), prepared = new Map(h.contents);
  const modify = h.app.vault.modify; let count = 0;
  h.app.vault.modify = async (file, content) => { if (++count === 2) throw new Error("Injected Undo failure"); await modify(file, content); };
  await rejects(h.api.undoManuscriptPreparation(h.app, token), /Injected Undo failure/);
  deepEqual(h.contents, prepared); ok(h.loaded.has("Assets/figure.png")); ok(!h.loaded.has("The-Structure-of-Aikido/Assets"));
  await h.app.vault.rename(h.loaded.get("Research.md") as File, "Renamed Research.md");
  await rejects(h.api.undoManuscriptPreparation(h.app, token), /Undo is not safe.*Research.md/);
});
