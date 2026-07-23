import {
  manuscriptDefaultPath,
  ManuscriptVaultEntry,
  parentVaultPath,
  planManuscriptNotePath,
  SuggestedManuscriptFilename,
  suggestManuscriptFilename,
  yamlString
} from "./ManuscriptNoteCreation";
export type { ManuscriptVaultEntry } from "./ManuscriptNoteCreation";

export interface ManuscriptBookIdentity {
  readonly path: string;
  readonly title: string;
}

export interface ManuscriptBookCreationInput {
  readonly title: string;
  readonly path: string;
  readonly books: readonly ManuscriptBookIdentity[];
  readonly entries: readonly ManuscriptVaultEntry[];
}

export interface ManuscriptBookCreationPlan {
  readonly title: string;
  readonly path: string;
  readonly markdown: string;
  readonly missingFolders: readonly string[];
  readonly errors: readonly string[];
}

export type SuggestedBookFilename = SuggestedManuscriptFilename;

export function manuscriptBookDefaultFolder(
  books: readonly ManuscriptBookIdentity[],
  selectedBookPath: string | null
): string {
  if (books.length > 0) {
    const parents = new Set(books.map((book) => parentVaultPath(book.path)));
    if (parents.size === 1) return [...parents][0];
  }
  if (selectedBookPath && books.some((book) => book.path === selectedBookPath)) {
    return parentVaultPath(selectedBookPath);
  }
  return "";
}

export function suggestManuscriptBookFilename(titleInput: string): SuggestedBookFilename {
  const result = suggestManuscriptFilename(titleInput);
  return result.filename === "Untitled note.md" ? { ...result, filename: "Untitled book.md" } : result;
}

export function manuscriptBookDefaultPath(folder: string, title: string): SuggestedBookFilename & { path: string } {
  const suggestion = suggestManuscriptBookFilename(title);
  const shared = manuscriptDefaultPath(folder, title);
  return { ...suggestion, path: suggestion.filename === shared.filename ? shared.path : (folder ? `${folder}/${suggestion.filename}` : suggestion.filename) };
}

export function serializeManuscriptBook(title: string): string {
  return `---\ntype: book\ntitle: ${yamlString(title)}\n---\n`;
}

export function planManuscriptBookCreation(input: ManuscriptBookCreationInput): ManuscriptBookCreationPlan {
  const shared = planManuscriptNotePath(input.title, input.path, input.entries);
  const title = shared.title;
  const errors = shared.errors.map((error) => error === "Enter a title." ? "Enter a book title." : error === "The title must be a single line." ? "The book title must be a single line." : error);
  const titleKey = title.toLocaleLowerCase("en-US");
  const duplicateBook = input.books.find((book) => book.title.trim().toLocaleLowerCase("en-US") === titleKey);
  if (title && duplicateBook) errors.push(`A recognised book titled “${duplicateBook.title}” already exists at “${duplicateBook.path}”.`);

  return {
    title,
    path: shared.path,
    markdown: serializeManuscriptBook(title),
    missingFolders: shared.missingFolders,
    errors: [...new Set(errors)]
  };
}
