import { equal } from "node:assert/strict";
import { test } from "node:test";
import { isRepeatedNavigatorActivation } from "../src/manuscript/NavigatorActivationGuard";

test("allows keyboard and first-click navigator activation", () => {
  equal(isRepeatedNavigatorActivation(0), false);
  equal(isRepeatedNavigatorActivation(1), false);
});

test("rejects second and later mouse activations without retaining state", () => {
  equal(isRepeatedNavigatorActivation(2), true);
  equal(isRepeatedNavigatorActivation(3), true);
  equal(isRepeatedNavigatorActivation(1), false);
});
