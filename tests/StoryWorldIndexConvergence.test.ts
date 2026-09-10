import { deepEqual, equal, match, ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { App, TFile } from "obsidian";
import { ObsidianStoryWorldIndex } from "../src/story-world/ObsidianStoryWorldIndex";
import { StoryWorldStartup } from "../src/story-world/StoryWorldStartup";
import { StoryWorldReviewProjectionService } from "../src/story-world/StoryWorldReviewProjection";
import { EntityRelationshipTargets } from "../src/story-world/EntityRelationshipFormValues";
import { projectContinuityReview } from "../src/observations/ContinuityReview";

const targetPath = "Story World/Organisations/UK Government.md";
const sourcePath = "Story World/Organisations/Cabinet Office.md";
const targetFrontmatter = Object.freeze({ world_entity: "organisation", world_name: "UK Government", aliases: ["HMG"] });

function fixture() {
  const files: TFile[] = [];
  const cache = new Map<string, { frontmatter?: Record<string, unknown> }>();
  const add = (path: string, frontmatter?: Record<string, unknown>) => {
    const file = { path, basename: path.split("/").pop()!.replace(/\.md$/, ""), extension: "md" } as TFile;
    files.push(file);
    if (frontmatter) cache.set(path, { frontmatter });
    return file;
  };
  add(sourcePath, Object.freeze({ world_entity: "organisation", world_name: "Cabinet Office",
    world_relationships: [Object.freeze({ predicate: "member_of", target: "[[UK Government]]", status: "confirmed" })] }));
  const noWrite = () => { throw new Error("Indexing/review must not write source files"); };
  const app = {
    vault: { getMarkdownFiles: () => files, getAbstractFileByPath: (path: string) => files.find(f => f.path === path),
      modify: noWrite, process: noWrite, create: noWrite, delete: noWrite, rename: noWrite },
    fileManager: { processFrontMatter: noWrite },
    metadataCache: { getFileCache: (file: TFile) => cache.get(file.path),
      getFirstLinkpathDest: (link: string) => files.find(f => f.path.replace(/\.md$/, "") === link || f.basename === link) ?? null }
  } as unknown as App;
  const world = new ObsidianStoryWorldIndex(app);
  const review = new StoryWorldReviewProjectionService(app, world);
  let refreshes = 0;
  const lifecycle = new StoryWorldStartup(() => world.rebuild(), () => { review.invalidate(); refreshes++; });
  lifecycle.initialise(); lifecycle.settle(); lifecycle.metadataResolved();
  const targets = new EntityRelationshipTargets(() => world.index.getAll(), () => files.map(f => f.path));
  const broken = () => projectContinuityReview({ observations: review.get().observations, dispositions: new Map(), manuscriptScope: {
    book: { role: "manuscript", path: "Books.md", label: "Books" }, manuscriptPaths: new Set(["Books.md"]),
    locations: new Map(), explicitlyReferencedStoryWorldPaths: new Set([sourcePath])
  } }, { queue: "active", type: null, locationPath: null, entityPath: null }).items
    .filter(item => item.observation.kind === "story-world.relationship.unresolved-target");
  return { files, cache, add, world, review, lifecycle, targets, broken, refreshes: () => refreshes };
}

for (const initial of [undefined, {}, { frontmatter: {} }]) {
  test(`new/imported note converges after startup despite initial cache ${JSON.stringify(initial)}`, () => {
    const f = fixture();
    // This editor and cached review both predate the new target.
    equal(f.broken().length, 1);
    match(f.targets.resolve("[[UK Government]]").error!, /No Story World entity/);
    const target = f.add(targetPath);
    if (initial) f.cache.set(targetPath, initial);
    equal(f.world.handleCreate(target), false);
    equal(f.world.handleMetadataChanged(target), false);
    f.lifecycle.metadataResolved(); // Even another early pass must not exhaust retries.
    equal(f.targets.suggestions().some(s => s.value === "UK Government"), false);
    f.cache.set(targetPath, { frontmatter: targetFrontmatter });
    const before = JSON.stringify([...f.cache]);
    const refreshes = f.refreshes();
    // No manual recovery and no extra per-file changed event are required.
    f.lifecycle.metadataResolved();
    equal(f.refreshes(), refreshes + 1);
    equal(f.world.index.getByPath(targetPath)?.entityType, "organisation");
    ok(f.targets.suggestions().some(s => s.value === "UK Government"));
    ok(f.targets.suggestions().some(s => s.value === "HMG"));
    for (const reference of ["UK Government", "HMG", "[[UK Government]]", "[[HMG]]", "[[Story World/Organisations/UK Government]]"]) {
      equal(f.targets.resolve(reference).entity?.path, targetPath);
      equal(f.targets.resolve(reference).error, null);
    }
    equal(f.world.resolveWikilink("[[UK Government]]", sourcePath)?.path, targetPath);
    equal(f.broken().length, 0);
    equal(JSON.stringify([...f.cache]), before);
  });
}

test("current candidates retain basename, aliases, path qualification and ambiguity safeguards", () => {
  const f = fixture();
  f.add(targetPath, { ...targetFrontmatter, world_name: "Sovereign Government" });
  f.lifecycle.metadataResolved();
  for (const reference of ["Sovereign Government", "UK Government", "HMG", "[[UK Government]]", "[[Story World/Organisations/UK Government.md|Government]]"]) {
    equal(f.targets.resolve(reference).entity?.path, targetPath);
  }
  f.add("Other/UK Government.md", { world_entity: "custom-institution", world_name: "Sovereign Government", aliases: ["HMG"] });
  f.lifecycle.metadataResolved();
  for (const reference of ["Sovereign Government", "UK Government", "HMG", "[[UK Government]]"]) {
    match(f.targets.resolve(reference).error!, /ambiguous/);
    equal(f.targets.resolve(reference).reference, null);
  }
  equal(f.targets.resolve("[[Story World/Organisations/UK Government]]").reference,
    "[[Story World/Organisations/UK Government|Sovereign Government]]");
  ok(f.targets.suggestions().some(s => s.value === "Story World/Organisations/UK Government"));
  equal(f.world.index.findByType("custom-institution").length, 1);
});

test("rename, Trash, delayed restore and delete converge without resurrecting removed paths", () => {
  const f = fixture();
  const file = f.add(targetPath, targetFrontmatter);
  f.lifecycle.metadataResolved();
  const renamed = "Story World/Government.md";
  file.path = renamed; file.basename = "Government";
  f.cache.delete(targetPath);
  f.world.handleRename(file, targetPath);
  f.cache.set(renamed, { frontmatter: targetFrontmatter });
  f.lifecycle.metadataResolved();
  equal(f.world.index.getByPath(targetPath), null);
  equal(f.targets.resolve("Government").entity?.path, renamed);
  file.path = ".trash/Government.md";
  f.cache.set(file.path, { frontmatter: targetFrontmatter });
  f.world.handleDeletePath(renamed); // Same trash-delete routing as the plugin.
  f.lifecycle.metadataResolved();
  equal(f.targets.resolve("HMG").entity, null);
  equal(f.world.handleMetadataChanged(file), false);
  equal(f.world.handleCreate(file), false);
  file.path = renamed;
  f.cache.delete(renamed);
  equal(f.world.handleCreate(file), false); // Restore before frontmatter is ready.
  f.cache.set(renamed, { frontmatter: targetFrontmatter });
  f.lifecycle.metadataResolved();
  equal(f.targets.resolve("HMG").entity?.path, renamed);
  f.files.splice(f.files.indexOf(file), 1);
  f.world.handleDelete(file);
  f.lifecycle.metadataResolved();
  equal(f.targets.resolve("HMG").entity, null);
  deepEqual(f.world.index.getAll().map(e => e.path), [sourcePath]);
});

test("event wiring retries unknown Markdown and invalidates review after deferred reads", () => {
  const main = readFileSync("src/main.ts", "utf8");
  ok(!main.includes("shouldScheduleSettledStoryWorldRefresh"));
  for (const handler of ["handleCreate(file)", "handleRename(file, oldPath)"]) {
    match(main.slice(main.indexOf(handler), main.indexOf(handler) + 180), /scheduleStoryWorldMetadataRefresh/);
  }
  const deferred = main.slice(main.indexOf("private scheduleStoryWorldMetadataRefresh"), main.indexOf("getPendingFocusNoteId"));
  match(deferred, /if \(this.storyWorldReviewProjection.refreshMetadata\(files\)\)/);
  match(deferred, /refreshStoryWorldIndexConsumers\(\)/);
  const form = readFileSync("src/ui/EntityRelationshipWorkspace.ts", "utf8");
  match(form, /\(\) => plugin.storyWorldIndex.index.getAll\(\)/);
  match(form, /form.addEventListener\("focusin", update\)/);
  match(form, /targets.suggestions\(\)/);
  match(form, /save.onclick = async \(\) => \{\s*const draft = currentDraft\(\)/);
});
