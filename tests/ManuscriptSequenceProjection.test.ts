import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import type { ManuscriptOrderNode } from "../src/manuscript/ManuscriptOrder";
import { deriveManuscriptSequenceProjection as project } from "../src/manuscript/ManuscriptSequenceProjection";
const node = (path: string, kind = "scene", children: ManuscriptOrderNode[] = []): ManuscriptOrderNode => ({ entry: { path, kind } as any, children });
test("book-local mixed roots preserve lexical Navigator order beyond old two/three digit widths", () => {
  const roots = [node("Prologue"), node("Part", "part", [node("First"), node("Second")]),
    ...Array.from({ length: 105 }, (_, i) => node(`Tail ${i}`))];
  const result = project({ bookPath: "Zulu Book", roots });
  const rows = [...result.valuesByPath];
  deepEqual(rows.slice(0, 3).map(([, v]) => v), [
    { manuscriptSequence: "0000000001.0000000000", bookSceneNumber: 1 },
    { manuscriptSequence: "0000000002.0000000001", bookSceneNumber: 2 },
    { manuscriptSequence: "0000000002.0000000002", bookSceneNumber: 3 }
  ]);
  deepEqual([...rows].sort((a,b) => a[1].manuscriptSequence.localeCompare(b[1].manuscriptSequence)), rows);
  deepEqual(project({ bookPath: "AAA Renamed", roots }), result);
});
test("nested unsupported hierarchy is omitted", () => {
  const result = project({ bookPath: "Book", roots: [node("Part", "part", [node("Inner", "part", [node("Scene")])])] });
  equal(result.valuesByPath.size, 0);
  deepEqual(result.omitted, [{ path: "Scene", reason: "unsupported_depth" }]);
});
