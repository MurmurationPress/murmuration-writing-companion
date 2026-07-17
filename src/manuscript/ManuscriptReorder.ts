import type { ManuscriptDocumentRecord } from "./ManuscriptOrder";
import {
  evenlySpacedManuscriptOrderKeys,
  manuscriptOrderKey,
  manuscriptOrderKeyBetween
} from "./ManuscriptOrderKey";

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
  readonly movedPath: string | null;
  readonly beforeEntries: readonly ManuscriptDocumentRecord[];
  readonly entries: readonly ManuscriptDocumentRecord[];
  readonly parentChange: ManuscriptParentChange | null;
  readonly message: string;
}

export interface ManuscriptOrderKeyChange {
  readonly path: string;
  readonly beforeOrderKey: string | null;
  readonly afterOrderKey: string;
  readonly beforeParentPath: string;
  readonly afterParentPath: string;
}

export interface DistributedManuscriptMoveWritePlan {
  readonly valid: boolean;
  readonly changes: readonly ManuscriptOrderKeyChange[];
  readonly rebalanced: boolean;
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
    movedPath: null,
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
      && manuscriptOrderKey(entry.orderKey) === manuscriptOrderKey(right[index]?.orderKey)
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
    movedPath: moved.path,
    beforeEntries: entries,
    entries: reordered,
    parentChange,
    message: parentChange
      ? `Moved ${moved.title} into ${destination}.`
      : `Moved ${moved.title}.`
  };
}

function invalidWritePlan(message: string): DistributedManuscriptMoveWritePlan {
  return { valid: false, changes: [], rebalanced: false, message };
}

export function planDistributedManuscriptMoveWrites(
  bookPath: string,
  proposal: ManuscriptMoveProposal
): DistributedManuscriptMoveWritePlan {
  if (!proposal.valid || !proposal.movedPath) {
    return invalidWritePlan(proposal.message);
  }

  const movedBefore = proposal.beforeEntries.find((entry) => (
    entry.path === proposal.movedPath
  ));
  const movedAfter = proposal.entries.find((entry) => (
    entry.path === proposal.movedPath
  ));
  if (!movedBefore || !movedAfter) {
    return invalidWritePlan("The moved manuscript entry could not be resolved.");
  }

  const afterParentPath = effectiveParent(movedAfter, bookPath);
  const siblings = proposal.entries.filter((entry) => (
    entry.kind !== "book"
    && effectiveParent(entry, bookPath) === afterParentPath
  ));
  const movedIndex = siblings.findIndex((entry) => entry.path === movedAfter.path);
  if (movedIndex < 0) {
    return invalidWritePlan("The moved manuscript entry is absent from its destination.");
  }

  const beforeSibling = siblings[movedIndex - 1] ?? null;
  const afterSibling = siblings[movedIndex + 1] ?? null;
  const beforeKey = beforeSibling ? manuscriptOrderKey(beforeSibling.orderKey) : null;
  const afterKey = afterSibling ? manuscriptOrderKey(afterSibling.orderKey) : null;

  if ((beforeSibling && !beforeKey) || (afterSibling && !afterKey)) {
    return invalidWritePlan("Reconcile missing or malformed sibling order keys before moving this entry.");
  }

  const insertedKey = manuscriptOrderKeyBetween(beforeKey, afterKey);
  if (insertedKey) {
    return {
      valid: true,
      rebalanced: false,
      message: proposal.message,
      changes: [{
        path: movedAfter.path,
        beforeOrderKey: manuscriptOrderKey(movedBefore.orderKey),
        afterOrderKey: insertedKey,
        beforeParentPath: effectiveParent(movedBefore, bookPath),
        afterParentPath
      }]
    };
  }

  const keys = evenlySpacedManuscriptOrderKeys(siblings.length);
  const beforeByPath = new Map(
    proposal.beforeEntries.map((entry) => [entry.path, entry])
  );
  const changes = siblings
    .map((entry, index): ManuscriptOrderKeyChange => {
      const before = beforeByPath.get(entry.path) ?? entry;
      return {
        path: entry.path,
        beforeOrderKey: manuscriptOrderKey(before.orderKey),
        afterOrderKey: keys[index],
        beforeParentPath: effectiveParent(before, bookPath),
        afterParentPath: effectiveParent(entry, bookPath)
      };
    })
    .filter((change) => (
      change.beforeOrderKey !== change.afterOrderKey
      || change.beforeParentPath !== change.afterParentPath
    ));

  return {
    valid: true,
    changes,
    rebalanced: true,
    message: `${proposal.message} Rebalanced ${siblings.length} sibling order keys.`
  };
}

/** Retained only for legacy-array migration and recovery tooling. */
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
  const ordered = entries.filter((entry) => (
    entry.path === moved.path
    || (
      entry.kind !== "book"
      && effectiveParent(entry, bookPath) === parentPath
    )
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
