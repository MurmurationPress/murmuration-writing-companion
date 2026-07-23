import type { ManuscriptEntryKind, ManuscriptOrderDiagnostic, ManuscriptOrderSource } from "./ManuscriptOrder";
import { manuscriptOrderKey } from "./ManuscriptOrderKey";
import {
  canonicalInsertionKey,
  commonManuscriptFolder,
  ManuscriptInsertionBoundary,
  ManuscriptInsertionChild,
  manuscriptInsertionBoundaries,
  sameInsertionNeighbour
} from "./ManuscriptInsertion";
import { manuscriptDefaultPath, ManuscriptVaultEntry, parentVaultPath, planManuscriptNotePath, yamlString } from "./ManuscriptNoteCreation";
import { precedingStoryDate, PrecedingStoryDateProposal, PrecedingStoryDateScene } from "./PrecedingStoryDate";
import { parseTemporalInterval } from "../observations/TemporalInterval";

export interface ManuscriptSceneEntrySnapshot extends ManuscriptInsertionChild {
  readonly kind: "part" | "scene";
}

export interface ManuscriptSceneParentSnapshot {
  readonly path: string;
  readonly title: string;
  readonly kind: "book" | "part";
  readonly associatedFolder: string | null;
}

export interface ManuscriptSceneCreationSnapshot {
  readonly selectedBookPath: string | null;
  readonly selectionRevision: number;
  readonly contextPath: string | null;
  readonly book: { readonly path: string; readonly title: string; readonly source: ManuscriptOrderSource; readonly diagnostics: readonly ManuscriptOrderDiagnostic[]; readonly associatedFolder: string | null } | null;
  readonly parents: readonly ManuscriptSceneParentSnapshot[];
  readonly orderedEntries: readonly ManuscriptSceneEntrySnapshot[];
  readonly orderedScenes: readonly PrecedingStoryDateScene[];
  readonly entries: readonly ManuscriptVaultEntry[];
}

export interface ManuscriptSceneCreationPlan {
  readonly title: string;
  readonly path: string;
  readonly bookPath: string;
  readonly bookTitle: string;
  readonly selectionRevision: number;
  readonly structuralSource: ManuscriptOrderSource;
  readonly structurallySafe: boolean;
  readonly parentPath: string;
  readonly parentTitle: string;
  readonly parentKind: "book" | "part";
  readonly placementId: string;
  readonly placementLabel: string;
  readonly directChildren: readonly ManuscriptSceneEntrySnapshot[];
  readonly previous: ManuscriptSceneEntrySnapshot | null;
  readonly next: ManuscriptSceneEntrySnapshot | null;
  readonly orderKey: string;
  readonly globalPosition: number;
  readonly parentReference: string;
  readonly dateProposal: PrecedingStoryDateProposal | null;
  readonly acceptDate: boolean;
  readonly markdown: string;
  readonly missingFolders: readonly string[];
  readonly errors: readonly string[];
}

export function defaultManuscriptSceneParent(snapshot: ManuscriptSceneCreationSnapshot): string {
  const contextual = snapshot.parents.find((parent) => parent.kind === "part" && parent.path === snapshot.contextPath);
  return contextual?.path ?? snapshot.book?.path ?? "";
}

export function manuscriptSceneChildren(snapshot: ManuscriptSceneCreationSnapshot, parentPath: string): ManuscriptSceneEntrySnapshot[] {
  return snapshot.orderedEntries.filter((entry) => entry.parentPath === parentPath);
}

export function manuscriptScenePlacements(
  snapshot: ManuscriptSceneCreationSnapshot,
  parentPath: string
): ManuscriptInsertionBoundary<ManuscriptSceneEntrySnapshot>[] {
  const parent = snapshot.parents.find((candidate) => candidate.path === parentPath);
  return manuscriptInsertionBoundaries(manuscriptSceneChildren(snapshot, parentPath), parent?.kind === "part" ? "Part is empty" : "Book is empty");
}

function isDescendant(entry: ManuscriptSceneEntrySnapshot, parentPath: string, byPath: ReadonlyMap<string, ManuscriptSceneEntrySnapshot>): boolean {
  let current = entry.parentPath ? byPath.get(entry.parentPath) : undefined;
  while (current) {
    if (current.path === parentPath) return true;
    current = current.parentPath ? byPath.get(current.parentPath) : undefined;
  }
  return false;
}

function hypotheticalGlobalPosition(
  snapshot: ManuscriptSceneCreationSnapshot,
  parent: ManuscriptSceneParentSnapshot,
  boundary: ManuscriptInsertionBoundary<ManuscriptSceneEntrySnapshot>
): number {
  let insertionIndex = snapshot.orderedEntries.length;
  if (boundary.next) insertionIndex = snapshot.orderedEntries.findIndex((entry) => entry.path === boundary.next!.path);
  else if (parent.kind === "part") {
    const byPath = new Map(snapshot.orderedEntries.map((entry) => [entry.path, entry]));
    const parentIndex = snapshot.orderedEntries.findIndex((entry) => entry.path === parent.path);
    insertionIndex = parentIndex < 0 ? snapshot.orderedEntries.length : parentIndex + 1;
    while (insertionIndex < snapshot.orderedEntries.length && isDescendant(snapshot.orderedEntries[insertionIndex], parent.path, byPath)) insertionIndex += 1;
  }
  return snapshot.orderedEntries.slice(0, Math.max(0, insertionIndex)).filter((entry) => entry.kind === "scene").length;
}

