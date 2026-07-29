import {
  confirmManuscriptContainerRemoval,
  executeManuscriptContainerRemoval
} from "./ManuscriptContainerRemoval";

export type ManuscriptBookContentKind = "part" | "chapter" | "scene";

export interface ManuscriptBookRemovalEntry {
  readonly path: string;
  readonly title: string;
  readonly kind: "book" | ManuscriptBookContentKind;
  readonly parentPath: string | null;
}

export interface ManuscriptBookRemovalSnapshot {
  readonly selectedBookPath: string | null;
  readonly bookPath: string;
  readonly source: string;
  readonly structuralErrors: readonly string[];
  readonly entries: readonly ManuscriptBookRemovalEntry[];
  readonly mtime: number;
  readonly size: number;
}

export interface ManuscriptBookRemovalPlan {
  readonly path: string;
  readonly title: string;
  readonly mtime: number;
  readonly size: number;
  readonly containedItems: readonly ManuscriptBookRemovalEntry[];
  readonly errors: readonly string[];
}

export function manuscriptBookRemovalActionVisible(kind: string, operationRunning: boolean): boolean {
  return kind === "book" && !operationRunning;
}

function contentDescription(items: readonly ManuscriptBookRemovalEntry[]): string {
  const counts = new Map<ManuscriptBookContentKind, number>();
  for (const item of items) {
    if (item.kind !== "book") counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }
  return (["part", "chapter", "scene"] as const)
    .filter((kind) => counts.has(kind))
    .map((kind) => `${counts.get(kind)} ${kind}${counts.get(kind) === 1 ? "" : "s"}`)
    .join(", ");
}

export function planManuscriptBookRemoval(snapshot: ManuscriptBookRemovalSnapshot): ManuscriptBookRemovalPlan {
  const errors: string[] = [];
  const book = snapshot.entries.find((entry) => entry.path === snapshot.bookPath);
  if (!book || book.kind !== "book" || book.parentPath !== null) {
    errors.push("The selected note is no longer an authoritative manuscript Book.");
  }
  if (snapshot.selectedBookPath !== snapshot.bookPath) errors.push("The Book is no longer selected.");
  if (snapshot.source !== "distributed" && snapshot.source !== "none") {
    errors.push("Remove Book requires valid distributed manuscript order.");
  }
  errors.push(...snapshot.structuralErrors);
  const containedItems = book
    ? snapshot.entries.filter((entry) => entry.path !== book.path && entry.kind !== "book")
    : [];
  if (containedItems.length > 0) {
    errors.push(`Move or remove the assigned manuscript content before removing this Book. It still contains ${contentDescription(containedItems)}. Parts, Chapters and Scenes are never deleted, detached, reassigned or rewritten automatically.`);
  }
  return {
    path: snapshot.bookPath,
    title: book?.title ?? snapshot.bookPath,
    mtime: snapshot.mtime,
    size: snapshot.size,
    containedItems,
    errors: [...new Set(errors)]
  };
}

export function revalidateManuscriptBookRemoval(
  preview: ManuscriptBookRemovalPlan,
  snapshot: ManuscriptBookRemovalSnapshot
): ManuscriptBookRemovalPlan {
  const current = planManuscriptBookRemoval(snapshot);
  const stale = preview.path !== current.path
    || preview.mtime !== current.mtime
    || preview.size !== current.size;
  return stale
    ? { ...current, errors: [...current.errors, "The confirmed Book removal became stale. Review it again."] }
    : current;
}

export function manuscriptBookRemovalConfirmation(plan: ManuscriptBookRemovalPlan): string {
  return `Remove “${plan.title}”? Its Book note will be moved to Obsidian trash. No Parts, Chapters or Scenes will be deleted.`;
}

export interface ManuscriptBookRemovalAdapter {
  snapshot(bookPath: string): Promise<ManuscriptBookRemovalSnapshot>;
  trashBook(path: string): Promise<void>;
  refreshNavigator(): void;
}

export class InvalidManuscriptBookRemovalError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(errors.join(" "));
    this.name = "InvalidManuscriptBookRemovalError";
  }
}

export async function executeManuscriptBookRemoval(
  adapter: ManuscriptBookRemovalAdapter,
  preview: ManuscriptBookRemovalPlan
): Promise<void> {
  await executeManuscriptContainerRemoval({
    revalidate: async (candidate) => revalidateManuscriptBookRemoval(
      candidate,
      await adapter.snapshot(candidate.path)
    ),
    trash: (path) => adapter.trashBook(path),
    refreshNavigator: () => adapter.refreshNavigator()
  }, preview, (errors) => new InvalidManuscriptBookRemovalError(errors));
}

export function confirmManuscriptBookRemoval(
  accepted: boolean,
  adapter: ManuscriptBookRemovalAdapter,
  preview: ManuscriptBookRemovalPlan
): Promise<boolean> {
  return confirmManuscriptContainerRemoval(
    accepted,
    () => executeManuscriptBookRemoval(adapter, preview)
  );
}
