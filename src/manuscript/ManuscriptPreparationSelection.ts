import { App, TFile, TFolder } from "obsidian";
import { normalizeBookPropertyName } from "../editorial/BookReview";
import { isObsidianTrashPath } from "../ObsidianTrash";
import { isTemplateManuscriptPath, isPathWithinFolder } from "./LegacyManuscriptHierarchy";
import { explicitManuscriptKind, MANUSCRIPT_TYPE_ALIASES, manuscriptHierarchyReferences } from "./ManuscriptMetadata";
import { associatedManuscriptFolderPath, buildObsidianManuscriptLibrary, ObsidianManuscriptBook } from "./ObsidianManuscript";
import type { ManuscriptPreparationDiagnostic } from "./ManuscriptPreparation";
import { parseWikilink } from "../story-world/StoryWorldIndex";

const typeProperties = new Set<string>(MANUSCRIPT_TYPE_ALIASES);

/** Review choices are ephemeral. Only accepted canonical metadata is stored. */
export interface ManuscriptPreparationSelection {
  readonly rootPath: string;
  readonly folderPath: string | null;
  readonly excludedPaths: readonly string[];
}

export interface ManuscriptPreparationCandidate {
  readonly file: TFile;
  readonly kind: "book" | "part" | "scene";
  readonly included: boolean;
  readonly locked: boolean;
}

function metadata(app: App, file: TFile): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(file)?.frontmatter;
}

function otherExplicitType(frontmatter: Record<string, unknown> | undefined): boolean {
  return Object.entries(frontmatter ?? {}).some(([key, value]) => typeProperties.has(normalizeBookPropertyName(key)) && String(value ?? "").trim());
}

function proposedType(frontmatter: Record<string, unknown> | undefined, type: string): Record<string, unknown> {
  return { ...Object.fromEntries(Object.entries(frontmatter ?? {}).filter(([key]) => !typeProperties.has(normalizeBookPropertyName(key)))), type };
}

function hierarchyReferences(frontmatter: Record<string, unknown> | undefined) {
  const references = Object.entries(frontmatter ?? {}).map(([property, value]) => manuscriptHierarchyReferences({ [property]: value }));
  return { parentReferences: references.flatMap(ref => ref.parentReferences), bookReferences: references.flatMap(ref => ref.bookReferences) };
}

export function preparationRootForFolder(app: App, folder: TFolder): TFile | null {
  const sibling = app.vault.getAbstractFileByPath(`${folder.path}.md`);
  const inside = app.vault.getAbstractFileByPath(`${folder.path}/${folder.name}.md`);
  // Two companion notes are ambiguous; the author must select one explicitly.
  const matches = [sibling, inside].filter((file): file is TFile => file instanceof TFile);
  return matches.length === 1 ? matches[0] : null;
}

export function manuscriptPreparationCandidates(app: App, selection: ManuscriptPreparationSelection, defaults = false): ManuscriptPreparationCandidate[] {
  const root = app.vault.getAbstractFileByPath(selection.rootPath);
  const rootProposal = root instanceof TFile && !otherExplicitType(metadata(app, root)) ? new Map([[root.path, proposedType(metadata(app, root), "book")]]) : undefined;
  const existing = buildObsidianManuscriptLibrary(app, selection.folderPath ? new Map([[selection.rootPath, selection.folderPath]]) : undefined, rootProposal).books.find(book => book.file.path === selection.rootPath);
  const owned = new Set(existing?.filesByPath.keys());
  const ordered = new Map(existing?.result.entries.map(entry => [entry.path, entry]));
  const authoritativeOrder = existing?.result.source === "distributed" || existing?.result.source === "legacy_array";
  return app.vault.getMarkdownFiles().filter(file => !isObsidianTrashPath(file.path) && !isTemplateManuscriptPath(file.path)
    && (file.path === selection.rootPath || owned.has(file.path) || (selection.folderPath !== null && isPathWithinFolder(file.path, selection.folderPath))))
    .map(file => {
      const fm = metadata(app, file);
      const explicit = explicitManuscriptKind(fm);
      const root = file.path === selection.rootPath;
      const kind = root ? "book" : explicit === "scene" ? "scene" : explicit === "part" ? "part"
        : authoritativeOrder && ordered.get(file.path)?.kind === "part" || associatedManuscriptFolderPath(app, file) ? "part" : "scene";
      const hierarchy = hierarchyReferences(fm);
      const locked = root || !!explicit || otherExplicitType(fm)
        || hierarchy.parentReferences.length > 0 || hierarchy.bookReferences.length > 0
        || Object.prototype.hasOwnProperty.call(fm ?? {}, "manuscript_order_key") || (authoritativeOrder && ordered.has(file.path));
      const role = String(fm?.document_role ?? "").toLowerCase();
      const support = /^(?:contents|table[ _-]of[ _-]contents|import[ _-]guide|conversion[ _-]report)$/i.test(file.basename)
        || /^(?:support|index|report|import_guide|conversion_report|contents)$/.test(role);
      const contentSignal = /^\s*\d+(?:[\s._-]|$)/.test(file.basename)
        || /^(?:chapter|front_matter|back_matter|appendix)$/.test(role);
      const included = root || (explicit === "part" || explicit === "scene") || (!otherExplicitType(fm)
        && ((authoritativeOrder && ordered.has(file.path)) || hierarchy.parentReferences.length > 0 || hierarchy.bookReferences.length > 0
          || Object.prototype.hasOwnProperty.call(fm ?? {}, "manuscript_order_key") || !support && (kind === "part" || contentSignal)));
      return { file, kind: kind as "book" | "part" | "scene", included: defaults || locked ? included : !selection.excludedPaths.includes(file.path), locked };
    }).sort((a, b) => a.file.path.localeCompare(b.file.path, "en", { numeric: true, sensitivity: "base" }));
}

