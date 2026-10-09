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
