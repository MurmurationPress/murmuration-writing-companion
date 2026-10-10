import { deepEqual, equal, notEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { syntheticVault, drainMetadata } from "../benchmarks/RuntimeBaseline";
import { StoryWorldStartup } from "../src/story-world/StoryWorldStartup";
import { EntityRelationshipTargets } from "../src/story-world/EntityRelationshipFormValues";
import { StoryWorldIndex } from "../src/story-world/StoryWorldIndex";

for (const size of [100, 1000, 10000]) {
  test(`${size} synthetic notes: settled index passes keep unchanged records without sorting/reindexing`, () => {
    const f = syntheticVault(size);
    const lifecycle = new StoryWorldStartup(() => f.world.rebuild());
    lifecycle.initialise();
    const first = f.world.index.getByPath(f.files[0].path);
    equal(f.counts.changedUpserts, size / 5);
    lifecycle.settle(); lifecycle.metadataResolved(); lifecycle.metadataResolved();
    equal(f.counts.markdownEnumerations, 4); // Every authoritative pass remains.
    equal(f.counts.changedUpserts, size / 5);
    equal(f.counts.entitySorts, 0);
    strictEqual(f.world.index.getByPath(f.files[0].path), first);
    equal(f.world.index.size, size / 5);
  });

  test(`${size} synthetic notes: cold/warm review and unchanged metadata burst have bounded reads`, () => {
    const f = syntheticVault(size); f.world.rebuild();
    const start = f.counts.cacheReads;
    const first = f.review.get();
    equal(f.counts.cacheReads - start, 3 * size);
    const warm = f.counts.cacheReads;
    for (let i = 0; i < 10; i++) strictEqual(f.review.get(), first);
    equal(f.counts.cacheReads, warm);
    for (let i = 0; i < 20; i++) f.review.invalidateMetadata(f.files[1], f.world.handleMetadataChanged(f.files[1]));
    equal(drainMetadata(f, [f.files[1]]), false);
    equal(f.counts.cacheReads - warm, 42);
    strictEqual(f.review.get(), first);
  });
}

test("settled drain discovers delayed metadata and invalidates review/current candidates without writes", () => {
  const f = syntheticVault(100); f.world.rebuild();
  const first = f.review.get();
  const targets = new EntityRelationshipTargets(() => f.world.index.getAll(), () => f.files.map(file => file.path));
  const file = f.files[1]; f.metadata.set(file.path, {});
  equal(f.world.handleCreate(file), false);
  equal(targets.resolve("Imported institution").entity, null);
  f.metadata.set(file.path, { frontmatter: { world_entity: "new-custom-type", world_name: "Imported institution", aliases: ["Imported alias"] } });
  equal(drainMetadata(f, [file]), true);
  equal(targets.resolve("Imported alias").entity?.path, file.path);
  equal(targets.resolve(`[[${file.path}]]`).error, null);
  notEqual(f.review.get(), first);
  equal(drainMetadata(f, [file]), false);
});

test("reconciliation detects in-place metadata changes, disappearance, invalidation and duplicate paths", () => {
  const index = new StoryWorldIndex();
  const frontmatter = { world_entity: "custom", world_name: "One", aliases: ["Old alias"] };
  const document = { path: "World/One.md", basename: "One", frontmatter };
  index.rebuild([document]);
  const original = index.getByPath(document.path)!;
  frontmatter.world_name = "Changed"; frontmatter.aliases[0] = "New alias";
  equal(index.rebuild([document]), true);
  equal(original.name, "One"); deepEqual(original.aliases, ["Old alias"]);
  equal(index.findByNameOrAlias("Old alias").length, 0);
  equal(index.findByNameOrAlias("New alias").length, 1);
  equal(index.rebuild([{ ...document, frontmatter: { world_entity: "different" } }, document]), false);
  equal(index.rebuild([{ ...document, frontmatter: {} }]), true);
  equal(index.size, 0);
  index.rebuild([document]); equal(index.rebuild([]), true); equal(index.size, 0);
});

test("settled review evidence on a non-entity still refreshes and invalidates the projection", () => {
  const f = syntheticVault(100); f.world.rebuild();
  const before = f.review.get();
  const file = f.files[1];
  f.metadata.set(file.path, { frontmatter: { kind: "scene", world_context: ["[[Missing synthetic reference]]"] } });
  equal(f.world.handleMetadataChanged(file), false);
  equal(drainMetadata(f, [file]), true);
  notEqual(f.review.get(), before);
  equal(drainMetadata(f, [file]), false);
});


test("unchanged-document check preserves YAML Date versus string identity semantics", () => {
  const index = new StoryWorldIndex();
  const date = new Date("2030-01-01T00:00:00.000Z");
  const document = { path: "World/Date.md", basename: "Date", frontmatter: { world_entity: "event", world_name: date, aliases: [date] } };
  index.rebuild([document]);
  equal(index.getByPath(document.path)?.name, "Date");
  equal(index.rebuild([{ ...document, frontmatter: { ...document.frontmatter, world_name: date.toISOString(), aliases: [date.toISOString()] } }]), true);
  equal(index.getByPath(document.path)?.name, date.toISOString());
  equal(index.findByNameOrAlias(date.toISOString()).length, 1);
});

test('entity list consumers share one sort per changed index while retaining private arrays', () => {
  const f = syntheticVault(100); f.world.rebuild();
  const original = Array.prototype.sort; let sorts = 0;
  Array.prototype.sort = function(compare) { sorts++; return original.call(this, compare); };
  try {
    const first = f.world.index.getAll(); const expected = first.map(e => e.path);
    first.reverse(); first.pop();
    for (let i = 0; i < 20; i++) deepEqual(f.world.index.getAll().map(e => e.path), expected);
    equal(sorts, 1);
    f.world.index.rebuild(f.files.map(file => ({ path: file.path, basename: file.basename, frontmatter: f.metadata.get(file.path)?.frontmatter }))); f.world.index.getAll(); equal(sorts, 1); // unchanged resolution retains sorted snapshot
    const file = f.files[0]; f.metadata.get(file.path)!.frontmatter!.world_name = 'External edit';
    f.world.handleMetadataChanged(file); equal(f.world.index.getAll()[0].name, 'External edit'); equal(sorts, 2);
    f.world.index.rename(file.path, {path:'ZZ.md',basename:'ZZ',frontmatter:{world_entity:'character'}});
    equal(f.world.index.getAll().at(-1)!.path,'ZZ.md'); equal(sorts,3);
    f.world.index.remove('ZZ.md'); equal(f.world.index.getAll().length,19); equal(sorts,4);
    f.world.index.clear(); deepEqual(f.world.index.getAll(),[]); equal(sorts,5);
  } finally { Array.prototype.sort = original; }
});

test('repeated entity consumers stop sorting while metadata changes still invalidate the list', () => {
  const f=syntheticVault(1000); f.world.rebuild();
  for(let i=0;i<20;i++) f.world.index.getAll();
  equal(f.counts.entityListReads,20); equal(f.counts.entitySorts,1);
  const file=f.files[0]; f.metadata.get(file.path)!.frontmatter!.world_name='Changed externally';
  equal(f.world.handleMetadataChanged(file),true); f.world.index.getAll();
  equal(f.counts.entitySorts,2);
});

test('authoritative resolution catches late non-entity evidence and disappeared source notes using one file scan', () => {
  const f = syntheticVault(100); f.world.rebuild();
  const before = f.review.get(); const file = f.files[1];
  // The host can expose fresh cache only at resolved, after changed/drain ran.
  f.metadata.set(file.path, {frontmatter: {world_context: ['[[Unknown late reference]]']}});
  let evidenceChanged = false; const scans = f.counts.markdownEnumerations;
  equal(f.world.rebuild(files => {evidenceChanged = f.review.reconcileMetadata(files);}), false);
  equal(f.counts.markdownEnumerations - scans, 1); equal(evidenceChanged, true);
  const withEvidence = f.review.get(); notEqual(withEvidence, before);
  f.world.rebuild(files => {evidenceChanged = f.review.reconcileMetadata(files);});
  equal(evidenceChanged, false); strictEqual(f.review.get(), withEvidence);
  f.files.splice(1,1); // A missed delete callback must not retain review evidence.
  f.world.rebuild(files => {evidenceChanged = f.review.reconcileMetadata(files);});
  equal(evidenceChanged, true); notEqual(f.review.get(), withEvidence);
});

test('resolved target existence changes invalidate review even when source evidence and entities are unchanged', () => {
  const f = syntheticVault(100);
  const source = f.files[0], target = f.files[1];
  f.metadata.get(source.path)!.frontmatter!.world_sources = ['[[External evidence]]'];
  const original = f.app.metadataCache.getFirstLinkpathDest.bind(f.app.metadataCache);
  let destination: typeof target | null = null;
  f.app.metadataCache.getFirstLinkpathDest = (link, path) => link === 'External evidence' ? destination : original(link, path);
  f.world.rebuild();
  const missing = f.review.get();
  equal(missing.observations.some(o => o.kind === 'story-world.source.unresolved'), true);
  // Host link resolution can arrive late, or point at a non-entity/attachment.
  // Neither the source fingerprint nor entity index changes in this transition.
  destination = target;
  let changed = false;
  equal(f.world.rebuild(files => { changed = f.review.reconcileMetadata(files); }), false);
  equal(changed, true);
  const resolved = f.review.get();
  equal(resolved.observations.some(o => o.kind === 'story-world.source.unresolved'), false);
  f.world.rebuild(files => { changed = f.review.reconcileMetadata(files); });
  equal(changed, false); strictEqual(f.review.get(), resolved);
  destination = { ...target, path: '.trash/Evidence.md' };
  f.world.rebuild(files => { changed = f.review.reconcileMetadata(files); });
  equal(changed, true);
  equal(f.review.get().observations.some(o => o.kind === 'story-world.source.unresolved'), true);
  destination = { ...target, path: 'Evidence.pdf', extension: 'pdf' };
  f.world.rebuild(files => { changed = f.review.reconcileMetadata(files); });
  equal(changed, true);
  equal(f.review.get().observations.some(o => o.kind === 'story-world.source.unresolved'), false);
  destination = null;
  f.world.rebuild(files => { changed = f.review.reconcileMetadata(files); });
  equal(changed, true);
  equal(f.review.get().observations.some(o => o.kind === 'story-world.source.unresolved'), true);
});
