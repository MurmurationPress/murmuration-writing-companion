export interface ManuscriptNoteWritePlan {
  readonly path: string;
  readonly markdown: string;
  readonly missingFolders: readonly string[];
  readonly companionFolders?: readonly string[];
  readonly errors: readonly string[];
}

export interface ManuscriptNoteCreationAdapter<Handle, Snapshot> {
  snapshot(): Snapshot;
  createFolder(path: string): Promise<void>;
  createCompanionFolder?(path: string): Promise<void>;
  cleanupCompanionFolder?(path: string): Promise<void>;
  createFile(path: string, markdown: string): Promise<Handle>;
  readFile(handle: Handle): Promise<string>;
  cleanupReadBackMismatch(handle: Handle): Promise<void | boolean>;
  waitForRecognition(path: string): Promise<"recognised" | "recognition-delayed" | "structurally-invalid">;
}

export class InvalidManuscriptNoteConfirmationError extends Error {
  constructor(readonly errors: readonly string[]) { super(errors.join(" ")); this.name = "InvalidManuscriptNoteConfirmationError"; }
}

const inFlight = new WeakMap<object, Map<string, Promise<unknown>>>();

export function executeManuscriptNoteCreation<Handle, Snapshot, Plan extends ManuscriptNoteWritePlan>(
  adapter: ManuscriptNoteCreationAdapter<Handle, Snapshot>,
  requestKey: string,
  buildPlan: (snapshot: Snapshot) => Plan
): Promise<{ status: "recognised" | "recognition-delayed" | "structurally-invalid"; handle: Handle; plan: Plan }> {
  let requests = inFlight.get(adapter);
  if (!requests) { requests = new Map(); inFlight.set(adapter, requests); }
  const key = requestKey.replace(/\\/g, "/").toLocaleLowerCase("en-US");
  const existing = requests.get(key);
  if (existing) return existing as ReturnType<typeof executeManuscriptNoteCreation<Handle, Snapshot, Plan>>;
  const request = (async () => {
    const preview = buildPlan(adapter.snapshot());
    if (preview.errors.length > 0) throw new InvalidManuscriptNoteConfirmationError(preview.errors);
    for (const folder of preview.missingFolders) await adapter.createFolder(folder);
    const finalPlan = buildPlan(adapter.snapshot());
    if (finalPlan.errors.length > 0) throw new InvalidManuscriptNoteConfirmationError(finalPlan.errors);
    if (finalPlan.markdown !== preview.markdown || finalPlan.path !== preview.path) {
      throw new InvalidManuscriptNoteConfirmationError(["The confirmed manuscript creation plan became stale. Review it again."]);
    }
    const companionFolders = finalPlan.companionFolders ?? [];
    const createdCompanions: string[] = [];
    let handle: Handle | null = null;
    let handleCleaned = false;
    let cleanupAttempted = false;
    try {
      for (const folder of companionFolders) {
        if (!adapter.createCompanionFolder) throw new Error("This manuscript creation adapter cannot create companion folders.");
        await adapter.createCompanionFolder(folder);
        createdCompanions.push(folder);
      }
      handle = await adapter.createFile(finalPlan.path, finalPlan.markdown);
      if (await adapter.readFile(handle) !== finalPlan.markdown) {
        try {
          cleanupAttempted = true;
          handleCleaned = await adapter.cleanupReadBackMismatch(handle) === true;
        } catch { /* Preserve verification failure. */ }
        throw new Error("The created manuscript note did not match the confirmed Markdown after writing.");
      }
      return { status: await adapter.waitForRecognition(finalPlan.path), handle, plan: finalPlan };
    } catch (error) {
      if (handle && !cleanupAttempted) {
        try {
          cleanupAttempted = true;
          handleCleaned = await adapter.cleanupReadBackMismatch(handle) === true;
        } catch { /* Preserve the creation failure. */ }
      }
      if (!handle || handleCleaned) {
        for (const folder of createdCompanions.reverse()) {
          try { await adapter.cleanupCompanionFolder?.(folder); } catch { /* Never hide the creation failure. */ }
        }
      }
      throw error;
    }
  })();
  requests.set(key, request);
  void request.then(() => requests?.delete(key), () => requests?.delete(key));
  return request;
}