export function manuscriptSceneDefaultFolder(snapshot: ManuscriptSceneCreationSnapshot, parentPath: string): string {
  const parent = snapshot.parents.find((candidate) => candidate.path === parentPath);
  const sceneFolder = commonManuscriptFolder(manuscriptSceneChildren(snapshot, parentPath).filter((entry) => entry.kind === "scene").map((entry) => entry.path));
  if (sceneFolder !== null) return sceneFolder;
  if (parent?.associatedFolder) return parent.associatedFolder;
  if (parent) {
    const folder = parentVaultPath(parent.path);
    if (folder) return folder;
  }
  return snapshot.book?.associatedFolder ?? "";
}

export function serializeManuscriptScene(title: string, parentPath: string, orderKey: string, storyDate: string | null): string {
  const parent = `[[${parentPath.replace(/\.md$/i, "")}]]`;
  const temporal = storyDate === null ? null : parseTemporalInterval(storyDate);
  if (temporal && (temporal.kind !== "supported" || !temporal.value.point || temporal.value.authoredShape === "range")) throw new Error("Scene story_date must be a validated canonical point value.");
  const canonicalDate = temporal?.kind === "supported" ? temporal.value.source : null;
  return `---\ntype: scene\ntitle: ${yamlString(title)}\nparent: ${yamlString(parent)}\nmanuscript_order_key: ${yamlString(orderKey)}\n${canonicalDate ? `story_date: ${canonicalDate}\n` : ""}---\n`;
}

export function manuscriptSceneCreationAvailability(snapshot: ManuscriptSceneCreationSnapshot, parentPath = defaultManuscriptSceneParent(snapshot)): string[] {
  if (!snapshot.selectedBookPath) return ["Select an authoritative manuscript Book before creating a Scene."];
  if (!snapshot.book || snapshot.book.path !== snapshot.selectedBookPath) return ["The selected manuscript Book is no longer recognised."];
  if (snapshot.contextPath && snapshot.contextPath !== snapshot.book.path && !snapshot.orderedEntries.some((entry) => entry.path === snapshot.contextPath)) return ["The selected manuscript context is stale. Select the Book or a recognised Part again."];
  const parent = snapshot.parents.find((candidate) => candidate.path === parentPath);
  if (!parent) return ["The selected Scene parent is no longer recognised in this Book."];
  if (snapshot.book.source === "none" && snapshot.orderedEntries.length === 0 && parent.kind === "book") return [];
  if (snapshot.book.source !== "distributed") return ["Prepare or reconcile this manuscript before creating a Scene in it."];
  if (snapshot.book.diagnostics.length > 0) return ["Reconcile the manuscript's structural notices before creating a Scene."];
  const children = manuscriptSceneChildren(snapshot, parentPath);
  if (parent.kind === "part" && children.some((child) => child.kind !== "scene")) return ["Reconcile the Part's nested structure before creating a Scene."];
  const keys = children.map((child) => manuscriptOrderKey(child.orderKey));
  if (keys.some((key) => key === null)) return ["A direct child lacks a canonical manuscript order key."];
  if (new Set(keys).size !== keys.length) return ["Direct children have duplicate manuscript order keys; reconcile them first."];
  if (!manuscriptScenePlacements(snapshot, parentPath).some((boundary) => canonicalInsertionKey(boundary) !== null)) return ["No order-key space remains beneath this parent; reconcile manuscript order first."];
  return [];
}

