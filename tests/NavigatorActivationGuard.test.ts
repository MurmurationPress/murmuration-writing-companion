import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  NAVIGATOR_ACTIVATION_GUARD_MS,
  NavigatorActivationGuard
} from "../src/manuscript/NavigatorActivationGuard";

test("blocks rapid follow-up activations while the navigator may be rerendering", () => {
  const guard = new NavigatorActivationGuard();
  guard.begin(1_000);

  equal(guard.blocks(1_000), true);
  equal(guard.blocks(1_000 + NAVIGATOR_ACTIVATION_GUARD_MS - 1), true);
  equal(guard.blocks(1_000 + NAVIGATOR_ACTIVATION_GUARD_MS), false);
});

test("can be cleared when the plugin unloads", () => {
  const guard = new NavigatorActivationGuard();
  guard.begin(1_000);
  guard.clear();

  equal(guard.blocks(1_001), false);
});
