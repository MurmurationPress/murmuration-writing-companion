import { App, parseYaml, TFile } from "obsidian";
import {
  BOOK_REFERENCE_ALIASES,
  normalizeBookPropertyName
} from "../editorial/BookReview";
import { parseWikilink } from "../story-world/StoryWorldIndex";
import type { ManuscriptBookSelectionService } from "./ManuscriptBookSelection";
import { buildObsidianManuscriptLibrary } from "./ObsidianManuscript";
import { boundedManuscriptRecognition } from "./ObsidianManuscriptNoteCreation";
import {
  applyManuscriptSceneDetachment,
  captureDetachmentRelevantFrontmatter,
  markdownBody,
  ManuscriptSceneDetachmentPlan,
  ManuscriptSceneDetachmentSnapshot,
  planManuscriptSceneDetachment,
  revalidateManuscriptSceneDetachment,
  sameDetachmentRelevantFrontmatter
} from "./ManuscriptSceneDetachment";
import { isExplicitlyDetachedScene } from "./ManuscriptMetadata";

export interface ManuscriptSceneDetachmentAuthority {
  readonly app: App;
  readonly manuscriptBookSelection: ManuscriptBookSelectionService;
}

export class StaleManuscriptSceneDetachmentError extends Error {
  constructor(message = "The Scene changed before it could be removed. Review the preview again.") {
    super(message);
    this.name = "StaleManuscriptSceneDetachmentError";
  }
}

export class ManuscriptSceneDetachmentConflictError extends Error {
  constructor(path: string) {
    super(`Resolve sync or Git conflict markers before removing this Scene: ${path}`);
    this.name = "ManuscriptSceneDetachmentConflictError";
  }
}

export interface ManuscriptSceneDetachmentResult {
  readonly status: "detached" | "recognition-delayed" | "verification-failed";
  readonly file: TFile;
  readonly fallbackPath: string;
}

const inFlight = new WeakMap<object, Map<string, Promise<ManuscriptSceneDetachmentResult>>>();

function hasConflictMarkers(content: string): boolean {
  return /^(?:<{7}|={7}|>{7})(?:\s|$)/m.test(content);
}

async function hash(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function frontmatterFromMarkdown(content: string): Record<string, unknown> {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/);
  if (!match) return {};
  const parsed = parseYaml(match[1]);
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown> : {};
}

function frontmatter(host: ManuscriptSceneDetachmentAuthority, file: TFile): Record<string, unknown> {
  return (host.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined) ?? {};
}

function referencedBookProperties(app: App, file: TFile, values: Readonly<Record<string, unknown>>, bookPath: string): string[] {
  const names = new Set(BOOK_REFERENCE_ALIASES.map(normalizeBookPropertyName));
  const result: string[] = [];
  for (const [property, raw] of Object.entries(values)) {
    if (!names.has(normalizeBookPropertyName(property))) continue;
    const references = Array.isArray(raw) ? raw : [raw];
    if (references.some((value) => {
      if (typeof value !== "string") return false;
      const parsed = parseWikilink(value);
      const linkpath = parsed?.linkpath ?? value.trim();
      return Boolean(linkpath && app.metadataCache.getFirstLinkpathDest(linkpath, file.path)?.path === bookPath);
    })) result.push(property);
  }
  return result;
}

async function snapshotFor(
  host: ManuscriptSceneDetachmentAuthority,
  scenePath: string,
  expectedBookPath?: string
): Promise<ManuscriptSceneDetachmentSnapshot> {
  const file = host.app.vault.getAbstractFileByPath(scenePath);
  if (!(file instanceof TFile)) throw new StaleManuscriptSceneDetachmentError("The Scene note no longer exists.");
  const selection = host.manuscriptBookSelection.get();
  const library = buildObsidianManuscriptLibrary(host.app);
  const book = library.books.find((candidate) => candidate.file.path === (expectedBookPath ?? selection.bookPath));
  if (!book) throw new StaleManuscriptSceneDetachmentError("The owning Book is no longer available.");
  const content = await host.app.vault.read(file);
  const values = frontmatter(host, file);
  return {
    selectedBookPath: selection.bookPath,
    selectedContextPath: selection.contextPath,
    selectionRevision: selection.revision,
    bookPath: book.file.path,
    bookTitle: book.record.title,
    source: book.result.source,
    structuralErrors: book.result.diagnostics.map((diagnostic) => diagnostic.message),
    entries: [book.record, ...book.result.entries].map((entry) => ({
      path: entry.path,
      title: entry.title,
      kind: entry.kind as "book" | "part" | "scene",
      parentPath: entry.parentPath,
      orderKey: entry.orderKey ?? null
    })),
    scenePath,
    frontmatter: values,
    authoritativeBookProperties: referencedBookProperties(host.app, file, values, book.file.path),
    mtime: file.stat.mtime,
    size: file.stat.size,
    sourceHash: await hash(content)
  };
}

export async function planObsidianManuscriptSceneDetachment(
  host: ManuscriptSceneDetachmentAuthority,
  scenePath: string,
  bookPath?: string
): Promise<ManuscriptSceneDetachmentPlan> {
  return planManuscriptSceneDetachment(await snapshotFor(host, scenePath, bookPath));
}

