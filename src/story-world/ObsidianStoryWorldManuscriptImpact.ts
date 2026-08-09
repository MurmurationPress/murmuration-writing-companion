import { App, TFile } from "obsidian";
import { getChapterContextField, findAliasedProperty } from "../companion/ChapterContext";
import { collectObsidianContinuityReview } from "../manuscript/ObsidianContinuityReview";
import { buildObsidianManuscriptLibrary } from "../manuscript/ObsidianManuscript";
import { observationSourceNotes } from "../observations/ContinuityObservation";
import { manuscriptDisplayTitle, manuscriptSceneMetadata } from "../manuscript/ManuscriptMetadata";
import { ObsidianStoryWorldIndex } from "./ObsidianStoryWorldIndex";
import { parseWikilink, StoryWorldEntityRecord } from "./StoryWorldIndex";
import { projectEntityRelationships, relationshipProperty } from "./EntityRelationships";
import { buildStoryWorldManuscriptImpact, ManuscriptImpactProjection, ManuscriptImpactSceneInput } from "./StoryWorldManuscriptImpact";
import { getWorldEventRelativeTimingPresentation } from "./WorldRelativeTime";
import type { ObsidianManuscriptLibrary } from "../manuscript/ObsidianManuscript";
import type { StoryWorldReviewProjection } from "./StoryWorldReview";

function frontmatter(app: App, file: TFile): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
}

function resolvePath(app: App, reference: unknown, sourcePath: string): string | null {
  const parsed = parseWikilink(reference);
  return parsed ? app.metadataCache.getFirstLinkpathDest(parsed.linkpath, sourcePath)?.path ?? null : null;
}

function values(value: unknown): unknown[] { return Array.isArray(value) ? value : [value]; }

function temporalValue(entity: StoryWorldEntityRecord): { value: unknown; reason: string | null } {
  if (entity.properties.world_time != null) return { value: entity.properties.world_time, reason: null };
  const from = entity.properties.valid_from;
  const until = entity.properties.valid_until ?? entity.properties.valid_to;
  if (from != null || until != null) return { value: { from, until }, reason: null };
  return { value: undefined, reason: "This item has no explicit world_time or validity range; direct and structured impact is still shown." };
}

export function buildObsidianStoryWorldManuscriptImpact(
  app: App,
  storyWorldIndex: ObsidianStoryWorldIndex,
  selected: StoryWorldEntityRecord,
  settledLibrary = buildObsidianManuscriptLibrary(app),
  settledReview?: StoryWorldReviewProjection
): ManuscriptImpactProjection {
  const library: ObsidianManuscriptLibrary = settledLibrary;
  const structuredByScene = new Map<string, Set<string>>();
  const addStructured = (path: string | null, label: string) => {
    if (!path) return;
    const labels = structuredByScene.get(path) ?? new Set<string>();
    labels.add(label); structuredByScene.set(path, labels);
  };
  for (const source of selected.sources) addStructured(resolvePath(app, source, selected.path), "Structured source/support");
  for (const owner of storyWorldIndex.index.getAll()) {
    const relations = projectEntityRelationships(owner.name, owner.properties[relationshipProperty(owner.properties)]);
    for (const relation of relations) {
      const targetPath = relation.objectKind === "target" ? resolvePath(app, relation.objectValue, owner.path) : null;
      if (owner.path !== selected.path && targetPath !== selected.path) continue;
      for (const source of relation.sources) addStructured(resolvePath(app, source, owner.path), "Relationship source/support");
    }
  }
  const participantProperties = [selected.properties.world_participants, selected.properties.participants, selected.properties.world_participant];
  const participantPaths = new Set(participantProperties.flatMap(values).map((reference) => resolvePath(app, reference, selected.path)).filter((path): path is string => Boolean(path)));
  const scenes: ManuscriptImpactSceneInput[] = [];
  for (const book of library.books) {
    const collection = collectObsidianContinuityReview(app, storyWorldIndex, book.file.path, library, settledReview);
    const observations = collection?.observations ?? [];
    for (const [order, entry] of book.result.scenes.entries()) {
      const file = book.filesByPath.get(entry.path);
      if (!file) continue;
      const metadata = frontmatter(app, file);
      const contextPaths = values(metadata?.world_context).map((reference) => resolvePath(app, reference, file.path)).filter((path): path is string => Boolean(path));
      const direct = contextPaths.includes(selected.path);
      if (contextPaths.some((path) => participantPaths.has(path))) addStructured(file.path, "Event participant reference");
      const continuityLabels = observations.filter((observation) => {
        const paths = new Set([observation.primary.path, ...observationSourceNotes(observation).map((note) => note.path)]);
        return paths.has(selected.path) && paths.has(file.path);
      }).map((observation) => observation.summary);
      const part = entry.parentPath && entry.parentPath !== book.file.path
        ? book.result.entries.find((candidate) => candidate.path === entry.parentPath && candidate.kind === "part") ?? null
        : null;
      const sceneMetadata = manuscriptSceneMetadata(metadata);
      const storyDate = findAliasedProperty(metadata, getChapterContextField("story_date").aliases)?.value;
      scenes.push({
        path: file.path,
        title: manuscriptDisplayTitle({ path: file.path, basename: file.basename, frontmatter: metadata }),
        bookPath: book.file.path,
        bookTitle: book.record.title,
        partPath: part?.path ?? null,
        partTitle: part?.title ?? null,
        order,
        pov: sceneMetadata.pov,
        storyDate,
        relativeTimingLabel: selected.entityType.toLowerCase() === "event"
          ? getWorldEventRelativeTimingPresentation(selected, storyDate)?.display ?? null
          : null,
        direct,
        structuredLabels: [...(structuredByScene.get(file.path) ?? [])],
        continuityLabels
      });
    }
  }
  const temporal = temporalValue(selected);
  return buildStoryWorldManuscriptImpact({
    path: selected.path,
    label: selected.name,
    kind: selected.entityType.toLowerCase() === "event" ? "event" : "entity",
    temporalValue: temporal.value,
    temporalUnavailableReason: temporal.reason
  }, scenes);
}
