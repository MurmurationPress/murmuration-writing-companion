import { App, MarkdownView, TFile, TFolder } from "obsidian";
import { normalizePropertyName } from "./ChapterContext";
import { findProseWikilinks } from "./ProseWikilinkChanges";
import {
  buildStoryWorldEventMarkdown,
  StoryWorldEventCreationProposal,
  StoryWorldEventDateDecision
} from "./StoryWorldEventCreation";
import { parseWikilink } from "../story-world/StoryWorldIndex";

export class StaleStoryWorldEventCreationError extends Error {
  constructor() {
    super("The source wikilink changed before the event could be created. Try again.");
    this.name = "StaleStoryWorldEventCreationError";
  }
}

export class StoryWorldEventPathConflictError extends Error {
  constructor(path: string) {
    super(`A vault item already exists at ${path}. Edit the prose link or reopen the preview.`);
    this.name = "StoryWorldEventPathConflictError";
  }
}

export class InvalidWorldContextError extends Error {
  constructor() {
    super("The chapter's world_context property is not a string or list and was left unchanged.");
    this.name = "InvalidWorldContextError";
  }
}

function findCaseInsensitivePath(app: App, path: string) {
  const key = path.toLowerCase();
  return app.vault.getAllLoadedFiles().find((file) => file.path.toLowerCase() === key) ?? null;
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) return;
  let current = "";

  for (const segment of normalized.split("/")) {
    current = current ? `${current}/${segment}` : segment;
    const existing = findCaseInsensitivePath(app, current);
    if (existing) {
      if (!(existing instanceof TFolder)) throw new StoryWorldEventPathConflictError(current);
      continue;
    }
    await app.vault.createFolder(current);
  }
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

async function assertSourceLinkStillPresent(
  app: App,
  chapter: TFile,
  proposal: Pick<StoryWorldEventCreationProposal, "sourceRawLink" | "sourceLinkpath">
): Promise<void> {
  const text = await currentChapterText(app, chapter);
  const present = findProseWikilinks(text).some((link) => (
    link.raw === proposal.sourceRawLink
    && link.linkpath === proposal.sourceLinkpath
  ));
  if (!present) throw new StaleStoryWorldEventCreationError();
}

export async function createStoryWorldEventFromProposal(
  app: App,
  chapter: TFile,
  proposal: StoryWorldEventCreationProposal,
  decision: StoryWorldEventDateDecision
): Promise<TFile> {
  await assertSourceLinkStillPresent(app, chapter, proposal);
  if (findCaseInsensitivePath(app, proposal.path)) {
    throw new StoryWorldEventPathConflictError(proposal.path);
  }

  const slash = proposal.path.lastIndexOf("/");
  if (slash >= 0) await ensureFolder(app, proposal.path.slice(0, slash));
  const markdown = buildStoryWorldEventMarkdown(proposal, decision);
  const created = await app.vault.create(proposal.path, markdown);

  try {
    const written = await app.vault.cachedRead(created);
    if (written !== markdown) throw new Error("The created event note did not verify after writing.");
    return created;
  } catch (error) {
    try {
      await app.vault.delete(created);
    } catch {
      // Leave a visible file rather than masking a failed rollback.
    }
    throw error;
  }
}

function worldContextProperty(frontmatter: Record<string, unknown>): string {
  const expected = normalizePropertyName("world_context");
  return Object.keys(frontmatter).find((property) => (
    property !== "position" && normalizePropertyName(property) === expected
  )) ?? "world_context";
}

function basenameWithoutExtension(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

function hasOtherBasename(app: App, eventFile: TFile): boolean {
  const basename = eventFile.basename.toLowerCase();
  return app.vault.getMarkdownFiles().some((candidate) => (
    candidate.path !== eventFile.path && candidate.basename.toLowerCase() === basename
  ));
}

function referencesEvent(
  app: App,
  chapter: TFile,
  reference: unknown,
  eventFile: TFile
): boolean {
  const parsed = parseWikilink(reference);
  if (!parsed) return false;
  const destination = app.metadataCache.getFirstLinkpathDest(parsed.linkpath, chapter.path);
  if (destination?.path === eventFile.path) return true;

  const target = parsed.linkpath.replace(/\\/g, "/").replace(/\.md$/i, "").toLowerCase();
  const fullPath = eventFile.path.replace(/\.md$/i, "").toLowerCase();
  if (target === fullPath) return true;
  return !hasOtherBasename(app, eventFile)
    && target === basenameWithoutExtension(eventFile.path).toLowerCase();
}

export async function addStoryWorldEventToWorldContext(
  app: App,
  chapter: TFile,
  eventFile: TFile,
  reference: string,
  sourceRawLink: string
): Promise<boolean> {
  await assertSourceLinkStillPresent(app, chapter, {
    sourceRawLink,
    sourceLinkpath: parseWikilink(sourceRawLink)?.linkpath ?? ""
  });

  let changed = false;
  await app.fileManager.processFrontMatter(chapter, (frontmatter) => {
    const property = worldContextProperty(frontmatter);
    const current = frontmatter[property];
    const values: unknown[] = current === undefined || current === null
      ? []
      : Array.isArray(current)
        ? [...current]
        : typeof current === "string"
          ? [current]
          : (() => { throw new InvalidWorldContextError(); })();

    if (values.some((value) => referencesEvent(app, chapter, value, eventFile))) return;
    values.push(reference);
    frontmatter[property] = values;
    changed = true;
  });
  return changed;
}
