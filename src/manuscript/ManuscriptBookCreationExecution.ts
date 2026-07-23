import {
  ManuscriptBookCreationPlan,
  ManuscriptBookIdentity,
  ManuscriptVaultEntry,
  planManuscriptBookCreation
} from "./ManuscriptBookCreation";
import {
  executeManuscriptNoteCreation,
  InvalidManuscriptNoteConfirmationError,
  ManuscriptNoteCreationAdapter
} from "./ManuscriptNoteCreationExecution";

export interface ManuscriptBookCreationSnapshot {
  readonly books: readonly ManuscriptBookIdentity[];
  readonly entries: readonly ManuscriptVaultEntry[];
}

export interface ManuscriptBookCreationAdapter<Handle> {
  snapshot(): ManuscriptBookCreationSnapshot;
  createFolder(path: string): Promise<void>;
  createFile(path: string, markdown: string): Promise<Handle>;
  readFile(handle: Handle): Promise<string>;
  cleanupReadBackMismatch(handle: Handle): Promise<void>;
  waitForRecognition(path: string): Promise<boolean>;
}

export type ManuscriptBookExecutionResult<Handle> = {
  readonly status: "recognised" | "recognition-delayed";
  readonly handle: Handle;
  readonly plan: ManuscriptBookCreationPlan;
};

export class InvalidManuscriptBookConfirmationError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(errors.join(" "));
    this.name = "InvalidManuscriptBookConfirmationError";
  }
}

const sharedAdapters = new WeakMap<object, ManuscriptNoteCreationAdapter<unknown, ManuscriptBookCreationSnapshot>>();

export function executeManuscriptBookCreation<Handle>(
  adapter: ManuscriptBookCreationAdapter<Handle>,
  preview: Pick<ManuscriptBookCreationPlan, "title" | "path">
): Promise<ManuscriptBookExecutionResult<Handle>> {
  let shared = sharedAdapters.get(adapter) as ManuscriptNoteCreationAdapter<Handle, ManuscriptBookCreationSnapshot> | undefined;
  if (!shared) {
    shared = {
      snapshot: () => adapter.snapshot(),
      createFolder: (path) => adapter.createFolder(path),
      createFile: (path, markdown) => adapter.createFile(path, markdown),
      readFile: (handle) => adapter.readFile(handle),
      cleanupReadBackMismatch: (handle) => adapter.cleanupReadBackMismatch(handle),
      waitForRecognition: async (path) => await adapter.waitForRecognition(path) ? "recognised" : "recognition-delayed"
    };
    sharedAdapters.set(adapter, shared as ManuscriptNoteCreationAdapter<unknown, ManuscriptBookCreationSnapshot>);
  }
  return executeManuscriptNoteCreation(
    shared,
    preview.path,
    (snapshot) => planManuscriptBookCreation({ ...preview, ...snapshot })
  ).then(
    (result) => ({ status: result.status === "recognised" ? "recognised" : "recognition-delayed", handle: result.handle, plan: result.plan }),
    (error) => {
      if (error instanceof InvalidManuscriptNoteConfirmationError) throw new InvalidManuscriptBookConfirmationError(error.errors);
      if (error instanceof Error && error.message.includes("created manuscript note")) {
        throw new Error("The created book note did not match the confirmed Markdown after writing.");
      }
      throw error;
    }
  );
}
