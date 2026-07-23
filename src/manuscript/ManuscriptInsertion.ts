import type { ManuscriptEntryKind } from "./ManuscriptOrder";
import { manuscriptOrderKey, manuscriptOrderKeyBetween } from "./ManuscriptOrderKey";
import { parentVaultPath } from "./ManuscriptNoteCreation";

export interface ManuscriptInsertionChild {
  readonly path: string;
  readonly title: string;
  readonly kind: ManuscriptEntryKind;
  readonly parentPath: string | null;
  readonly orderKey: string | null;
}

export interface ManuscriptInsertionBoundary<T extends ManuscriptInsertionChild = ManuscriptInsertionChild> {
  readonly id: string;
  readonly label: string;
  readonly previous: T | null;
  readonly next: T | null;
}

export function manuscriptChildLabel(child: ManuscriptInsertionChild): string {
  return `${child.title} — ${child.kind === "part" ? "Part" : "Scene"}`;
}

export function manuscriptInsertionBoundaries<T extends ManuscriptInsertionChild>(
  children: readonly T[],
  emptyLabel: string
): ManuscriptInsertionBoundary<T>[] {
  if (children.length === 0) return [{ id: "start", label: `At beginning — ${emptyLabel}`, previous: null, next: null }];
  return [
    { id: "start", label: `At beginning — before ${manuscriptChildLabel(children[0])}`, previous: null, next: children[0] },
    ...children.map((child, index) => ({
      id: `after:${child.path}`,
      label: index === children.length - 1 ? `At end — after ${manuscriptChildLabel(child)}` : `After ${manuscriptChildLabel(child)}`,
      previous: child,
      next: children[index + 1] ?? null
    }))
  ];
}

export function canonicalInsertionKey(
  boundary: Pick<ManuscriptInsertionBoundary, "previous" | "next">
): string | null {
  const before = boundary.previous ? manuscriptOrderKey(boundary.previous.orderKey) : null;
  const after = boundary.next ? manuscriptOrderKey(boundary.next.orderKey) : null;
  if ((boundary.previous && !before) || (boundary.next && !after)) return null;
  return manuscriptOrderKeyBetween(before, after);
}

export function sameInsertionNeighbour(
  expected: ManuscriptInsertionChild | null,
  actual: ManuscriptInsertionChild | null
): boolean {
  return expected === null ? actual === null : actual !== null
    && expected.path === actual.path
    && expected.kind === actual.kind
    && expected.parentPath === actual.parentPath
    && manuscriptOrderKey(expected.orderKey) === manuscriptOrderKey(actual.orderKey);
}

export function commonManuscriptFolder(paths: readonly string[]): string | null {
  if (paths.length === 0) return null;
  const parents = new Set(paths.map(parentVaultPath));
  return parents.size === 1 ? [...parents][0] : null;
}
