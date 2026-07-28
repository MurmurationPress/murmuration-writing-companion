import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import type {
  ManuscriptDocumentRecord,
  ManuscriptOrderNode
} from "../src/manuscript/ManuscriptOrder";
import { deriveManuscriptSequenceProjection } from "../src/manuscript/ManuscriptSequenceProjection";

function record(
  path: string,
  kind: ManuscriptDocumentRecord["kind"],
  bookPath: string,
  parentPath: string | null
): ManuscriptDocumentRecord {
  const basename = path.split("/").pop()!.replace(/\.md$/i, "");
  return {
    path,
    basename,
    title: basename,
    kind,
    bookPath,
    parentPath,
    orderKey: null,
    orderKeyPresent: true,
    explicitParent: kind !== "book",
    parentReferenceInvalid: false
  };
}

function node(
  entry: ManuscriptDocumentRecord,
  children: readonly ManuscriptOrderNode[] = []
): ManuscriptOrderNode {
  return { entry, children };
}

test("derives lexical, per-book and series scene sequence from Navigator roots", () => {
  const bookOne = "Books/EMERGENCE.md";
  const bookTwo = "Books/PLURALITY.md";
  const detection = record("Books/EMERGENCE/DETECTION.md", "part", bookOne, bookOne);
  const first = record("Books/EMERGENCE/First Path.md", "scene", bookOne, detection.path);
  const second = record("Books/EMERGENCE/Quiet Load.md", "scene", bookOne, detection.path);
  const prologue = record("Books/PLURALITY/Prologue.md", "scene", bookTwo, bookTwo);
  const experiment = record("Books/PLURALITY/EXPERIMENT.md", "part", bookTwo, bookTwo);
  const domestic = record("Books/PLURALITY/Domestic Distance.md", "scene", bookTwo, experiment.path);

  const projection = deriveManuscriptSequenceProjection([
    { bookPath: bookOne, roots: [node(detection, [node(first), node(second)])] },
    { bookPath: bookTwo, roots: [node(prologue), node(experiment, [node(domestic)])] }
  ]);

  deepEqual(projection.valuesByPath.get(first.path), {
    manuscriptSequence: "01.01.001",
    bookSceneNumber: 1,
    seriesSceneNumber: 1
  });
  deepEqual(projection.valuesByPath.get(second.path), {
    manuscriptSequence: "01.01.002",
    bookSceneNumber: 2,
    seriesSceneNumber: 2
  });
  deepEqual(projection.valuesByPath.get(prologue.path), {
    manuscriptSequence: "02.01.000",
    bookSceneNumber: 1,
    seriesSceneNumber: 3
  });
  deepEqual(projection.valuesByPath.get(domestic.path), {
    manuscriptSequence: "02.02.001",
    bookSceneNumber: 2,
    seriesSceneNumber: 4
  });

  const lexical = [...projection.valuesByPath.entries()]
    .sort((left, right) => left[1].manuscriptSequence.localeCompare(right[1].manuscriptSequence))
    .map(([path]) => path);
  deepEqual(lexical, [first.path, second.path, prologue.path, domestic.path]);
});

test("renames do not change values when structural position is unchanged", () => {
  const bookPath = "Books/PLURALITY.md";
  const part = record("Books/PLURALITY/INTERVENTION.md", "part", bookPath, bookPath);
  const original = record("Books/PLURALITY/The Corridor.md", "scene", bookPath, part.path);
  const renamed = record("Books/PLURALITY/Corridor.md", "scene", bookPath, part.path);

  const before = deriveManuscriptSequenceProjection([
    { bookPath, roots: [node(part, [node(original)])] }
  ]);
  const after = deriveManuscriptSequenceProjection([
    { bookPath, roots: [node(part, [node(renamed)])] }
  ]);

  equal(before.valuesByPath.get(original.path)?.manuscriptSequence, "01.01.001");
  equal(after.valuesByPath.get(renamed.path)?.manuscriptSequence, "01.01.001");
});

test("omits unsupported nested scene hierarchy rather than inventing a position", () => {
  const bookPath = "Books/PLURALITY.md";
  const outer = record("Books/PLURALITY/Outer.md", "part", bookPath, bookPath);
  const inner = record("Books/PLURALITY/Inner.md", "part", bookPath, outer.path);
  const scene = record("Books/PLURALITY/Nested Scene.md", "scene", bookPath, inner.path);

  const projection = deriveManuscriptSequenceProjection([
    { bookPath, roots: [node(outer, [node(inner, [node(scene)])])] }
  ]);

  equal(projection.valuesByPath.has(scene.path), false);
  deepEqual(projection.omitted, [{
    path: scene.path,
    reason: "unsupported_depth"
  }]);
});
