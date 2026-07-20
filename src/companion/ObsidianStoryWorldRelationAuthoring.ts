import { App, MarkdownView, TFile } from "obsidian";
import {
  getChapterContextField,
  getEditableChapterContextValue,
  normalizePropertyName
} from "./ChapterContext";
import { findProseWikilinks } from "./ProseWikilinkChanges";
import {
  buildStoredStoryWorldRelationship,
  StoryWorldRelationDecision,
  StoryWorldRelationProposal
} from "./StoryWorldRelationAuthoring";
import { parseWikilink } from "../story-world/StoryWorldIndex";

export class StaleStoryWorldRelationError extends Error {
  constructor(message = "The prose link or chapter POV changed before the relationship could be recorded. Try again.") {
    super(message);
    this.name = "StaleStoryWorldRelationError";
  }
}

export class InvalidWorldRelationshipsError extends Error {
  constructor() {
    super("The source entity's world_relationships property is not a list and was left unchanged.");
    this.name = "InvalidWorldRelationshipsError";
  }
}

export class InvalidRelationWorldContextError extends Error {
  constructor() {
    super("The chapter's world_context property is not a string or list and was left unchanged.");
    this.name = "InvalidRelationWorldContextError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalized(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|", 1)[0]
    .split("#", 1)[0]
    .replace(/\.md$/i, "")
    .toLowerCase();
}

function findNormalizedProperty(
  frontmatter: Record<string, unknown>,
  expectedName: string
): string {
  const expected = normalizePropertyName(expectedName);
  return Object.keys(frontmatter).find((property) => (
    property !== "position" && normalizePropertyName(property) === expected
  )) ?? expectedName;
}

function openChapterText(app: App, chapter: TFile): string | null {
  let text: string | null = null;
  app.workspace.iterateRootLeaves((leaf) => {
    if (text !== null) return;
    if (leaf.view instanceof MarkdownView && leaf.view.file?.path === chapter.path) {
      text = leaf.view.editor.getValue();
    }
  });
  return text;
}

async function currentChapterText(app: App, chapter: TFile): Promise<string> {
  return openChapterText(app, chapter) ?? await app.vault.cachedRead(chapter);
}

function resolvesToFile(
  app: App,
  source: TFile,
  reference: unknown,
  destination: TFile
): boolean {
  const parsed = parseWikilink(reference);
  if (!parsed) return false;
  const resolved = app.metadataCache.getFirstLinkpathDest(parsed.linkpath, source.path);
  if (resolved?.path === destination.path) return true;

  const target = normalized(parsed.linkpath);
  const fullPath = normalized(destination.path);
  if (target === fullPath) return true;
  const basename = normalized(destination.basename);
  const ambiguous = app.vault.getMarkdownFiles().some((candidate) => (
    candidate.path !== destination.path
    && normalized(candidate.basename) === basename
  ));
  return !ambiguous && target === basename;
}

function scalarOrList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function relationSourcesChapter(
  app: App,
  sourceEntity: TFile,
  relation: Record<string, unknown>,
  chapter: TFile
): boolean {
  return scalarOrList(relation.source).some((source) => (
    resolvesToFile(app, sourceEntity, source, chapter)
  ));
}

function currentRelation(relation: Record<string, unknown>): boolean {
  return typeof relation.status !== "string"
    || relation.status.trim().toLowerCase() !== "superseded";
}

function relationTargetsFile(
  app: App,
  sourceEntity: TFile,
  relation: Record<string, unknown>,
  targetEntity: TFile
): boolean {
  return resolvesToFile(app, sourceEntity, relation.target, targetEntity);
}

function relationshipValues(
  frontmatter: Record<string, unknown>
): { property: string; values: unknown[] } {
  const property = findNormalizedProperty(frontmatter, "world_relationships");
  const current = frontmatter[property];
  if (current === undefined || current === null) return { property, values: [] };
  if (!Array.isArray(current)) throw new InvalidWorldRelationshipsError();
  return { property, values: [...current] };
}

function relationEquivalent(
  app: App,
  sourceEntity: TFile,
  targetEntity: TFile,
  proposal: StoryWorldRelationProposal,
  decision: StoryWorldRelationDecision,
  value: unknown
): boolean {
  if (!isRecord(value) || !currentRelation(value)) return false;
  if (typeof value.predicate !== "string") return false;
  if (value.predicate.trim().toLowerCase() !== decision.predicate.trim().toLowerCase()) {
    return false;
  }
  if (!relationTargetsFile(app, sourceEntity, value, targetEntity)) return false;

  const existingAsOf = typeof value.as_of === "string" ? value.as_of.trim() : null;
  return existingAsOf === proposal.storyDate;
}

