import { App, TFile } from "obsidian";
import { manuscriptChronologyOrderIsSafe } from "../observations/ManuscriptChronology";
import { buildObsidianManuscriptLibrary } from "./ObsidianManuscript";
import {
  ManuscriptStoryDateOffer,
  ManuscriptStoryDateOfferSnapshot,
  manuscriptStoryDateOffer,
  sameManuscriptStoryDateOffer,
  applyManuscriptStoryDateOffer
} from "./ManuscriptStoryDateOffer";

export interface ManuscriptStoryDateOfferHost {
  readonly app: App;
  getCurrentChapter(): TFile | null;
  refreshManuscriptBookAfterStructuralChange(bookPath: string): void;
}

export class StaleManuscriptStoryDateOfferError extends Error {
  constructor() {
    super("Manuscript chronology changed before confirmation. Review the updated preceding-date offer.");
  }
}

function frontmatter(app: App, file: TFile): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
}

export function snapshotObsidianManuscriptStoryDateOffer(
  host: ManuscriptStoryDateOfferHost,
  target: TFile
): ManuscriptStoryDateOfferSnapshot | null {
  // Clicking an action in the Writing Companion makes its sidebar leaf active,
  // so getActiveViewOfType(MarkdownView) is null at the moment of acceptance.
  // The plugin's current chapter follows actual file-open changes without being
  // invalidated by focus moving from the editor to its companion controls.
  const active = host.getCurrentChapter();
  if (!active || active.path !== target.path) return null;
  const library = buildObsidianManuscriptLibrary(host.app);
  const bookPath = library.owningBookPathByFile.get(target.path);
  const book = library.books.find((candidate) => candidate.file.path === bookPath);
  if (!book) return null;
  const targetPosition = book.result.scenes.findIndex((scene) => scene.path === target.path);
  const targetEntry = targetPosition >= 0 ? book.result.scenes[targetPosition] : null;
  if (!targetEntry || !targetEntry.parentPath || !targetEntry.orderKey) return null;
  return {
    activePath: active.path,
    targetPath: target.path,
    targetTitle: targetEntry.title || target.basename,
    targetParentPath: targetEntry.parentPath,
    targetOrderKey: targetEntry.orderKey,
    targetPosition,
    targetMtime: target.stat.mtime,
    targetSize: target.stat.size,
    targetFrontmatter: frontmatter(host.app, target),
    bookPath: book.file.path,
    structurallySafe: manuscriptChronologyOrderIsSafe(book.result),
    orderedScenes: book.result.scenes.map((scene) => {
      const file = book.filesByPath.get(scene.path);
      return { path: scene.path, title: scene.title || file?.basename || scene.path, frontmatter: file ? frontmatter(host.app, file) : undefined };
    }),
    sourceFileStateByPath: new Map(book.result.scenes.flatMap((scene) => {
      const file = book.filesByPath.get(scene.path);
      return file ? [[scene.path, { mtime: file.stat.mtime, size: file.stat.size }] as const] : [];
    }))
  };
}

export function getObsidianManuscriptStoryDateOffer(
  host: ManuscriptStoryDateOfferHost,
  target: TFile
): ManuscriptStoryDateOffer | null {
  const snapshot = snapshotObsidianManuscriptStoryDateOffer(host, target);
  return snapshot ? manuscriptStoryDateOffer(snapshot) : null;
}

export async function acceptObsidianManuscriptStoryDateOffer(
  host: ManuscriptStoryDateOfferHost,
  reviewed: ManuscriptStoryDateOffer
): Promise<void> {
  const active = host.getCurrentChapter();
  if (!active || active.path !== reviewed.targetPath) throw new StaleManuscriptStoryDateOfferError();
  const current = getObsidianManuscriptStoryDateOffer(host, active);
  if (!sameManuscriptStoryDateOffer(reviewed, current)) throw new StaleManuscriptStoryDateOfferError();
  let wrote = false;
  await host.app.fileManager.processFrontMatter(active, (targetFrontmatter) => {
    try { applyManuscriptStoryDateOffer(targetFrontmatter, reviewed.value); }
    catch { throw new StaleManuscriptStoryDateOfferError(); }
    wrote = true;
  });
  if (!wrote) throw new StaleManuscriptStoryDateOfferError();
  host.refreshManuscriptBookAfterStructuralChange(reviewed.bookPath);
}
