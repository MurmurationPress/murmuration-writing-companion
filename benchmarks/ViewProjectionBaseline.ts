import { evenlySpacedManuscriptOrderKeys } from "../src/manuscript/ManuscriptOrderKey";
import { performance } from "node:perf_hooks";
import { syntheticVault } from "./RuntimeBaseline";
import { ManuscriptProjectionService } from "../src/manuscript/ManuscriptProjection";
import { collectObsidianContinuityReview } from "../src/manuscript/ObsidianContinuityReview";
import { buildObsidianStoryWorldManuscriptImpact } from "../src/story-world/ObsidianStoryWorldManuscriptImpact";
import { buildObsidianStoryWorldGraph } from "../src/story-world/ObsidianStoryWorldGraph";
import { projectStoryWorldTimeline } from "../src/story-world/StoryWorldTimeline";

/** Actual adapter/projection work with synthetic metadata, not DOM or editor latency. */
export function runtimeBaseline(size: number) {
  const f = syntheticVault(size);
  const book = f.files[1], part = f.files[2];
  const keys = evenlySpacedManuscriptOrderKeys(size);
  f.metadata.set(book.path, { frontmatter: { type: "book", title: "Synthetic book" } });
  f.metadata.set(part.path, { frontmatter: { type: "part", parent: `[[${book.path}]]`, manuscript_order_key: keys[2] } });
  for (let i = 3; i < size; i++) {
    if (i % 5 === 0) continue;
    f.metadata.set(f.files[i].path, { frontmatter: { type: "scene", title: f.files[i].basename,
      parent: `[[${part.path}]]`, manuscript_order_key: keys[i],
      world_context: ["[[Synthetic 00000]]"], story_date: "2030-01-01" } });
  }
  f.world.rebuild();
  const manuscript = new ManuscriptProjectionService(f.app);
  const samples: { stage: string; counts: typeof f.counts; refreshRequests: number; elapsedMs: number }[] = [];
  const measure = (stage: string, action: () => void) => {
    const before = { ...f.counts }, start = performance.now(); action();
    samples.push({ stage, counts: Object.fromEntries(Object.entries(f.counts).map(([key, value]) =>
      [key, value - before[key as keyof typeof before]])) as typeof f.counts,
      refreshRequests: 0, elapsedMs: Number((performance.now() - start).toFixed(3)) });
  };
  measure("manuscript-cold", () => { manuscript.get(); });
  const library = manuscript.get();
  const sceneCount = library.books.reduce((n, b) => n + b.result.scenes.length, 0);
  if (library.books.length !== 1 || sceneCount !== size * 0.8 - 2) throw new Error("Synthetic manuscript fixture failed recognition");
  if (library.books[0].result.source !== "distributed" || library.books[0].result.diagnostics.length) throw new Error("Synthetic manuscript must have valid distributed order");
  measure("manuscript-warm-10", () => { for (let i = 0; i < 10; i++) manuscript.get(); });
  measure("manuscript-settled-rebuild", () => { manuscript.rebuild(); });
  measure("review-cold-with-manuscript", () => { f.review.get(); });
  const review = f.review.get(), entity = f.world.index.getByPath(f.files[0].path)!;
  measure("continuity-collection", () => { collectObsidianContinuityReview(f.app, f.world, book.path, library, review); });
  measure("inspector-impact", () => { buildObsidianStoryWorldManuscriptImpact(f.app, f.world, entity, library, review); });
  measure("graph-adapter", () => { buildObsidianStoryWorldGraph(f.app, f.world, book.path, { selectedPath: entity.path }, library, review); });
  measure("timeline-projection", () => { projectStoryWorldTimeline(f.world.index.getAll()); });
  return { markdownFiles: size, initialEntities: size / 5, books: library.books.length, scenes: sceneCount, samples };
}
