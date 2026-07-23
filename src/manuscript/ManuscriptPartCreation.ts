import type { ManuscriptEntryKind, ManuscriptOrderDiagnostic, ManuscriptOrderSource } from "./ManuscriptOrder";
import { manuscriptOrderKey, manuscriptOrderKeyBetween } from "./ManuscriptOrderKey";
import {
  commonManuscriptFolder,
  ManuscriptInsertionChild,
  manuscriptInsertionBoundaries,
  sameInsertionNeighbour
} from "./ManuscriptInsertion";
import {
  manuscriptDefaultPath,
  ManuscriptVaultEntry,
  parentVaultPath,
  planManuscriptNotePath,
  yamlString
} from "./ManuscriptNoteCreation";

export interface ManuscriptPartChildSnapshot extends ManuscriptInsertionChild { readonly kind: ManuscriptEntryKind }

export interface ManuscriptPartIdentity { readonly path: string; readonly title: string; readonly bookPath: string }

export interface ManuscriptPartCreationSnapshot {
  readonly selectedBookPath: string | null;
  readonly selectionRevision: number;
  readonly book: { readonly path: string; readonly title: string; readonly source: ManuscriptOrderSource; readonly diagnostics: readonly ManuscriptOrderDiagnostic[] } | null;
  readonly directChildren: readonly ManuscriptPartChildSnapshot[];
  readonly parts: readonly ManuscriptPartIdentity[];
  readonly entries: readonly ManuscriptVaultEntry[];
  readonly associatedBookFolder: string | null;
}

export interface ManuscriptPartPlacement {
  readonly id: string;
  readonly label: string;
  readonly previous: ManuscriptPartChildSnapshot | null;
  readonly next: ManuscriptPartChildSnapshot | null;
}

export interface ManuscriptPartCreationPlan {
  readonly title: string;
  readonly path: string;
  readonly bookPath: string;
  readonly bookTitle: string;
  readonly selectionRevision: number;
  readonly placementId: string;
  readonly placementLabel: string;
  readonly previous: ManuscriptPartChildSnapshot | null;
  readonly next: ManuscriptPartChildSnapshot | null;
  readonly orderKey: string;
  readonly parentReference: string;
  readonly markdown: string;
  readonly missingFolders: readonly string[];
  readonly errors: readonly string[];
}

export function manuscriptPartPlacements(children: readonly ManuscriptPartChildSnapshot[]): ManuscriptPartPlacement[] {
  return manuscriptInsertionBoundaries(children, "Book is empty");
}

export function manuscriptPartDefaultFolder(snapshot: ManuscriptPartCreationSnapshot): string {
  const partFolder = commonManuscriptFolder(snapshot.parts.filter((part) => part.bookPath === snapshot.book?.path).map((part) => part.path));
  if (partFolder !== null) return partFolder;
  if (snapshot.associatedBookFolder) return snapshot.associatedBookFolder;
  const childrenFolder = commonManuscriptFolder(snapshot.directChildren.map((child) => child.path));
  if (childrenFolder !== null) return childrenFolder;
  return snapshot.book ? parentVaultPath(snapshot.book.path) : "";
}

export function serializeManuscriptPart(title: string, bookPath: string, orderKey: string): string {
  const parent = `[[${bookPath.replace(/\.md$/i, "")}]]`;
  return `---\ntype: part\ntitle: ${yamlString(title)}\nparent: ${yamlString(parent)}\nmanuscript_order_key: ${yamlString(orderKey)}\n---\n`;
}

export function manuscriptPartCreationAvailability(snapshot: ManuscriptPartCreationSnapshot): string[] {
  if (!snapshot.selectedBookPath) return ["Select an authoritative manuscript book before creating a Part."];
  if (!snapshot.book || snapshot.book.path !== snapshot.selectedBookPath) return ["The selected manuscript book is no longer recognised."];
  if (snapshot.book.source === "none" && snapshot.directChildren.length === 0) return [];
  if (snapshot.book.source !== "distributed") return ["Prepare or reconcile this manuscript before creating a Part in it."];
  if (snapshot.book.diagnostics.length > 0) return ["Reconcile the manuscript's structural notices before creating a Part."];
  return [];
}

