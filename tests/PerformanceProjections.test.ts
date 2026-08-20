import { equal, strictEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DisposableProjection } from "../src/projections/DisposableProjection";
import { StoryWorldStartup } from "../src/story-world/StoryWorldStartup";
import { StoryWorldDocument, StoryWorldIndex } from "../src/story-world/StoryWorldIndex";

test("Story World startup bounds full indexing across layout and metadata resolution", () => {
  let rebuilds = 0;
  const startup = new StoryWorldStartup(() => ++rebuilds);
  equal(startup.initialise(), 1);
  equal(startup.initialise(), null);
  equal(startup.settle(), 2);
  equal(startup.settle(), null);
  equal(startup.metadataResolved(), 3);
  equal(startup.metadataResolved(), null);
  equal(startup.settle(), null);
  equal(rebuilds, 3);
});

test("Story World startup converges after frontmatter becomes fully available and refreshes consumers read-only", () => {
  const index = new StoryWorldIndex();
  let cachedDocuments: StoryWorldDocument[] = [
    { path: "World/One.md", basename: "One", frontmatter: { world_entity: "character" } },
    { path: "World/Pip POV.md", basename: "Pip POV", frontmatter: undefined }
  ];
  const sourceDocuments: StoryWorldDocument[] = [
    { path: "World/One.md", basename: "One", frontmatter: { world_entity: "character" } },
    { path: "World/Pip POV.md", basename: "Pip POV", frontmatter: { world_entity: "pov-profile" } }
  ];
  const originalSource = JSON.stringify(sourceDocuments);
  const refreshedTypes: string[][] = [];
  const startup = new StoryWorldStartup(
    () => index.rebuild(cachedDocuments),
    () => refreshedTypes.push(index.getAll().map((entity) => entity.entityType))
  );

  startup.initialise();
  equal(index.getAll().length, 1);

  // Layout can become ready while Obsidian still exposes only partial cached
  // frontmatter. The resolved event must remain able to perform the final pass.
  startup.settle();
  equal(index.getAll().length, 1);

  cachedDocuments = sourceDocuments;
  startup.metadataResolved();
  equal(index.getAll().length, 2);
  equal(index.findByType("pov-profile").length, 1);
  equal(refreshedTypes.length, 2);
  equal(refreshedTypes.at(-1)?.includes("pov-profile"), true);
  equal(JSON.stringify(sourceDocuments), originalSource);
});

test("settled Story World rebuild refreshes every index-backed workspace consumer", () => {
  const main = readFileSync("src/main.ts", "utf8");
  const entry = readFileSync("src/entry.ts", "utf8");
  const registration = main.indexOf('metadataCache.on("resolved", () => this.storyWorldStartup.metadataResolved())');
  const asyncLoad = main.indexOf("await this.storeService.load()");
  equal(registration >= 0 && registration < asyncLoad, true);

  const refresh = entry.match(/protected override refreshStoryWorldIndexConsumers\(\): void \{(?<body>[\s\S]*?)\n  \}/u)?.groups?.body ?? "";
  equal(refresh.includes("this.refreshStoryWorldNavigator()"), true);
  equal(refresh.includes("this.refreshStoryWorldGraph()"), true);
  equal(refresh.includes("this.refreshView()"), true);
  equal(entry.match(/refreshStoryWorldNavigator\(\) \{(?<body>[\s\S]*?)\n  \}/u)?.groups?.body.includes("this.refreshStoryWorldReview()"), true);
  equal(entry.match(/override refreshView\(\) \{(?<body>[\s\S]*?)\n  \}/u)?.groups?.body.includes("this.refreshStoryWorldTimeline()"), true);
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
