export interface ManuscriptVaultEntry {
  readonly path: string;
  readonly kind: "file" | "folder";
}

export interface SuggestedManuscriptFilename {
  readonly filename: string;
  readonly explanation: string | null;
}

export interface ManuscriptNotePathPlan {
  readonly title: string;
  readonly path: string;
  readonly missingFolders: readonly string[];
  readonly errors: readonly string[];
}

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const UNSUPPORTED_FILENAME_CHARACTER = /[<>:"|?*\u0000-\u001f]/;
const REPLACED_FILENAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]+/g;

export function parentVaultPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

export function yamlString(value: string): string { return JSON.stringify(value); }

export function suggestManuscriptFilename(titleInput: string): SuggestedManuscriptFilename {
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
  if (!stem) stem = "Untitled note";
  const filename = `${stem}.md`;
  const changes: string[] = [];
  if (replaced) changes.push("unsupported filename characters were replaced with hyphens");
  if (reserved) changes.push("a Windows-reserved filename was prefixed with an underscore");
  if (filename.replace(/\.md$/i, "") !== title.replace(/\.md$/i, "") && changes.length === 0) {
    changes.push("trailing spaces or periods were removed");
  }
  return { filename, explanation: changes.length > 0 ? changes.join("; ") : null };
}

export function manuscriptDefaultPath(folder: string, title: string): SuggestedManuscriptFilename & { path: string } {
  const suggestion = suggestManuscriptFilename(title);
  return { ...suggestion, path: folder ? `${folder}/${suggestion.filename}` : suggestion.filename };
}

export function planManuscriptNotePath(
  titleInput: string,
  pathInput: string,
  entriesInput: readonly ManuscriptVaultEntry[]
): ManuscriptNotePathPlan {
  const title = titleInput.trim();
  const errors: string[] = [];
  if (!title) errors.push("Enter a title.");
  if (/[\r\n\u0085\u2028\u2029]/.test(title)) errors.push("The title must be a single line.");
  const path = pathInput.replace(/\\/g, "/");
  if (!path) errors.push("Enter a note location.");
  if (/^(?:\/|[A-Za-z]:\/)/.test(path)) errors.push("The note location must be relative to the vault.");
  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0)) errors.push("The note location contains an empty path segment.");
  if (segments.some((segment) => segment === "." || segment === "..")) errors.push("The note location cannot contain . or .. traversal segments.");
  for (const segment of segments) {
    if (UNSUPPORTED_FILENAME_CHARACTER.test(segment)) { errors.push(`The path segment “${segment}” contains unsupported filename characters.`); break; }
    if (/[. ]$/.test(segment)) { errors.push(`The path segment “${segment}” cannot end with a space or period.`); break; }
    if (WINDOWS_RESERVED_NAME.test(segment)) { errors.push(`The path segment “${segment}” is a reserved filename on Windows.`); break; }
  }
  const filename = segments[segments.length - 1] ?? "";
  if (!/\.md$/i.test(filename)) errors.push("The note location must end in .md.");
  if (/\.md\.md$/i.test(filename)) errors.push("The note location has a duplicate .md extension.");

  const entries = new Map(entriesInput.map((entry) => [entry.path.toLocaleLowerCase("en-US"), entry]));
  const collision = entries.get(path.toLocaleLowerCase("en-US"));
  if (collision) errors.push(`A ${collision.kind} already exists at “${collision.path}”.`);
  const missingFolders: string[] = [];
  let current = "";
  for (const segment of segments.slice(0, -1)) {
    current = current ? `${current}/${segment}` : segment;
    const existing = entries.get(current.toLocaleLowerCase("en-US"));
    if (existing?.kind === "file") errors.push(`The parent path “${existing.path}” is a file, not a folder.`);
    else if (!existing) missingFolders.push(current);
  }
  return { title, path, missingFolders, errors: [...new Set(errors)] };
}
