import { equal } from "node:assert/strict";
import { test } from "node:test";
import { shouldRefreshNavigator } from "../src/manuscript/NavigatorRefreshPolicy";

test("defers only the transient refresh while a scene press activates the navigator leaf", () => {
  equal(shouldRefreshNavigator({
    navigatorIsActive: true,
    sceneActivationInProgress: true
  }), false);
});

test("keeps book selection and other navigator controls refreshable", () => {
  equal(shouldRefreshNavigator({
    navigatorIsActive: true,
    sceneActivationInProgress: false
  }), true);
});

test("refreshes after the scene has opened in an editor leaf", () => {
  equal(shouldRefreshNavigator({
    navigatorIsActive: false,
    sceneActivationInProgress: true
  }), true);
});
