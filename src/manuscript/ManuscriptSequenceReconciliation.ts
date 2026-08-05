export interface ManuscriptSequenceScopeBook<T> {
  readonly source: string;
  readonly value: T;
  readonly paths: readonly string[];
}

export function manuscriptSequenceReconciliationScope<T>(
  books: readonly ManuscriptSequenceScopeBook<T>[]
): { readonly projectable: readonly T[]; readonly deferredPaths: ReadonlySet<string> } {
  const projectable: T[] = [];
  const deferredPaths = new Set<string>();
  for (const book of books) {
    if (book.source === "distributed") projectable.push(book.value);
    else for (const path of book.paths) deferredPaths.add(path);
  }
  return { projectable, deferredPaths };
}
