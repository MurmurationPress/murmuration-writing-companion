import type { ManuscriptOrderNode } from "./ManuscriptOrder";

export const MANUSCRIPT_SEQUENCE_PROPERTY = "manuscript_sequence";
export const BOOK_SCENE_NUMBER_PROPERTY = "book_scene_number";

export interface ManuscriptSequenceValues {
  readonly manuscriptSequence: string;
  readonly bookSceneNumber: number;
}

export interface ManuscriptSequenceBook {
  readonly bookPath: string;
  readonly roots: readonly ManuscriptOrderNode[];
}

export interface OmittedManuscriptSequenceScene {
  readonly path: string;
  readonly reason: "unsupported_depth" | "invalid_structure";
}

export interface ManuscriptSequenceProjection {
  readonly valuesByPath: ReadonlyMap<string, ManuscriptSequenceValues>;
  readonly omitted: readonly OmittedManuscriptSequenceScene[];
}

/**
 * Derives a disposable Bases-facing projection from the Navigator's resolved tree.
 *
 * The first segment is the root position within the Book. For ordinary
 * Book → Part → Scene structure this is the Part position. A Scene directly
 * under a Book uses 0000000000 for the final segment, preserving lexical Navigator
 * order without inventing a Part.
 */
export function deriveManuscriptSequenceProjection(
  book: ManuscriptSequenceBook
): ManuscriptSequenceProjection {
  const valuesByPath = new Map<string, ManuscriptSequenceValues>();
  const omitted: OmittedManuscriptSequenceScene[] = [];

  let bookSceneNumber = 0;

  book.roots.forEach((root, rootIndex) => {
    const rootPosition = rootIndex + 1;

    if (root.entry.kind === "scene") {
      bookSceneNumber += 1;
      valuesByPath.set(root.entry.path, {
        manuscriptSequence: formatSequence(rootPosition, 0),
        bookSceneNumber
      });
      return;
    }

    if (root.entry.kind !== "part") {
      collectScenePaths(root).forEach((path) => omitted.push({
        path,
        reason: "invalid_structure"
      }));
      return;
    }

    let scenePosition = 0;
    for (const child of root.children) {
      if (child.entry.kind !== "scene") {
        collectScenePaths(child).forEach((path) => omitted.push({
          path,
          reason: "unsupported_depth"
        }));
        continue;
      }

      scenePosition += 1;
      bookSceneNumber += 1;
      valuesByPath.set(child.entry.path, {
        manuscriptSequence: formatSequence(rootPosition, scenePosition),
        bookSceneNumber
      });
    }
  });

  return { valuesByPath, omitted };
}

function collectScenePaths(node: ManuscriptOrderNode): string[] {
  const paths = node.entry.kind === "scene" ? [node.entry.path] : [];
  for (const child of node.children) paths.push(...collectScenePaths(child));
  return paths;
}

function formatSequence(root: number, scene: number): string {
  return `${pad(root, 10)}.${pad(scene, 10)}`;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
