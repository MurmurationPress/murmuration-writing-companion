import type {
  ManuscriptDocumentRecord,
  ManuscriptOrderDiagnostic,
  ManuscriptOrderNode,
  ManuscriptOrderResult
} from "./ManuscriptOrder";

function diagnosticKey(diagnostic: ManuscriptOrderDiagnostic): string {
  return `${diagnostic.kind}\u0000${diagnostic.path ?? ""}`;
}

function invalidParentDiagnostic(
  entry: ManuscriptDocumentRecord,
  parent: ManuscriptDocumentRecord | undefined,
  bookPath: string
): ManuscriptOrderDiagnostic | null {
  if (entry.kind === "part" && entry.parentPath !== bookPath) {
    return {
      kind: "invalid_parent_kind",
      path: entry.path,
      message: `${entry.title} is a part and must belong directly to the book.`
    };
  }

  if (
    entry.kind === "scene"
    && entry.parentPath
    && entry.parentPath !== bookPath
    && parent?.kind !== "part"
  ) {
    return {
      kind: "invalid_parent_kind",
      path: entry.path,
      message: `${entry.title}'s parent must be the book or a recognised part.`
    };
  }

  return null;
}

/**
 * Build a navigator-safe tree from the resolved sequence.
 *
 * Structural diagnostics remain authoritative, but invalid parent relationships
 * must never make a note disappear beneath a scene row that has no disclosure
 * control. Parts are always roots; scenes attach only to recognised parts.
 */
export function visibleManuscriptOrder(
  bookPath: string,
  result: ManuscriptOrderResult
): ManuscriptOrderResult {
  const nodes = new Map<string, { entry: ManuscriptDocumentRecord; children: ManuscriptOrderNode[] }>();
  for (const entry of result.entries) {
    nodes.set(entry.path, { entry, children: [] });
  }

  const roots: ManuscriptOrderNode[] = [];
  const diagnostics = [...result.diagnostics];
  const diagnosticKeys = new Set(diagnostics.map(diagnosticKey));

  for (const entry of result.entries) {
    const node = nodes.get(entry.path)!;
    const parent = entry.parentPath ? nodes.get(entry.parentPath)?.entry : undefined;
    const diagnostic = invalidParentDiagnostic(entry, parent, bookPath);
    if (diagnostic && !diagnosticKeys.has(diagnosticKey(diagnostic))) {
      diagnostics.push(diagnostic);
      diagnosticKeys.add(diagnosticKey(diagnostic));
    }

    if (
      entry.kind === "scene"
      && entry.parentPath
      && entry.parentPath !== bookPath
      && parent?.kind === "part"
    ) {
      nodes.get(parent.path)!.children.push(node);
      continue;
    }

    roots.push(node);
  }

  return {
    ...result,
    roots,
    diagnostics
  };
}
