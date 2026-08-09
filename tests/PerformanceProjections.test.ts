import { equal, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { DisposableProjection } from "../src/projections/DisposableProjection";
import { StoryWorldStartup } from "../src/story-world/StoryWorldStartup";

test("Story World startup full indexing is idempotent across readiness phases", () => {
  let rebuilds = 0;
  const startup = new StoryWorldStartup(() => ++rebuilds);
  equal(startup.initialise(), 1);
  equal(startup.initialise(), null);
  equal(startup.settle(), null);
  equal(rebuilds, 1);
});

test("Story World startup performs one necessary settled pass after incomplete metadata", () => {
  let rebuilds = 0;
  const startup = new StoryWorldStartup(() => ++rebuilds, () => false);
  equal(startup.initialise(), 1);
  equal(startup.settle(), 2);
  equal(startup.settle(), null);
  equal(rebuilds, 2);
});

test("manuscript consumers reuse one settled projection and one settled change rebuilds once", () => {
  let builds = 0;
  const service = new DisposableProjection(() => ({ builds: ++builds }));
  const first = service.get();
  strictEqual(service.get(), first);
  equal(builds, 1);
  const second = service.rebuild();
  strictEqual(service.get(), second);
  equal(builds, 2);
  const published = { settled: true } as never;
  service.publish(published);
  strictEqual(service.get(), published);
  equal(builds, 2);
});

test("Story World review reuse survives filters/unrelated evidence and relevant changes recollect once", () => {
  let collections = 0;
  const service = new DisposableProjection(() => ({ generation: ++collections }));
  const first = service.get();
  strictEqual(service.get(), first); // repeated render / filter change
  equal(collections, 1);
  equal(service.updateDependency("Notes/Ordinary.md", null, false), false);
  strictEqual(service.get(), first);
  equal(collections, 1);
  equal(service.updateDependency("World/Entity.md", "{\"world_entity\":\"character\"}", true), true);
  const second = service.get();
  strictEqual(service.get(), second);
  equal(collections, 2);
});

test("Story World create, rename and delete invalidation is explicit without eager warming", () => {
  let collections = 0;
  const service = new DisposableProjection(() => ({ generation: ++collections }));
  service.updateDependency("World/New.md", "new", true);
  equal(collections, 0);
  service.get();
  equal(collections, 1);
  service.invalidate();
  service.get();
  equal(collections, 2);
});
