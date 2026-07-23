import { deepEqual } from "node:assert/strict";
import { test } from "node:test";
import {
  dispositionContinuityRefreshDecision,
  metadataContinuityRefreshDecision,
  shouldScheduleSettledStoryWorldRefresh
} from "../src/companion/ContinuityRefresh";

const dependencies = new Set([
  "Books/Part/Scene One.md",
  "Books/Part/Scene Two.md",
  "Books/Part.md"
]);

test("editing a sibling scene date schedules a continuity refresh", () => {
  deepEqual(metadataContinuityRefreshDecision({
    changedPath: "Books/Part/Scene Two.md",
    manuscriptDependencies: dependencies,
    worldChanged: false,
    currentChapterChanged: false,
    currentBookChanged: false
  }), {
    companion: false,
    manuscriptNavigator: true,
    deferredChronology: true
  });
});

test("changing authoritative part order schedules a continuity refresh", () => {
  deepEqual(metadataContinuityRefreshDecision({
    changedPath: "Books/Part.md",
    manuscriptDependencies: dependencies,
    worldChanged: false,
    currentChapterChanged: false,
    currentBookChanged: false
  }), {
    companion: false,
    manuscriptNavigator: true,
    deferredChronology: true
  });
});

test("changing a disposition refreshes the Companion immediately", () => {
  deepEqual(dispositionContinuityRefreshDecision(), {
    companion: true,
    manuscriptNavigator: false,
    deferredChronology: false
  });
});

test("known Story World notes receive a settled-cache refresh when the first index read appears unchanged", () => {
  deepEqual(shouldScheduleSettledStoryWorldRefresh(true, false), true);
  deepEqual(shouldScheduleSettledStoryWorldRefresh(false, true), true);
  deepEqual(shouldScheduleSettledStoryWorldRefresh(false, false), false);
});
