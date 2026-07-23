export interface ManuscriptBookIdentity {
  readonly path: string;
  readonly title: string;
}

export interface ManuscriptVaultEntry {
  readonly path: string;
  readonly kind: "file" | "folder";
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

export interface SuggestedBookFilename {
  readonly filename: string;
  readonly explanation: string | null;
}

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const UNSUPPORTED_FILENAME_CHARACTER = /[<>:"|?*\u0000-\u001f]/;
const REPLACED_FILENAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]+/g;

function parentPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

export function manuscriptBookDefaultFolder(
  books: readonly ManuscriptBookIdentity[],
  selectedBookPath: string | null
): string {
  if (books.length > 0) {
    const parents = new Set(books.map((book) => parentPath(book.path)));
    if (parents.size === 1) return [...parents][0];
  }
  if (selectedBookPath && books.some((book) => book.path === selectedBookPath)) {
    return parentPath(selectedBookPath);
  }
  return "";
}

export function suggestManuscriptBookFilename(titleInput: string): SuggestedBookFilename {
  const title = titleInput.trim();
  let stem = title.replace(/\.md$/i, "");
  const replaced = REPLACED_FILENAME_CHARACTERS.test(stem);
  REPLACED_FILENAME_CHARACTERS.lastIndex = 0;
  stem = stem.replace(REPLACED_FILENAME_CHARACTERS, "-")
    .replace(/-+/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  const reserved = WINDOWS_RESERVED_NAME.test(stem);
  if (reserved) stem = `_${stem}`;
  if (!stem) stem = "Untitled book";
  const filename = `${stem}.md`;
  const changes: string[] = [];
  if (replaced) changes.push("unsupported filename characters were replaced with hyphens");
  if (reserved) changes.push("a Windows-reserved filename was prefixed with an underscore");
  if (filename.replace(/\.md$/i, "") !== title.replace(/\.md$/i, "")) {
    if (changes.length === 0) changes.push("trailing spaces or periods were removed");
  }
  return { filename, explanation: changes.length > 0 ? changes.join("; ") : null };
}

export function manuscriptBookDefaultPath(folder: string, title: string): SuggestedBookFilename & { path: string } {
  const suggestion = suggestManuscriptBookFilename(title);
  return {
    ...suggestion,
    path: folder ? `${folder}/${suggestion.filename}` : suggestion.filename
  };
}

export function serializeManuscriptBook(title: string): string {
  return `---\ntype: book\ntitle: ${JSON.stringify(title)}\n---\n`;
}

function validatePath(pathInput: string): { path: string; errors: string[] } {
  const errors: string[] = [];
  const normalized = pathInput.replace(/\\/g, "/");
  if (!normalized) return { path: normalized, errors: ["Enter a note location."] };
  if (/^(?:\/|[A-Za-z]:\/)/.test(normalized)) errors.push("The note location must be relative to the vault.");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0)) errors.push("The note location contains an empty path segment.");
  if (segments.some((segment) => segment === "." || segment === "..")) errors.push("The note location cannot contain . or .. traversal segments.");
  for (const segment of segments) {
    if (UNSUPPORTED_FILENAME_CHARACTER.test(segment)) {
      errors.push(`The path segment “${segment}” contains unsupported filename characters.`);
      break;
    }
    if (/[. ]$/.test(segment)) {
      errors.push(`The path segment “${segment}” cannot end with a space or period.`);
      break;
    }
    if (WINDOWS_RESERVED_NAME.test(segment)) {
      errors.push(`The path segment “${segment}” is a reserved filename on Windows.`);
      break;
    }
  }
  const filename = segments[segments.length - 1] ?? "";
  if (!/\.md$/i.test(filename)) errors.push("The note location must end in .md.");
  if (/\.md\.md$/i.test(filename)) errors.push("The note location has a duplicate .md extension.");
  return { path: normalized, errors };
}

export function planManuscriptBookCreation(input: ManuscriptBookCreationInput): ManuscriptBookCreationPlan {
  const title = input.title.trim();
  const errors: string[] = [];
  if (!title) errors.push("Enter a book title.");
  if (/[\r\n\u0085\u2028\u2029]/.test(title)) errors.push("The book title must be a single line.");
  const validatedPath = validatePath(input.path);
  errors.push(...validatedPath.errors);
  const path = validatedPath.path;
  const pathKey = path.toLocaleLowerCase("en-US");
  const titleKey = title.toLocaleLowerCase("en-US");
  const entries = new Map(input.entries.map((entry) => [entry.path.toLocaleLowerCase("en-US"), entry]));
  const collision = entries.get(pathKey);
  if (collision) errors.push(`A ${collision.kind} already exists at “${collision.path}”.`);
  const duplicateBook = input.books.find((book) => book.title.trim().toLocaleLowerCase("en-US") === titleKey);
  if (title && duplicateBook) errors.push(`A recognised book titled “${duplicateBook.title}” already exists at “${duplicateBook.path}”.`);

  const missingFolders: string[] = [];
  const segments = path.split("/").slice(0, -1);
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    const existing = entries.get(current.toLocaleLowerCase("en-US"));
    if (existing?.kind === "file") errors.push(`The parent path “${existing.path}” is a file, not a folder.`);
    else if (!existing) missingFolders.push(current);
  }

  return {
    title,
    path,
    markdown: serializeManuscriptBook(title),
    missingFolders,
    errors: [...new Set(errors)]
  };
}
