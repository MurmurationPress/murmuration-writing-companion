import {
  confirmManuscriptContainerRemoval,
  executeManuscriptContainerRemoval
} from "./ManuscriptContainerRemoval";

export interface ManuscriptPartRemovalEntry {
  readonly path: string;
  readonly title: string;
  readonly kind: "book" | "part" | "scene";
  readonly parentPath: string | null;
  readonly orderKey: string | null;
}

export interface ManuscriptPartRemovalSnapshot {
  readonly selectedBookPath: string | null;
  readonly bookPath: string;
  readonly source: string;
  readonly structuralErrors: readonly string[];
  readonly entries: readonly ManuscriptPartRemovalEntry[];
  readonly partPath: string;
  readonly mtime: number;
  readonly size: number;
}

export interface ManuscriptPartRemovalPlan {
  readonly path: string;
  readonly title: string;
  readonly bookPath: string;
  readonly mtime: number;
  readonly size: number;
  readonly containedItems: readonly ManuscriptPartRemovalEntry[];
  readonly errors: readonly string[];
}

export function manuscriptPartRemovalActionVisible(kind: string, operationRunning: boolean): boolean {
  return kind === "part" && !operationRunning;
}

export function planManuscriptPartRemoval(snapshot: ManuscriptPartRemovalSnapshot): ManuscriptPartRemovalPlan {
  const errors: string[] = [];
  const part = snapshot.entries.find((entry) => entry.path === snapshot.partPath);
  if (!part || part.kind !== "part") errors.push("The selected note is no longer an authoritative manuscript Part.");
  if (snapshot.selectedBookPath !== snapshot.bookPath) errors.push("The owning Book is no longer selected.");
  if (snapshot.source !== "distributed") errors.push("Remove Part requires valid distributed manuscript order.");
  errors.push(...snapshot.structuralErrors);
  if (part?.parentPath !== snapshot.bookPath || !part.orderKey) {
    errors.push("The Part does not have a valid authoritative Book parent and manuscript_order_key.");
  }
  const containedItems = part
    ? snapshot.entries.filter((entry) => entry.path !== part.path && entry.parentPath === part.path)
    : [];
  if (containedItems.length > 0) {
    errors.push(`Move or remove the ${containedItems.length === 1 ? "contained manuscript item" : "contained manuscript items"} before removing this Part. Chapters and Scenes are never deleted or reassigned automatically.`);
  }
  return {
    path: snapshot.partPath,
    title: part?.title ?? snapshot.partPath,
    bookPath: snapshot.bookPath,
    mtime: snapshot.mtime,
    size: snapshot.size,
    containedItems,
    errors: [...new Set(errors)]
  };
}

export function revalidateManuscriptPartRemoval(
  preview: ManuscriptPartRemovalPlan,
  snapshot: ManuscriptPartRemovalSnapshot
): ManuscriptPartRemovalPlan {
  const current = planManuscriptPartRemoval(snapshot);
  const stale = preview.path !== current.path
    || preview.bookPath !== current.bookPath
    || preview.mtime !== current.mtime
    || preview.size !== current.size;
  return stale
    ? { ...current, errors: [...current.errors, "The confirmed Part removal became stale. Review it again."] }
    : current;
}

export function manuscriptPartRemovalConfirmation(plan: ManuscriptPartRemovalPlan): string {
  return `Remove “${plan.title}”? Its Part note will be moved to Obsidian trash. No Chapters or Scenes will be deleted.`;
}

export interface ManuscriptPartRemovalAdapter {
  snapshot(partPath: string, bookPath: string): Promise<ManuscriptPartRemovalSnapshot>;
  trashPart(path: string): Promise<void>;
  refreshNavigator(): void;
}

export class InvalidManuscriptPartRemovalError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(errors.join(" "));
    this.name = "InvalidManuscriptPartRemovalError";
  }
}

export async function executeManuscriptPartRemoval(
  adapter: ManuscriptPartRemovalAdapter,
  preview: ManuscriptPartRemovalPlan
): Promise<void> {
  await executeManuscriptContainerRemoval({
    revalidate: async (candidate) => revalidateManuscriptPartRemoval(
      candidate,
      await adapter.snapshot(candidate.path, candidate.bookPath)
    ),
    trash: (path) => adapter.trashPart(path),
    refreshNavigator: () => adapter.refreshNavigator()
  }, preview, (errors) => new InvalidManuscriptPartRemovalError(errors));
}

export async function confirmManuscriptPartRemoval(
  accepted: boolean,
  adapter: ManuscriptPartRemovalAdapter,
  preview: ManuscriptPartRemovalPlan
): Promise<boolean> {
  return confirmManuscriptContainerRemoval(
    accepted,
    () => executeManuscriptPartRemoval(adapter, preview)
  );
}
