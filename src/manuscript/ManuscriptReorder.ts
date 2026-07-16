import type { ManuscriptDocumentRecord } from "./ManuscriptOrder";

export type ManuscriptDropPosition = "before" | "after" | "inside-end";

export interface ManuscriptMoveRequest {
  readonly movedPath: string;
  readonly targetPath: string;
  readonly position: ManuscriptDropPosition;
}

export interface ManuscriptParentChange {
  readonly path: string;
  readonly beforeParentPath: string | null;
  readonly afterParentPath: string | null;
}

export interface ManuscriptMoveProposal {
  readonly valid: boolean;
  readonly beforeEntries: readonly ManuscriptDocumentRecord[];
  readonly entries: readonly ManuscriptDocumentRecord[];
  readonly parentChange: ManuscriptParentChange | null;
  readonly message: string;
}

function descendantsOf(
  rootPath: string,
  entries: readonly ManuscriptDocumentRecord[]
): Set<string> {
  const descendants = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const entry of entries) {
      if (entry.path === rootPath || descendants.has(entry.path)) continue;
      if (
        entry.parentPath === rootPath
        || (entry.parentPath !== null && descendants.has(entry.parentPath))
      ) {
        descendants.add(entry.path);
        changed = true;
      }
    }
  }

  return descendants;
}

function subtreePaths(
  entry: ManuscriptDocumentRecord,
  entries: readonly ManuscriptDocumentRecord[]
): Set<string> {
  const paths = new Set<string>([entry.path]);
  if (entry.kind === "part") {
    for (const path of descendantsOf(entry.path, entries)) paths.add(path);
  }
  return paths;
}

function effectiveParent(
  entry: ManuscriptDocumentRecord,
  bookPath: string
): string {
  return entry.parentPath ?? bookPath;
}

function invalid(
  entries: readonly ManuscriptDocumentRecord[],
  message: string
): ManuscriptMoveProposal {
  return {
    valid: false,
    beforeEntries: entries,
    entries,
    parentChange: null,
    message
  };
}

export function sameManuscriptStructure(
  left: readonly ManuscriptDocumentRecord[],
  right: readonly ManuscriptDocumentRecord[]
): boolean {
  return left.length === right.length
    && left.every((entry, index) => (
      entry.path === right[index]?.path
      && entry.kind === right[index]?.kind
      && entry.bookPath === right[index]?.bookPath
      && entry.parentPath === right[index]?.parentPath
    ));
}

export function proposeManuscriptMove(
  bookPath: string,
  entries: readonly ManuscriptDocumentRecord[],
  request: ManuscriptMoveRequest
): ManuscriptMoveProposal {
  const moved = entries.find((entry) => entry.path === request.movedPath);
  const target = entries.find((entry) => entry.path === request.targetPath);

  if (!moved || !target) return invalid(entries, "The move target is no longer available.");
  if (moved.path === target.path) return invalid(entries, "An entry cannot be moved onto itself.");
  if (moved.bookPath !== bookPath || target.bookPath !== bookPath) {
    return invalid(entries, "Entries cannot be moved between books.");
  }
  if (moved.kind !== "scene" && moved.kind !== "part") {
    return invalid(entries, "Only manuscript scenes and parts can be moved.");
  }
  if (target.kind !== "scene" && target.kind !== "part") {
    return invalid(entries, "The selected target is not part of the manuscript order.");
  }

  const movedPaths = subtreePaths(moved, entries);
  if (movedPaths.has(target.path)) {
    return invalid(entries, "A part cannot be moved beneath one of its descendants.");
  }

  let newParentPath: string;
  if (request.position === "inside-end") {
    if (moved.kind !== "scene" || target.kind !== "part") {
      return invalid(entries, "Only scenes can be moved into a part.");
    }
    newParentPath = target.path;
  } else {
    newParentPath = effectiveParent(target, bookPath);
  }

  if (moved.kind === "part" && newParentPath !== bookPath) {
    return invalid(entries, "Parts must remain directly beneath the book.");
  }
  if (moved.kind === "scene" && newParentPath !== bookPath) {
    const parent = entries.find((entry) => entry.path === newParentPath);
    if (!parent || parent.kind !== "part") {
      return invalid(entries, "A scene parent must be the book or a recognised part.");
    }
  }

  const block = entries.filter((entry) => movedPaths.has(entry.path));
  const remaining = entries.filter((entry) => !movedPaths.has(entry.path));
  const targetIndex = remaining.findIndex((entry) => entry.path === target.path);
  if (targetIndex < 0) return invalid(entries, "The target disappeared during the move.");

  let insertionIndex = targetIndex;
  if (request.position === "after" || request.position === "inside-end") {
    const targetPaths = subtreePaths(target, remaining);
    insertionIndex = targetIndex + 1;
    while (
      insertionIndex < remaining.length
      && targetPaths.has(remaining[insertionIndex]!.path)
    ) {
      insertionIndex += 1;
    }
  }

  const updatedRoot: ManuscriptDocumentRecord = {
    ...block[0]!,
    parentPath: newParentPath
  };
  const updatedBlock = [updatedRoot, ...block.slice(1)];
  const reordered = [
    ...remaining.slice(0, insertionIndex),
    ...updatedBlock,
    ...remaining.slice(insertionIndex)
  ];

  if (sameManuscriptStructure(entries, reordered)) {
    return invalid(entries, `${moved.title} is already in that position.`);
  }

  const beforeParentPath = effectiveParent(moved, bookPath);
  const parentChange = beforeParentPath === newParentPath
    ? null
    : {
      path: moved.path,
      beforeParentPath,
      afterParentPath: newParentPath
    };
  const destination = newParentPath === bookPath
    ? "the book"
    : entries.find((entry) => entry.path === newParentPath)?.title ?? "the selected part";

  return {
    valid: true,
    beforeEntries: entries,
    entries: reordered,
    parentChange,
    message: parentChange
      ? `Moved ${moved.title} into ${destination}.`
      : `Moved ${moved.title}.`
  };
}

export function manuscriptOrderReferences(
  entries: readonly ManuscriptDocumentRecord[]
): string[] {
  return entries.map((entry) => `[[${entry.path.replace(/\.md$/i, "")}]]`);
}

export function siblingMoveRequest(
  bookPath: string,
  entries: readonly ManuscriptDocumentRecord[],
  movedPath: string,
  direction: -1 | 1
): ManuscriptMoveRequest | null {
  const moved = entries.find((entry) => entry.path === movedPath);
  if (!moved) return null;
  const parentPath = effectiveParent(moved, bookPath);
  const siblings = entries.filter((entry) => (
    entry.path !== moved.path
    && effectiveParent(entry, bookPath) === parentPath
    && entry.kind === moved.kind
  ));
  const ordered = entries.filter((entry) => (
    entry.path === moved.path || siblings.some((sibling) => sibling.path === entry.path)
  ));
  const index = ordered.findIndex((entry) => entry.path === moved.path);
  const target = ordered[index + direction];
  if (!target) return null;

  return {
    movedPath,
    targetPath: target.path,
    position: direction < 0 ? "before" : "after"
  };
}