async function assertSourceState(
  app: App,
  chapter: TFile,
  sourceEntity: TFile,
  targetEntity: TFile,
  proposal: StoryWorldRelationProposal
): Promise<void> {
  const text = await currentChapterText(app, chapter);
  const occurrence = findProseWikilinks(text).find((link) => (
    link.raw === proposal.sourceRawLink
    && link.linkpath === proposal.sourceLinkpath
  ));
  if (!occurrence) throw new StaleStoryWorldRelationError();

  const resolvedTarget = app.metadataCache.getFirstLinkpathDest(
    occurrence.linkpath,
    chapter.path
  );
  if (resolvedTarget?.path !== targetEntity.path) {
    throw new StaleStoryWorldRelationError(
      "The prose link now resolves to a different note. Review it before recording a relationship."
    );
  }

  const frontmatter = app.metadataCache.getFileCache(chapter)?.frontmatter as
    Record<string, unknown> | undefined;
  const pov = getEditableChapterContextValue(
    frontmatter,
    getChapterContextField("pov")
  ).value.trim();
  const parsedPov = parseWikilink(pov);
  if (parsedPov) {
    const resolvedPov = app.metadataCache.getFirstLinkpathDest(
      parsedPov.linkpath,
      chapter.path
    );
    if (resolvedPov?.path === sourceEntity.path) return;
  } else {
    const key = normalized(pov);
    if (proposal.sourceEntityLookupValues.some((value) => normalized(value) === key)) {
      return;
    }
  }
  throw new StaleStoryWorldRelationError();
}

export function hasCurrentStoryWorldRelationForChapter(
  app: App,
  sourceEntity: TFile,
  targetEntity: TFile,
  chapter: TFile,
  sourceRawLink: string
): boolean {
  const frontmatter = app.metadataCache.getFileCache(sourceEntity)?.frontmatter as
    Record<string, unknown> | undefined;
  if (!frontmatter) return false;
  const property = findNormalizedProperty(frontmatter, "world_relationships");
  const values = frontmatter[property];
  if (!Array.isArray(values)) return false;

  return values.some((value) => {
    if (!isRecord(value) || !currentRelation(value)) return false;
    if (!relationTargetsFile(app, sourceEntity, value, targetEntity)) return false;
    if (!relationSourcesChapter(app, sourceEntity, value, chapter)) return false;
    return typeof value.source_link !== "string"
      || value.source_link.trim() === sourceRawLink.trim();
  });
}

export async function appendStoryWorldRelation(
  app: App,
  chapter: TFile,
  sourceEntity: TFile,
  targetEntity: TFile,
  proposal: StoryWorldRelationProposal,
  decision: StoryWorldRelationDecision
): Promise<boolean> {
  await assertSourceState(app, chapter, sourceEntity, targetEntity, proposal);
  let changed = false;

  await app.fileManager.processFrontMatter(sourceEntity, (frontmatter) => {
    if (typeof frontmatter.world_entity !== "string" || !frontmatter.world_entity.trim()) {
      throw new Error("The relationship source is no longer a Story World entity.");
    }
    const { property, values } = relationshipValues(frontmatter);
    if (values.some((value) => relationEquivalent(
      app,
      sourceEntity,
      targetEntity,
      proposal,
      decision,
      value
    ))) {
      return;
    }

    values.push(buildStoredStoryWorldRelationship(proposal, decision));
    frontmatter[property] = values;
    changed = true;
  });

  return changed;
}

function worldContextValues(
  frontmatter: Record<string, unknown>
): { property: string; values: unknown[] } {
  const property = findNormalizedProperty(frontmatter, "world_context");
  const current = frontmatter[property];
  if (current === undefined || current === null) return { property, values: [] };
  if (Array.isArray(current)) return { property, values: [...current] };
  if (typeof current === "string") return { property, values: [current] };
  throw new InvalidRelationWorldContextError();
}

export function storyWorldEntityInWorldContext(
  app: App,
  chapter: TFile,
  entity: TFile
): boolean {
  const frontmatter = app.metadataCache.getFileCache(chapter)?.frontmatter as
    Record<string, unknown> | undefined;
  if (!frontmatter) return false;
  const property = findNormalizedProperty(frontmatter, "world_context");
  const current = frontmatter[property];
  const values = current === undefined || current === null
    ? []
    : Array.isArray(current)
      ? current
      : typeof current === "string"
        ? [current]
        : [];
  return values.some((value) => resolvesToFile(app, chapter, value, entity));
}

export async function addStoryWorldEntityToWorldContext(
  app: App,
  chapter: TFile,
  entity: TFile,
  reference: string,
  sourceRawLink: string
): Promise<boolean> {
  const text = await currentChapterText(app, chapter);
  const occurrence = findProseWikilinks(text).find((link) => (
    link.raw === sourceRawLink
  ));
  if (!occurrence) throw new StaleStoryWorldRelationError();
  const resolved = app.metadataCache.getFirstLinkpathDest(occurrence.linkpath, chapter.path);
  if (resolved?.path !== entity.path) throw new StaleStoryWorldRelationError();

  let changed = false;
  await app.fileManager.processFrontMatter(chapter, (frontmatter) => {
    const { property, values } = worldContextValues(frontmatter);
    if (values.some((value) => resolvesToFile(app, chapter, value, entity))) return;
    values.push(reference);
    frontmatter[property] = values;
    changed = true;
  });
  return changed;
}
