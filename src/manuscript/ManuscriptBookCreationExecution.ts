import {
  ManuscriptBookCreationPlan,
  ManuscriptBookIdentity,
  ManuscriptVaultEntry,
  planManuscriptBookCreation
} from "./ManuscriptBookCreation";

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

const inFlight = new WeakMap<object, Map<string, Promise<ManuscriptBookExecutionResult<unknown>>>>();

export function executeManuscriptBookCreation<Handle>(
  adapter: ManuscriptBookCreationAdapter<Handle>,
  preview: Pick<ManuscriptBookCreationPlan, "title" | "path">
): Promise<ManuscriptBookExecutionResult<Handle>> {
  let requests = inFlight.get(adapter);
  if (!requests) {
    requests = new Map();
    inFlight.set(adapter, requests);
  }
  const requestKey = preview.path.trim().replace(/\\/g, "/").toLocaleLowerCase("en-US");
  const current = requests.get(requestKey);
  if (current) return current as Promise<ManuscriptBookExecutionResult<Handle>>;

  const request = (async (): Promise<ManuscriptBookExecutionResult<Handle>> => {
    const planned = planManuscriptBookCreation({ ...preview, ...adapter.snapshot() });
    if (planned.errors.length > 0) throw new InvalidManuscriptBookConfirmationError(planned.errors);
    for (const folder of planned.missingFolders) await adapter.createFolder(folder);

    const finalPlan = planManuscriptBookCreation({
      title: planned.title,
      path: planned.path,
      ...adapter.snapshot()
    });
    if (finalPlan.errors.length > 0) throw new InvalidManuscriptBookConfirmationError(finalPlan.errors);

    const handle = await adapter.createFile(finalPlan.path, finalPlan.markdown);
    const readBack = await adapter.readFile(handle);
    if (readBack !== finalPlan.markdown) {
      try { await adapter.cleanupReadBackMismatch(handle); } catch { /* Preserve verification failure. */ }
      throw new Error("The created book note did not match the confirmed Markdown after writing.");
    }
    const recognised = await adapter.waitForRecognition(finalPlan.path);
    return { status: recognised ? "recognised" : "recognition-delayed", handle, plan: finalPlan };
  })();
  requests.set(requestKey, request as Promise<ManuscriptBookExecutionResult<unknown>>);
  void request.then(
    () => requests?.delete(requestKey),
    () => requests?.delete(requestKey)
  );
  return request;
}