export function planManuscriptPartCreation(
  snapshot: ManuscriptPartCreationSnapshot,
  input: { readonly title: string; readonly path: string; readonly placementId: string }
): ManuscriptPartCreationPlan {
  const shared = planManuscriptNotePath(input.title, input.path, snapshot.entries);
  const errors = [...manuscriptPartCreationAvailability(snapshot), ...shared.errors.map((error) => error === "Enter a title." ? "Enter a Part title." : error === "The title must be a single line." ? "The Part title must be a single line." : error)];
  const bookPath = snapshot.book?.path ?? snapshot.selectedBookPath ?? "";
  const bookTitle = snapshot.book?.title ?? "Unknown book";
  const invalidChild = snapshot.directChildren.find((child) => (
    (child.kind !== "part" && child.kind !== "scene")
    || child.parentPath !== bookPath
    || manuscriptOrderKey(child.orderKey) === null
  ));
  if (invalidChild) errors.push(`${invalidChild.title} does not have safe direct-child parent and order metadata.`);
  const keys = new Set<string>();
  for (const child of snapshot.directChildren) {
    const key = manuscriptOrderKey(child.orderKey);
    if (key && keys.has(key)) errors.push(`Direct children share manuscript_order_key ${key}; reconcile before creating a Part.`);
    if (key) keys.add(key);
  }
  const placement = manuscriptPartPlacements(snapshot.directChildren).find((candidate) => candidate.id === input.placementId) ?? null;
  if (!placement) errors.push("The selected insertion boundary is no longer available.");
  const beforeKey = placement?.previous ? manuscriptOrderKey(placement.previous.orderKey) : null;
  const afterKey = placement?.next ? manuscriptOrderKey(placement.next.orderKey) : null;
  const orderKey = placement && (!placement.previous || beforeKey) && (!placement.next || afterKey)
    ? manuscriptOrderKeyBetween(beforeKey, afterKey) : null;
  if (placement && !orderKey) errors.push("No order-key space remains at this boundary. Reconcile manuscript order before creating the Part.");
  const duplicate = snapshot.parts.find((part) => part.bookPath === bookPath && part.title.trim().toLocaleLowerCase("en-US") === shared.title.toLocaleLowerCase("en-US"));
  if (shared.title && duplicate) errors.push(`A Part titled “${duplicate.title}” already exists in ${bookTitle}.`);
  const parentReference = bookPath ? `[[${bookPath.replace(/\.md$/i, "")}]]` : "";
  return {
    title: shared.title, path: shared.path, bookPath, bookTitle,
    selectionRevision: snapshot.selectionRevision,
    placementId: input.placementId,
    placementLabel: placement?.label ?? "Unavailable",
    previous: placement?.previous ?? null, next: placement?.next ?? null,
    orderKey: orderKey ?? "", parentReference,
    markdown: bookPath && orderKey ? serializeManuscriptPart(shared.title, bookPath, orderKey) : "",
    missingFolders: shared.missingFolders, errors: [...new Set(errors)]
  };
}

export function revalidateManuscriptPartPlan(
  preview: ManuscriptPartCreationPlan,
  snapshot: ManuscriptPartCreationSnapshot
): ManuscriptPartCreationPlan {
  const current = planManuscriptPartCreation(snapshot, { title: preview.title, path: preview.path, placementId: preview.placementId });
  const errors = [...current.errors];
  if (snapshot.selectedBookPath !== preview.bookPath || current.bookPath !== preview.bookPath) errors.push("The explicitly selected Book changed after preview.");
  if (!sameInsertionNeighbour(preview.previous, current.previous) || !sameInsertionNeighbour(preview.next, current.next) || current.orderKey !== preview.orderKey) {
    errors.push("The selected insertion boundary changed after preview. Review the updated placement.");
  }
  if (current.markdown !== preview.markdown) errors.push("The exact Part Markdown changed after preview.");
  return { ...current, errors: [...new Set(errors)] };
}
