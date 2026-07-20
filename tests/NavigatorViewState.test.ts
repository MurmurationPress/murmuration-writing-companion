import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  reconcileNavigatorBookSelection,
  renderAndRetainFirst
} from "../src/manuscript/NavigatorViewState";

test("renders later siblings after the active row has already been found", () => {
  let rendered = 0;
  const existing = { id: "active" };

  const result = renderAndRetainFirst(existing, () => {
    rendered += 1;
    return { id: "later" };
  });

  equal(rendered, 1);
  equal(result, existing);
});

test("retains the first rendered row when none has been found yet", () => {
  const rendered = { id: "active" };
  equal(renderAndRetainFirst(null, () => rendered), rendered);
});

test("follows the active book initially", () => {
  deepEqual(
    reconcileNavigatorBookSelection({
      selectedBookPath: null,
      lastActivePath: null,
      pinned: false
    }, "Books/One/Scene.md", "Books/One.md"),
    {
      selectedBookPath: "Books/One.md",
      lastActivePath: "Books/One/Scene.md",
      pinned: false
    }
  );
});

test("preserves a manual book choice while the active scene is unchanged", () => {
  deepEqual(
    reconcileNavigatorBookSelection({
      selectedBookPath: "Books/Two.md",
      lastActivePath: "Books/One/Scene.md",
      pinned: true
    }, "Books/One/Scene.md", "Books/One.md"),
    {
      selectedBookPath: "Books/Two.md",
      lastActivePath: "Books/One/Scene.md",
      pinned: true
    }
  );
});

test("a new active scene releases the manual choice and follows its book", () => {
  deepEqual(
    reconcileNavigatorBookSelection({
      selectedBookPath: "Books/Two.md",
      lastActivePath: "Books/One/Scene.md",
      pinned: true
    }, "Books/Three/Scene.md", "Books/Three.md"),
    {
      selectedBookPath: "Books/Three.md",
      lastActivePath: "Books/Three/Scene.md",
      pinned: false
    }
  );
});

test("a non-manuscript active file leaves the selected book unchanged", () => {
  deepEqual(
    reconcileNavigatorBookSelection({
      selectedBookPath: "Books/Two.md",
      lastActivePath: "Books/One/Scene.md",
      pinned: true
    }, null, null),
    {
      selectedBookPath: "Books/Two.md",
      lastActivePath: null,
      pinned: false
    }
  );
});
