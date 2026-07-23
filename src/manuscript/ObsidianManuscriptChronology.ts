import { App, TFile } from "obsidian";
import { MANUSCRIPT_PARENT_ALIASES } from "../editorial/BookReview";
import { findAliasedProperty, getChapterContextField } from "../companion/ChapterContext";
import {
  ContinuityObservation,
  ObservationEvidence,
  ObservationNoteReference
} from "../observations/ContinuityObservation";
import {
  evaluateManuscriptChronology,
  manuscriptChronologyOrderIsSafe,
  OrderedSceneChronologyInput
} from "../observations/ManuscriptChronology";
import { MANUSCRIPT_ORDER_KEY_PROPERTY } from "./ManuscriptOrderKey";
import {
  buildObsidianManuscriptLibrary,
  ObsidianManuscriptBook
} from "./ObsidianManuscript";
import { readableSceneLabel } from "../companion/ContinuityCardPresentation";

export interface ObsidianManuscriptChronologyResult {
  readonly book: TFile | null;
  readonly observations: readonly ContinuityObservation[];
  readonly dependencies: ReadonlySet<string>;
}

function frontmatterFor(app: App, file: TFile): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
}

function findProperty(
  frontmatter: Record<string, unknown> | undefined,
  aliases: readonly string[]
): { property: string; value: unknown } {
  return findAliasedProperty(frontmatter, aliases)
    ?? { property: aliases[0], value: undefined };
}

function note(file: TFile): ObservationNoteReference {
  return { role: "manuscript", path: file.path, label: file.basename };
}

function sceneNote(app: App, file: TFile): ObservationNoteReference {
  return {
    role: "manuscript",
    path: file.path,
    label: readableSceneLabel(frontmatterFor(app, file), file.basename)
  };
}

function sequenceEvidence(
  app: App,
  book: ObsidianManuscriptBook,
  sceneFile: TFile,
  parentPath: string
): ObservationEvidence[] {
  const result: ObservationEvidence[] = [];
  const append = (file: TFile, rolePrefix: string) => {
    const frontmatter = frontmatterFor(app, file);
    const parent = findProperty(frontmatter, MANUSCRIPT_PARENT_ALIASES);
    const parentFile = book.filesByPath.get(
      file.path === sceneFile.path ? parentPath : book.record.path
    );
    result.push({
      role: `${rolePrefix}_parent`,
      source: { note: note(file), property: [parent.property] },
      value: parentFile
        ? { kind: "resolved_note", note: note(parentFile) }
        : { kind: "value", value: String(parent.value ?? "") }
    });
    result.push({
      role: `${rolePrefix}_order_key`,
      source: { note: note(file), property: [MANUSCRIPT_ORDER_KEY_PROPERTY] },
      value: { kind: "value", value: String(frontmatter?.[MANUSCRIPT_ORDER_KEY_PROPERTY] ?? "") }
    });
  };
  const parent = book.filesByPath.get(parentPath);
  if (parent && parent.path !== book.file.path) append(parent, "part");
  append(sceneFile, "scene");
  return result;
}

function sceneInput(
  app: App,
  book: ObsidianManuscriptBook,
  path: string,
  parentPath: string
): OrderedSceneChronologyInput | null {
  const file = book.filesByPath.get(path);
  const parent = book.filesByPath.get(parentPath);
  if (!file || !parent) return null;
  const frontmatter = frontmatterFor(app, file);
  const storyDate = findProperty(frontmatter, getChapterContextField("story_date").aliases);
  const scene = sceneNote(app, file);
  return {
    scene,
    parent: note(parent),
    sequenceEvidence: sequenceEvidence(app, book, file, parentPath),
    storyDate: {
      source: { note: scene, property: [storyDate.property] },
      raw: storyDate.value
    }
  };
}

export function buildObsidianManuscriptChronology(
  app: App,
  activeFile: TFile
): ObsidianManuscriptChronologyResult {
  const library = buildObsidianManuscriptLibrary(app);
  const bookPath = library.owningBookPathByFile.get(activeFile.path);
  const book = library.books.find((candidate) => candidate.file.path === bookPath) ?? null;
  if (!book) return { book: null, observations: [], dependencies: new Set([activeFile.path]) };
  return buildObsidianManuscriptChronologyForBook(app, book);
}

export function buildObsidianManuscriptChronologyForBook(
  app: App,
  book: ObsidianManuscriptBook
): ObsidianManuscriptChronologyResult {
  const dependencies = new Set(book.filesByPath.keys());
  dependencies.add(book.file.path);
  if (!manuscriptChronologyOrderIsSafe(book.result)) {
    return { book: book.file, observations: [], dependencies };
  }
  const scenes = book.result.scenes
    .map((scene) => sceneInput(app, book, scene.path, scene.parentPath ?? book.file.path))
    .filter((scene): scene is OrderedSceneChronologyInput => scene !== null);
  return {
    book: book.file,
    dependencies,
    observations: evaluateManuscriptChronology({ book: note(book.file), scenes })
  };
}
