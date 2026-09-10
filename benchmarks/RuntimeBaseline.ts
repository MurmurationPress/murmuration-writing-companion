import type { App, TFile } from "obsidian";
import { performance } from "node:perf_hooks";
import { ObsidianStoryWorldIndex } from "../src/story-world/ObsidianStoryWorldIndex";
import { StoryWorldStartup } from "../src/story-world/StoryWorldStartup";
import { StoryWorldReviewProjectionService } from "../src/story-world/StoryWorldReviewProjection";
import { EntityRelationshipTargets } from "../src/story-world/EntityRelationshipFormValues";
import { buildStoryWorldGraph } from "../src/story-world/StoryWorldGraph";
import { projectStoryWorldTimeline } from "../src/story-world/StoryWorldTimeline";

/** Entirely synthetic: no vault reads, private names, or source Markdown writes. */
export function syntheticVault(size: number) {
  const files: TFile[] = [];
  const metadata = new Map<string, { frontmatter?: Record<string, unknown> }>();
  const paths = new Map<string, TFile>();
  const counts = { markdownEnumerations: 0, cacheReads: 0, upserts: 0, changedUpserts: 0, entitySorts: 0 };
  for (let i = 0; i < size; i++) {
    const basename = `Synthetic ${String(i).padStart(5, "0")}`;
    const file = { path: `Synthetic/${basename}.md`, basename, extension: "md" } as TFile;
    files.push(file); paths.set(file.path, file); paths.set(basename, file);
    metadata.set(file.path, { frontmatter: i % 5 === 0
      ? { world_entity: i % 10 === 0 ? "event" : "custom-institution", world_name: basename, aliases: [`Alias ${i}`],
        ...(i ? { world_relationships: [{ predicate: "follows", target: `[[Synthetic ${String(i - 5).padStart(5, "0")}]]` }] } : {}) }
      : { kind: "scene", title: basename } });
  }
  const noWrite = () => { throw new Error("Read-only benchmark attempted a vault write"); };
  const app = {
    vault: { getMarkdownFiles: () => { counts.markdownEnumerations++; return files; },
      getAbstractFileByPath: (path: string) => paths.get(path), modify: noWrite, create: noWrite, delete: noWrite, rename: noWrite, process: noWrite },
    fileManager: { processFrontMatter: noWrite },
    metadataCache: {
      getFileCache: (file: TFile) => { counts.cacheReads++; return metadata.get(file.path); },
      getFirstLinkpathDest: (reference: string) => paths.get(reference) ?? paths.get(`${reference}.md`) ?? null
    }
  } as unknown as App;
  const world = new ObsidianStoryWorldIndex(app);
  const upsert = world.index.upsert.bind(world.index);
  world.index.upsert = document => {
    counts.upserts++; const changed = upsert(document);
    if (changed) counts.changedUpserts++;
    return changed;
  };
  const getAll = world.index.getAll.bind(world.index);
  world.index.getAll = () => { counts.entitySorts++; return getAll(); };
  const review = new StoryWorldReviewProjectionService(app, world);
  return { files, metadata, counts, app, world, review };
}

/** Replay the production deferred-drain contract, including the pre-252 implementation. */
export function drainMetadata(f: ReturnType<typeof syntheticVault>, files: TFile[]): boolean {
  const service = f.review as StoryWorldReviewProjectionService & { refreshMetadata?: (files: TFile[]) => boolean };
  if (service.refreshMetadata) return service.refreshMetadata(files);
  for (const file of files) f.review.invalidateMetadata(file, f.world.handleMetadataChanged(file));
  return true; // main at b566438 refreshed consumers unconditionally after the drain.
}

export function runtimeBaseline(size: number) {
  const f = syntheticVault(size);
  const samples: { stage: string; counts: typeof f.counts; refreshRequests: number; elapsedMs: number }[] = [];
  let refreshRequests = 0;
  const measure = (stage: string, action: () => void) => {
    const before = { ...f.counts }; const beforeRefresh = refreshRequests; const start = performance.now(); action();
    samples.push({ stage, counts: Object.fromEntries(Object.entries(f.counts).map(([k, v]) => [k, v - before[k as keyof typeof before]])) as typeof f.counts,
      refreshRequests: refreshRequests - beforeRefresh, elapsedMs: Number((performance.now() - start).toFixed(3)) });
  };
  const lifecycle = new StoryWorldStartup(() => f.world.rebuild(), () => { f.review.invalidate(); refreshRequests++; });
  measure("startup-initial", () => { lifecycle.initialise(); });
  measure("startup-layout", () => { lifecycle.settle(); });
  measure("metadata-resolved", () => { lifecycle.metadataResolved(); });
  measure("review-cold", () => { f.review.get(); });
  measure("review-warm-10-consumers", () => { for (let i = 0; i < 10; i++) f.review.get(); });
  measure("unchanged-resolved", () => { lifecycle.metadataResolved(); });
  f.review.get(); // Warm state before an ordinary non-Story-World metadata burst.
  measure("ordinary-metadata-burst-20", () => {
    for (let i = 0; i < 20; i++) f.review.invalidateMetadata(f.files[1], f.world.handleMetadataChanged(f.files[1]));
    if (drainMetadata(f, [f.files[1]])) refreshRequests++;
  });
  measure("delayed-import", () => {
    const file = f.files[2]; f.metadata.set(file.path, {}); f.world.handleCreate(file);
    f.metadata.set(file.path, { frontmatter: { world_entity: "custom-synced", world_name: "Synthetic import" } });
    if (drainMetadata(f, [file])) refreshRequests++;
    lifecycle.metadataResolved();
  });
  const targets = new EntityRelationshipTargets(() => f.world.index.getAll(), () => f.files.map(file => file.path));
  measure("relationship-candidates-10", () => { for (let i = 0; i < 10; i++) { targets.suggestions(); targets.resolve("Synthetic import"); } });
  measure("graph-projection", () => { buildStoryWorldGraph({ selectedPath: f.files[0].path, entities: f.world.index.getAll(),
    resolve: (reference, source) => f.world.resolveReference(reference, source)?.path ?? null }); });
  measure("timeline-projection", () => { projectStoryWorldTimeline(f.world.index.getAll()); });
  return { markdownFiles: size, initialEntities: size / 5, samples };
}
