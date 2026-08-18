import type { ManuscriptOrderNode } from "./ManuscriptOrder";

export function normaliseManuscriptSearch(query: string): string {
  return query.trim().toLocaleLowerCase();
}

/**
 * Filter an already-built manuscript tree by title without changing its
 * authority, ordering, or node records. Matching ancestors retain their full
 * branch; otherwise ancestors are retained only as context for descendants.
 */
export function filterManuscriptTree(
  roots: readonly ManuscriptOrderNode[],
  query: string
): readonly ManuscriptOrderNode[] {
  const needle = normaliseManuscriptSearch(query);
  if (!needle) return roots;

  const filterNode = (node: ManuscriptOrderNode): ManuscriptOrderNode | null => {
    if (node.entry.title.toLocaleLowerCase().includes(needle)) return node;
    const children = node.children
      .map(filterNode)
      .filter((child): child is ManuscriptOrderNode => child !== null);
    return children.length > 0 ? { entry: node.entry, children } : null;
  };

  return roots
    .map(filterNode)
    .filter((node): node is ManuscriptOrderNode => node !== null);
}

export function manuscriptPartIsCollapsed(
  normallyCollapsed: boolean,
  searchActive: boolean,
  revealActive: boolean
): boolean {
  return !searchActive && normallyCollapsed && !revealActive;
}

export function clearManuscriptSearchOnEscape(query: string, key: string): string {
  return key === "Escape" && query.length > 0 ? "" : query;
}
