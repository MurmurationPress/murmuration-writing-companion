import { annotationRevision } from "../editorial/AnnotationRevision";
import type { Annotation, EditorialStore } from "../editorial/EditorialNote";
import { DEFAULT_CATEGORIES } from "../editorial/Categories";
import type { ManuscriptDocumentRecord, ManuscriptOrderNode, ManuscriptOrderResult } from "../manuscript/ManuscriptOrder";

export interface AnnotationBoardBook {
  readonly record: ManuscriptDocumentRecord;
  readonly result: ManuscriptOrderResult;
}
export interface AnnotationBoardFilters {
  part?: string;
  chapter?: string;
  category?: string;
  showResolved?: boolean;
}
export interface AnnotationBoardCard {
  readonly key: string;
  readonly revision: string;
  readonly identityProblem?: string;
  readonly path: string;
  readonly chapter: string;
  readonly part: string | null;
  readonly annotation: Annotation;
}
export interface AnnotationBoardProjection {
  readonly cards: readonly AnnotationBoardCard[];
  readonly categories: readonly string[];
  readonly parts: readonly ManuscriptDocumentRecord[];
  readonly chapters: readonly ManuscriptDocumentRecord[];
  readonly total: number;
}
const invalidKeys = new WeakMap<Annotation, number>();
let nextInvalidKey = 0;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function anchorOrder(a: Annotation, b: Annotation): number {
  // Lines put legacy and exact anchors on one scale; offsets break same-line
  // ties. Stale offsets are ordering hints only, never navigation evidence.
  const line = (a.anchor.line ?? Infinity) - (b.anchor.line ?? Infinity);
  if (line) return line;
  const ar = a.anchor.range, br = b.anchor.range;
  const offset = (ar?.from ?? Infinity) - (br?.from ?? Infinity);
  if (offset) return offset;
  return compare(a.created, b.created) || compare(a.id, b.id);
}

export function filterAnnotationBoardCards(cards: readonly AnnotationBoardCard[], filters: AnnotationBoardFilters): readonly AnnotationBoardCard[] {
  return cards.filter(card => (filters.showResolved || card.annotation.status !== "resolved")
    && (!filters.part || card.part === filters.part) && (!filters.chapter || card.path === filters.chapter)
    && (filters.category === undefined || card.annotation.category === filters.category));
}

/** A disposable, read-only projection: no page creation, scans or Markdown reads. */
export function projectAnnotationBoard(book: AnnotationBoardBook, store: EditorialStore,
  filters: AnnotationBoardFilters = {}): AnnotationBoardProjection {
  const members: { entry: ManuscriptDocumentRecord; part: string | null }[] = [{ entry: book.record, part: null }];
  const visit = (nodes: readonly ManuscriptOrderNode[], part: string | null) => {
    for (const node of nodes) {
      const parentPart = node.entry.kind === "part" ? node.entry.path : part;
      members.push({ entry: node.entry, part: parentPart });
      visit(node.children, parentPart);
    }
  };
  visit(book.result.roots, null);
  const all: AnnotationBoardCard[] = [];
  for (const { entry, part } of members) {
    const page = store.pages[entry.path];
    if (!page || page.deletedAt) continue;
    const ids = new Map<string, number>();
    for (const annotation of page.annotations) ids.set(annotation.id, (ids.get(annotation.id) ?? 0) + 1);
    for (const annotation of [...page.annotations].sort(anchorOrder)) {
      const identityProblem = !annotation.id || ids.get(annotation.id)! > 1
        ? "Annotation ID is missing or duplicated. Stored history is retained; repair its identity before updating." : undefined;
      if (identityProblem && !invalidKeys.has(annotation)) invalidKeys.set(annotation, ++nextInvalidKey);
      all.push({ key: JSON.stringify(identityProblem ? [entry.path, annotation.id, invalidKeys.get(annotation)] : [entry.path, annotation.id]),
        revision: annotationRevision(annotation), identityProblem, path: entry.path,
        chapter: entry.title || entry.basename, part, annotation });
    }
  }
  const categories = [...DEFAULT_CATEGORIES, ...[...new Set(all.map(card => card.annotation.category))]
    .filter(category => !DEFAULT_CATEGORIES.includes(category)).sort(compare)];
  const visible = all.filter(card => filters.showResolved || card.annotation.status !== "resolved");
  return {
    cards: filterAnnotationBoardCards(all, filters),
    categories, parts: members.filter(({ entry }) => entry.kind === "part").map(({ entry }) => entry),
    chapters: members.filter(({ entry, part }) => (!filters.part || part === filters.part)
      && Boolean(store.pages[entry.path]?.annotations.length)).map(({ entry }) => entry),
    total: visible.length
  };
}

/** Only this board's unchanged drag snapshot may request an update. */
export function annotationBoardDragCard(data: string, scope: string, cards: readonly AnnotationBoardCard[]): AnnotationBoardCard | null {
  let dragged: { scope?: string; key?: string; revision?: string };
  try { dragged = JSON.parse(data); } catch { return null; }
  if (dragged?.scope !== scope) return null;
  const card = cards.find(card => card.key === dragged.key);
  if (!card || card.revision !== dragged.revision) throw new Error("This annotation changed while dragging. Review its current version and try again.");
  return card;
}
