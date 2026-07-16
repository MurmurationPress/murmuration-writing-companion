export interface LegacyBookFolder {
  readonly bookPath: string;
  readonly folderPath: string;
}

export function normalizeVaultPath(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

export function parentVaultPath(value: string): string {
  const path = normalizeVaultPath(value);
  const separator = path.lastIndexOf("/");
  return separator >= 0 ? path.slice(0, separator) : "";
}

export function isPathWithinFolder(pathValue: string, folderValue: string): boolean {
  const path = normalizeVaultPath(pathValue);
  const folder = normalizeVaultPath(folderValue);
  if (!folder) return true;
  return path === folder || path.startsWith(`${folder}/`);
}

export function isTemplateManuscriptPath(pathValue: string): boolean {
  const path = normalizeVaultPath(pathValue);
  const directorySegments = parentVaultPath(path)
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.trim().toLowerCase());

  return directorySegments.some((segment) => (
    segment === "template" || segment === "templates"
  ));
}

export function findLegacyOwningBookPath(
  filePath: string,
  books: readonly LegacyBookFolder[]
): string | null {
  const normalizedFilePath = normalizeVaultPath(filePath);
  let best: LegacyBookFolder | null = null;

  for (const book of books) {
    if (normalizeVaultPath(book.bookPath) === normalizedFilePath) {
      return book.bookPath;
    }
    if (!isPathWithinFolder(normalizedFilePath, book.folderPath)) continue;

    if (
      !best
      || normalizeVaultPath(book.folderPath).length
        > normalizeVaultPath(best.folderPath).length
    ) {
      best = book;
    }
  }

  return best?.bookPath ?? null;
}

export function findLegacyParentPath(
  filePath: string,
  bookPath: string,
  bookFolderPath: string,
  folderNotePathByFolder: ReadonlyMap<string, string>
): string | null {
  const normalizedFilePath = normalizeVaultPath(filePath);
  if (normalizedFilePath === normalizeVaultPath(bookPath)) return null;

  const normalizedBookFolder = normalizeVaultPath(bookFolderPath);
  let folder = parentVaultPath(normalizedFilePath);

  while (isPathWithinFolder(folder, normalizedBookFolder)) {
    const folderNotePath = folderNotePathByFolder.get(folder);
    if (
      folderNotePath
      && normalizeVaultPath(folderNotePath) !== normalizedFilePath
    ) {
      return folderNotePath;
    }

    if (folder === normalizedBookFolder) break;
    const parent = parentVaultPath(folder);
    if (parent === folder) break;
    folder = parent;
  }

  return bookPath;
}