/** Propose roles through the existing recognition/order engine without writing the cache or vault. */
export function buildSelectedManuscript(app: App, selection: ManuscriptPreparationSelection): ObsidianManuscriptBook {
  const root = app.vault.getAbstractFileByPath(selection.rootPath);
  if (!(root instanceof TFile)) throw new Error("Root missing; choose another note.");
  const candidates = manuscriptPreparationCandidates(app, selection);
  const diagnostics: ManuscriptPreparationDiagnostic[] = [];
  const folderOwners = new Map<string, string>();
  for (const candidate of candidates.filter(candidate => candidate.included)) {
    const folder = associatedManuscriptFolderPath(app, candidate.file);
    if (!folder) continue;
    const previous = folderOwners.get(folder);
    if (previous) diagnostics.push({ path: candidate.file.path, message: `Companion notes ${previous} and ${candidate.file.path} both claim ${folder}. Exclude the untyped duplicate.` });
    else folderOwners.set(folder, candidate.file.path);
  }
  // Folder-less roots may still have explicitly parented children. Never widen to the whole vault.
  const proposals = new Map<string, Record<string, unknown>>();
  for (const candidate of candidates) {
    if (candidate.included && candidate.locked && candidate.file.path !== root.path) continue;
    proposals.set(candidate.file.path, proposedType(metadata(app, candidate.file), candidate.included ? candidate.kind : "scene-draft"));
  }
  const book = buildObsidianManuscriptLibrary(app, selection.folderPath ? new Map([[root.path, selection.folderPath]]) : undefined, proposals).books.find(book => book.file.path === root.path);
  if (!book) throw new Error("Select another root note.");
  for (const candidate of candidates) {
    if (!candidate.included) continue;
    const fm = metadata(app, candidate.file);
    for (const [property, value] of Object.entries(fm ?? {})) {
      if (!typeProperties.has(normalizeBookPropertyName(property)) || value === null || String(value).trim() === "") continue;
      if ((Array.isArray(value) ? value : [value]).some(type => explicitManuscriptKind({ type }) !== candidate.kind)) diagnostics.push({ path: candidate.file.path, message: `${property} classifications conflict; preserved.` });
    }
    if (candidate.file.path === root.path) continue;
    const refs = hierarchyReferences(fm);
    for (const references of [refs.parentReferences, refs.bookReferences]) {
      const destinations = references.map(reference => app.metadataCache.getFirstLinkpathDest(parseWikilink(reference)?.linkpath ?? reference, candidate.file.path)?.path ?? null);
      if (destinations.some(path => path === null) || new Set(destinations).size > 1) diagnostics.push({ path: candidate.file.path,
        message: "Parent/Book references are missing or disagree; resolve them." });
    }
    const explicitBook = refs.bookReferences[0];
    if (explicitBook && app.metadataCache.getFirstLinkpathDest(parseWikilink(explicitBook)?.linkpath ?? explicitBook, candidate.file.path)?.path !== root.path) diagnostics.push({ path: candidate.file.path,
      message: "Explicitly belongs to another Book; preserved." });
    if (!book.filesByPath.has(candidate.file.path)) diagnostics.push({ path: candidate.file.path,
      message: "Parent/Book reference cannot reach this Book." });
  }
  return { ...book, preparationSelection: selection, preparationDiagnostics: diagnostics,
    preparationFiles: candidates.map(candidate => candidate.file) };
}

export function initialManuscriptPreparationSelection(app: App, root: TFile, folderPath = associatedManuscriptFolderPath(app, root)): ManuscriptPreparationSelection {
  const selection = { rootPath: root.path, folderPath, excludedPaths: [] };
  return { ...selection, excludedPaths: manuscriptPreparationCandidates(app, selection, true).filter(candidate => !candidate.included).map(candidate => candidate.file.path) };
}
