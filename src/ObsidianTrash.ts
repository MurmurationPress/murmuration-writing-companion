export type ObsidianRenameKind = "ordinary" | "trash-delete" | "trash-restore" | "trash-internal";

/** Obsidian's configured local-trash mode uses `.trash` at the vault root. */
export function isObsidianTrashPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return normalized === ".trash" || normalized.startsWith(".trash/");
}

export function classifyObsidianRename(oldPath: string, newPath: string): ObsidianRenameKind {
  const oldTrash = isObsidianTrashPath(oldPath);
  const newTrash = isObsidianTrashPath(newPath);
  if (!oldTrash && newTrash) return "trash-delete";
  if (oldTrash && !newTrash) return "trash-restore";
  if (oldTrash && newTrash) return "trash-internal";
  return "ordinary";
}

export function shouldMigrateEditorialPathForRename(oldPath: string, newPath: string): boolean {
  return classifyObsidianRename(oldPath, newPath) === "ordinary";
}
