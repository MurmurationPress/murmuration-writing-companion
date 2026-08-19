import type { App, TFile } from "obsidian";
import type { ObsidianStoryWorldIndex } from "../story-world/ObsidianStoryWorldIndex";
import { StoryWorldEntityRecord } from "../story-world/StoryWorldIndex";
import {
  planWorldContextAddition,
  planWorldContextRemoval,
  WorldContextMutationPlan
} from "../story-world/WorldContextAuthoring";

function currentIndexedEntity(
  index: ObsidianStoryWorldIndex,
  entity: StoryWorldEntityRecord
): StoryWorldEntityRecord {
  const current = index.index.getByPath(entity.path);
  if (!current) throw new Error("The selected Story World entity is no longer indexed.");
  return current;
}

async function applyPlan(
  app: App,
  index: ObsidianStoryWorldIndex,
  scene: TFile,
  entity: StoryWorldEntityRecord,
  plan: (
    frontmatter: Readonly<Record<string, unknown>>,
    current: StoryWorldEntityRecord,
    resolve: (reference: string) => StoryWorldEntityRecord | null
  ) => WorldContextMutationPlan
): Promise<boolean> {
  let changed = false;
  await app.fileManager.processFrontMatter(scene, (frontmatter) => {
    const current = currentIndexedEntity(index, entity);
    const mutation = plan(
      frontmatter,
      current,
      (reference) => index.resolveWikilink(reference, scene.path)
    );
    if (!mutation.changed) return;
    if (mutation.values.length === 0) {
      delete frontmatter[mutation.property];
    } else {
      frontmatter[mutation.property] = [...mutation.values];
    }
    changed = true;
  });
  return changed;
}

export function addIndexedEntityToWorldContext(
  app: App,
  index: ObsidianStoryWorldIndex,
  scene: TFile,
  entity: StoryWorldEntityRecord
): Promise<boolean> {
  return applyPlan(app, index, scene, entity, planWorldContextAddition);
}

export function removeIndexedEntityFromWorldContext(
  app: App,
  index: ObsidianStoryWorldIndex,
  scene: TFile,
  entity: StoryWorldEntityRecord
): Promise<boolean> {
  return applyPlan(app, index, scene, entity, planWorldContextRemoval);
}