async function verifyRecognition(host: ManuscriptSceneDetachmentAuthority, plan: ManuscriptSceneDetachmentPlan) {
  return boundedManuscriptRecognition(() => {
    const file = host.app.vault.getAbstractFileByPath(plan.path);
    if (!(file instanceof TFile)) return "structurally-invalid";
    const values = frontmatter(host, file);
    if (!isExplicitlyDetachedScene(values)) return "pending";
    const book = buildObsidianManuscriptLibrary(host.app).books.find((candidate) => candidate.file.path === plan.bookPath);
    if (!book) return "structurally-invalid";
    return book.result.entries.some((entry) => entry.path === plan.path)
      || book.result.diagnostics.some((diagnostic) => diagnostic.path === plan.path)
      ? "structurally-invalid" : "recognised";
  });
}

function currentFallbackPath(host: ManuscriptSceneDetachmentAuthority, plan: ManuscriptSceneDetachmentPlan): string {
  const book = buildObsidianManuscriptLibrary(host.app).books.find((candidate) => candidate.file.path === plan.bookPath);
  if (!book) return plan.bookPath;
  const entries = book.result.entries;
  const validSibling = (path: string | undefined) => entries.some((entry) => (
    entry.path === path && (entry.parentPath ?? plan.bookPath) === plan.parentPath
  ));
  if (validSibling(plan.next?.path)) return plan.next!.path;
  if (validSibling(plan.previous?.path)) return plan.previous!.path;
  if (plan.parentKind === "part" && entries.some((entry) => entry.path === plan.parentPath && entry.kind === "part")) return plan.parentPath;
  return plan.bookPath;
}

export function detachObsidianManuscriptScene(
  host: ManuscriptSceneDetachmentAuthority,
  preview: ManuscriptSceneDetachmentPlan
): Promise<ManuscriptSceneDetachmentResult> {
  let requests = inFlight.get(host);
  if (!requests) { requests = new Map(); inFlight.set(host, requests); }
  const key = preview.path.replace(/\\/g, "/").toLocaleLowerCase("en-US");
  const existing = requests.get(key);
  if (existing) return existing;

  const request: Promise<ManuscriptSceneDetachmentResult> = (async () => {
    if (preview.errors.length > 0) throw new StaleManuscriptSceneDetachmentError(preview.errors[0]);
    const file = host.app.vault.getAbstractFileByPath(preview.path);
    if (!(file instanceof TFile)) throw new StaleManuscriptSceneDetachmentError("The Scene note no longer exists.");
    const originalContent = await host.app.vault.read(file);
    if (hasConflictMarkers(originalContent)) throw new ManuscriptSceneDetachmentConflictError(file.path);
    if (await hash(originalContent) !== preview.sourceHash) throw new StaleManuscriptSceneDetachmentError();

    const currentSnapshot = await snapshotFor(host, preview.path, preview.bookPath);
    const current = revalidateManuscriptSceneDetachment(preview, currentSnapshot);
    if (current.errors.length > 0) throw new StaleManuscriptSceneDetachmentError(current.errors[0]);
    const beforeFrontmatter = frontmatterFromMarkdown(originalContent);
    let attemptedRelevant: Readonly<Record<string, unknown>> | null = null;
    let attemptedContentHash: string | null = null;

    try {
      await host.app.fileManager.processFrontMatter(file, (values) => {
        if (file.stat.mtime !== preview.mtime || file.stat.size !== preview.size) throw new StaleManuscriptSceneDetachmentError();
        const relevant = captureDetachmentRelevantFrontmatter(values, preview.bookProperties);
        if (!sameDetachmentRelevantFrontmatter(relevant, preview.relevantFrontmatter)) throw new StaleManuscriptSceneDetachmentError();
        applyManuscriptSceneDetachment(values, preview);
        attemptedRelevant = captureDetachmentRelevantFrontmatter(values, []);
      });

      const written = await host.app.vault.read(file);
      attemptedContentHash = await hash(written);
      if (markdownBody(written) !== markdownBody(originalContent)) throw new Error("The Markdown body changed while removing the Scene.");
      const writtenFrontmatter = frontmatterFromMarkdown(written);
      if (!isExplicitlyDetachedScene(writtenFrontmatter)) throw new Error("The detached Scene metadata could not be verified.");

      const recognition = await verifyRecognition(host, preview);
      return {
        status: recognition === "recognised" ? "detached" : recognition === "recognition-delayed" ? "recognition-delayed" : "verification-failed",
        file,
        fallbackPath: currentFallbackPath(host, current)
      };
    } catch (error) {
      if (attemptedRelevant) {
        try {
          const currentContent = await host.app.vault.read(file);
          const currentFrontmatter = frontmatterFromMarkdown(currentContent);
          const currentRelevant = captureDetachmentRelevantFrontmatter(currentFrontmatter, []);
          if (attemptedContentHash !== null
            && await hash(currentContent) === attemptedContentHash
            && markdownBody(currentContent) === markdownBody(originalContent)
            && sameDetachmentRelevantFrontmatter(currentRelevant, attemptedRelevant)) {
            await host.app.fileManager.processFrontMatter(file, (values) => {
              for (const property of Object.keys(values)) delete values[property];
              Object.assign(values, beforeFrontmatter);
            });
          }
        } catch { /* Never overwrite a later edit while rolling back. */ }
      }
      throw error;
    }
  })();
  requests.set(key, request);
  void request.then(() => requests?.delete(key), () => requests?.delete(key));
  return request;
}
