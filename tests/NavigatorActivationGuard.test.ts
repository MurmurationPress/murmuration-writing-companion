import { equal } from "node:assert/strict";
import { test } from "node:test";
import {
  NAVIGATOR_CLICK_SHIELD_MS,
  shouldShieldNavigatorSceneActivation
} from "../src/manuscript/NavigatorActivationGuard";

test("shields only a genuine first mouse activation", () => {
  equal(shouldShieldNavigatorSceneActivation(0), false);
  equal(shouldShieldNavigatorSceneActivation(1), true);
  equal(shouldShieldNavigatorSceneActivation(2), false);
});

test("uses a bounded shield interval", () => {
  equal(NAVIGATOR_CLICK_SHIELD_MS > 0, true);
  equal(NAVIGATOR_CLICK_SHIELD_MS <= 500, true);
});
