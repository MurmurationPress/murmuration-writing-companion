export interface ManuscriptFileMoveAdapter {
  exists(path: string): boolean;
  move(beforePath: string, afterPath: string): Promise<void>;
}

export class ManuscriptFileMoveCollisionError extends Error {
  constructor(path: string) {
    super(`A file already exists at ${path}; the manuscript move was not applied.`);
    this.name = "ManuscriptFileMoveCollisionError";
  }
}

export function manuscriptFileDestination(folderPath: string, fileName: string): string {
  return folderPath ? `${folderPath}/${fileName}` : fileName;
}

/** Move without overwriting, and verify both sides of the vault operation. */
export async function moveManuscriptFile(
  adapter: ManuscriptFileMoveAdapter,
  beforePath: string,
  afterPath: string
): Promise<void> {
  if (beforePath === afterPath) return;
  if (!adapter.exists(beforePath)) throw new Error(`The manuscript file no longer exists at ${beforePath}.`);
  if (adapter.exists(afterPath)) throw new ManuscriptFileMoveCollisionError(afterPath);

  try {
    await adapter.move(beforePath, afterPath);
    if (adapter.exists(beforePath) || !adapter.exists(afterPath)) {
      throw new Error(`Could not verify manuscript file move to ${afterPath}.`);
    }
  } catch (error) {
    // Some vault adapters can report an error after completing a rename. Restore
    // the source path when that state is unambiguous, then preserve the cause.
    if (!adapter.exists(beforePath) && adapter.exists(afterPath)) {
      try {
        await adapter.move(afterPath, beforePath);
      } catch {
        // The caller's metadata transaction still handles its own rollback.
      }
    }
    throw error;
  }
}
