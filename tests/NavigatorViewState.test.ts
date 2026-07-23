import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
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