export function planManuscriptSceneCreation(
  snapshot: ManuscriptSceneCreationSnapshot,
  input: { readonly title: string; readonly path: string; readonly parentPath: string; readonly placementId: string; readonly acceptDate: boolean }
): ManuscriptSceneCreationPlan {
  const shared = planManuscriptNotePath(input.title, input.path, snapshot.entries);
  const structuralErrors = [...manuscriptSceneCreationAvailability(snapshot, input.parentPath)];
  const errors = [...structuralErrors, ...shared.errors.map((error) => error === "Enter a title." ? "Enter a Scene title." : error === "The title must be a single line." ? "The Scene title must be a single line." : error)];
  const structuralError = (message: string) => { structuralErrors.push(message); errors.push(message); };
  const bookPath = snapshot.book?.path ?? snapshot.selectedBookPath ?? "";
  const parent = snapshot.parents.find((candidate) => candidate.path === input.parentPath) ?? null;
  const children = manuscriptSceneChildren(snapshot, input.parentPath);
  if (parent?.kind === "part" && children.some((child) => child.kind !== "scene")) structuralError("A Part may contain direct Scenes only; reconcile its nested structure first.");
  const keys = new Set<string>();
  for (const child of children) {
    const key = manuscriptOrderKey(child.orderKey);
    if (!key || child.parentPath !== input.parentPath) structuralError(`${child.title} does not have safe direct-child parent and order metadata.`);
    else if (keys.has(key)) structuralError(`Direct children share manuscript_order_key ${key}; reconcile before creating a Scene.`);
    else keys.add(key);
  }
  const placement = manuscriptScenePlacements(snapshot, input.parentPath).find((candidate) => candidate.id === input.placementId) ?? null;
  if (!placement) structuralError("The selected insertion boundary is no longer available.");
  const orderKey = placement ? canonicalInsertionKey(placement) : null;
  if (placement && !orderKey) structuralError("No order-key space remains at this boundary. Reconcile manuscript order before creating the Scene.");
  const duplicate = snapshot.orderedEntries.find((entry) => entry.kind === "scene" && entry.parentPath === input.parentPath && entry.title.trim().toLocaleLowerCase("en-US") === shared.title.toLocaleLowerCase("en-US"));
  if (shared.title && duplicate) errors.push(`A Scene titled “${duplicate.title}” already exists in ${parent?.title ?? "the selected parent"}.`);
  const globalPosition = parent && placement ? hypotheticalGlobalPosition(snapshot, parent, placement) : 0;
  const dateProposal = precedingStoryDate(snapshot.orderedScenes, globalPosition);
  const parentReference = parent ? `[[${parent.path.replace(/\.md$/i, "")}]]` : "";
  const markdown = parent && orderKey ? serializeManuscriptScene(shared.title, parent.path, orderKey, input.acceptDate ? dateProposal?.value ?? null : null) : "";
  if (input.acceptDate && !dateProposal) errors.push("The reviewed preceding story date is no longer available.");
  return {
    title: shared.title, path: shared.path, bookPath, bookTitle: snapshot.book?.title ?? "Unknown Book", selectionRevision: snapshot.selectionRevision,
    structuralSource: snapshot.book?.source ?? "invalid", structurallySafe: structuralErrors.length === 0,
    parentPath: parent?.path ?? input.parentPath, parentTitle: parent?.title ?? "Unknown parent", parentKind: parent?.kind ?? "book",
    placementId: input.placementId, placementLabel: placement?.label ?? "Unavailable", directChildren: children, previous: placement?.previous ?? null, next: placement?.next ?? null,
    orderKey: orderKey ?? "", globalPosition, parentReference, dateProposal, acceptDate: input.acceptDate,
    markdown, missingFolders: shared.missingFolders, errors: [...new Set(errors)]
  };
}

function sameDate(expected: PrecedingStoryDateProposal | null, actual: PrecedingStoryDateProposal | null): boolean {
  if (!expected || !actual) return expected === actual;
  const rawFingerprint = (value: unknown) => value instanceof Date ? `date:${value.toISOString()}` : `${typeof value}:${JSON.stringify(value)}`;
  return expected.sourcePath === actual.sourcePath && expected.sourcePosition === actual.sourcePosition && expected.property === actual.property
    && rawFingerprint(expected.raw) === rawFingerprint(actual.raw)
    && expected.value === actual.value && expected.precision === actual.precision;
}

export function revalidateManuscriptScenePlan(preview: ManuscriptSceneCreationPlan, snapshot: ManuscriptSceneCreationSnapshot): ManuscriptSceneCreationPlan {
  const current = planManuscriptSceneCreation(snapshot, { title: preview.title, path: preview.path, parentPath: preview.parentPath, placementId: preview.placementId, acceptDate: preview.acceptDate });
  const errors = [...current.errors];
  if (snapshot.selectedBookPath !== preview.bookPath || current.bookPath !== preview.bookPath) errors.push("The explicitly selected Book changed after preview.");
  if (current.parentPath !== preview.parentPath || current.parentKind !== preview.parentKind) errors.push("The selected Scene parent changed after preview.");
  if (current.structuralSource !== preview.structuralSource || !current.structurallySafe) errors.push("The manuscript's structural authority or safety changed after preview.");
  if (!sameInsertionNeighbour(preview.previous, current.previous) || !sameInsertionNeighbour(preview.next, current.next) || current.orderKey !== preview.orderKey || current.globalPosition !== preview.globalPosition) errors.push("The selected insertion boundary changed after preview. Review the updated placement.");
  if (preview.acceptDate && !sameDate(preview.dateProposal, current.dateProposal)) errors.push("The accepted preceding story date changed after preview. Review the updated proposal.");
  if (current.markdown !== preview.markdown) errors.push("The exact Scene Markdown changed after preview.");
  return { ...current, errors: [...new Set(errors)] };
}

export function manuscriptSceneDefaultPath(snapshot: ManuscriptSceneCreationSnapshot, parentPath: string, title: string) {
  return manuscriptDefaultPath(manuscriptSceneDefaultFolder(snapshot, parentPath), title);
}
