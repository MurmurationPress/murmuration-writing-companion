import { deepEqual } from "node:assert/strict";
import { test } from "node:test";
import {
  dispositionContinuityRefreshDecision,
  metadataContinuityRefreshDecision
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

test('settled manuscript reconciliation owns metadata pane refresh and supersedes the early chronology timer', () => {
  deepEqual(metadataContinuityRefreshDecision({changedPath:'Scene.md',settledManuscript:true,manuscriptDependencies:new Set(['Scene.md']),worldChanged:false,currentChapterChanged:true,currentBookChanged:false}),{companion:false,manuscriptNavigator:false,deferredChronology:false});
});
