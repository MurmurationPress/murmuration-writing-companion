export interface ManuscriptCompanionFolderAdapter<Handle> {
  current(path: string): Handle | null;
  kind(handle: Handle): "file" | "folder";
  create(path: string): Promise<Handle>;
  isEmpty(handle: Handle): boolean;
  remove(handle: Handle): Promise<void>;
}

export interface CreatedManuscriptCompanionFolder<Handle> {
  readonly path: string;
  readonly handle: Handle;
}

export class ManuscriptCompanionFolderCollisionError extends Error {
  constructor(path: string, kind: "file" | "folder") {
    super(`A ${kind} already exists at the required Part folder path ${path}.`);
    this.name = "ManuscriptCompanionFolderCollisionError";
  }
}

export async function createManuscriptCompanionFolder<Handle>(
  adapter: ManuscriptCompanionFolderAdapter<Handle>,
  path: string
): Promise<CreatedManuscriptCompanionFolder<Handle>> {
  const collision = adapter.current(path);
  if (collision) throw new ManuscriptCompanionFolderCollisionError(path, adapter.kind(collision));
  const handle = await adapter.create(path);
  if (adapter.current(path) !== handle || adapter.kind(handle) !== "folder") {
    throw new Error(`Could not verify the required Part folder at ${path}.`);
  }
  return { path, handle };
}

/** Remove only the same folder created by this operation, and only while empty. */
export async function cleanupManuscriptCompanionFolder<Handle>(
  adapter: ManuscriptCompanionFolderAdapter<Handle>,
  created: CreatedManuscriptCompanionFolder<Handle> | null
): Promise<boolean> {
  if (!created) return false;
  if (adapter.current(created.path) !== created.handle || !adapter.isEmpty(created.handle)) return false;
  await adapter.remove(created.handle);
  return true;
}
