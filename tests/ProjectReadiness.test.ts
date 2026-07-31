import { equal, ok } from "node:assert/strict";
import { test } from "node:test";
import type { ManuscriptPreparationPlan, ManuscriptPreparationState } from "../src/manuscript/ManuscriptPreparation";
import { projectReadiness, ProjectReadinessInput } from "../src/onboarding/ProjectReadiness";

function plan(state: ManuscriptPreparationState, overrides: Partial<ManuscriptPreparationPlan> = {}): ManuscriptPreparationPlan {
  const canApply = state === "legacy_array" || state === "deterministic_folder_order";
  return {
    bookPath: `Books/${state}.md`, bookTitle: state.replace(/_/g, " "), source: state === "fully_prepared" || state === "partially_distributed" ? "distributed" : state === "legacy_array" ? "legacy_array" : "legacy",
    files: [], diagnostics: [], canApply, alreadyPrepared: state === "fully_prepared", state, ...overrides
  };
}

function input(plans: ManuscriptPreparationPlan[], entities = 0, editorial: "absent" | "present" | "unreadable" = "absent", markdownFileCount = plans.length ? 10 : 0): ProjectReadinessInput {
  return { markdownFileCount, unresolvedManuscriptNotes: [], manuscripts: plans.map((value) => ({ plan: value, partCount: 2, sceneCount: 7 })), storyWorld: { entityCount: entities, eventCount: entities ? 2 : 0, significantObservationCount: entities ? 1 : 0 }, editorialStorageState: editorial };
}

test("a clean vault is ready to use and is not described as broken", () => {
  const result = projectReadiness(input([]));
  equal(result.overallState, "ready_to_begin");
  equal(result.headline, "Ready to begin");
  ok(!`${result.headline} ${result.summary}`.toLowerCase().includes("broken"));
  equal(result.actions.some((action) => action.id === "prepare_manuscript"), false);
});

test("an existing-note vault explains why folders alone are not a manuscript", () => {
  const result = projectReadiness(input([], 0, "absent", 8));
  equal(result.overallState, "no_manuscript");
  equal(result.headline, "Existing notes found, but no manuscript is recognised");
  ok(result.summary.includes("8 Markdown notes"));
  ok(result.summary.includes("Folder names alone"));
  equal(result.actions.some((action) => action.id === "prepare_manuscript"), false);
});

test("the #91 preparation state is retained and safely actionable states open its workflow", () => {
  for (const state of ["legacy_array", "deterministic_folder_order"] as const) {
    const result = projectReadiness(input([plan(state)]));
    equal(result.manuscripts[0].state, state);
    equal(result.overallState, "preparation_available");
    equal(result.manuscripts[0].actions[0].id, "prepare_manuscript");
    equal(result.manuscripts[0].actions[0].bookPath, `Books/${state}.md`);
  }
});

test("fully prepared Books do not prompt for preparation", () => {
  const result = projectReadiness(input([plan("fully_prepared")]));
  equal(result.overallState, "project_prepared");
  equal(result.manuscripts[0].actions.some((action) => action.id === "prepare_manuscript"), false);
  ok(result.manuscripts[0].actions.some((action) => action.id === "run_continuity_review"));
});

test("blocked #91 states preserve actionable diagnostics and never enable preparation", () => {
  const states: ManuscriptPreparationState[] = ["conflicting_distributed_metadata", "malformed_or_incomplete_legacy_metadata", "ambiguous_hierarchy", "unsupported_or_unrecognised"];
  for (const state of states) {
    const result = projectReadiness(input([plan(state, { canApply: false, diagnostics: [{ path: "Books/Test/Scene.md", message: "parent cannot be resolved" }] })]));
    equal(result.overallState, "structural_conflict");
    equal(result.manuscripts[0].canPrepare, false);
    equal(result.manuscripts[0].actions[0].id, "view_preparation_diagnostics");
    ok(result.manuscripts[0].diagnostics[0].includes("Books/Test/Scene.md"));
    ok(result.manuscripts[0].diagnostics[0].includes("parent"));
  }
});

test("partially distributed Books only offer preparation when #91 says it is safe", () => {
  const safe = projectReadiness(input([plan("partially_distributed", { canApply: true })]));
  equal(safe.overallState, "preparation_available");
  equal(safe.manuscripts[0].actions[0].id, "prepare_manuscript");
  const blocked = projectReadiness(input([plan("partially_distributed", { canApply: false, diagnostics: [{ message: "duplicate order key" }] })]));
  equal(blocked.overallState, "preparation_needs_attention");
  equal(blocked.manuscripts[0].actions.some((action) => action.id === "prepare_manuscript"), false);
});

test("multiple Books retain independent states and conflicts govern the combined presentation", () => {
  const result = projectReadiness(input([plan("fully_prepared"), plan("legacy_array"), plan("ambiguous_hierarchy", { canApply: false })]));
  equal(result.bookCount, 3);
  equal(result.partCount, 6);
  equal(result.sceneCount, 21);
  equal(result.overallState, "structural_conflict");
  equal(result.manuscripts[1].canPrepare, true);
  equal(result.manuscripts[2].canPrepare, false);
});

test("Story World and editorial storage are independent optional signals", () => {
  const absent = projectReadiness(input([plan("fully_prepared")]));
  equal(absent.storyWorld.state, "absent");
  ok(absent.storyWorld.summary.includes("optional"));
  equal(absent.editorialStorage.state, "absent");
  const present = projectReadiness(input([plan("fully_prepared")], 9, "present"));
  equal(present.storyWorld.state, "needs_review");
  equal(present.storyWorld.entityCount, 9);
  equal(present.storyWorld.eventCount, 2);
  equal(present.editorialStorage.state, "present");
  ok(present.actions.some((action) => action.id === "open_story_world_navigator"));
});

test("author-facing copy never displays raw preparation enum values", () => {
  const result = projectReadiness(input([plan("malformed_or_incomplete_legacy_metadata", { canApply: false })]));
  const visible = JSON.stringify({ headline: result.headline, summary: result.summary, label: result.manuscripts[0].stateLabel, bookSummary: result.manuscripts[0].summary });
  equal(visible.includes("malformed_or_incomplete_legacy_metadata"), false);
});
