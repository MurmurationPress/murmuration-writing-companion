import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  forEachInitializedManuscriptView,
  InitializedManuscriptActionView,
  MANUSCRIPT_ACTION_VIEW,
  MANUSCRIPT_ACTION_VIEW_TYPE
} from "../src/manuscript/ManuscriptViewActions";

function initializedView(name: string): InitializedManuscriptActionView & { readonly name: string } {
  return {
    name,
    [MANUSCRIPT_ACTION_VIEW]: true,
    containerEl: {} as HTMLElement,
    addAction: () => ({}) as HTMLElement,
    setPreparationActionsRenderer: () => undefined
  };
}

function lifecycle(initialView: unknown) {
  const leaves = [{ view: initialView }];
  const workspace = {
    getLeavesOfType: (type: string) => type === MANUSCRIPT_ACTION_VIEW_TYPE ? leaves : []
  };
  return {
    workspace,
    replaceView: (view: unknown) => { leaves[0].view = view; },
    addLeaf: (view: unknown) => leaves.push({ view })
  };
}

test("semantic Manuscript view check excludes restored placeholders and unrelated views", () => {
  const actual = initializedView("actual");
  const placeholder = {
    getViewType: () => MANUSCRIPT_ACTION_VIEW_TYPE,
    containerEl: {},
    rerender: () => undefined
  };
  const wrongItemView = {
    getViewType: () => "unrelated-view",
    addAction: () => undefined,
    [MANUSCRIPT_ACTION_VIEW]: false
  };
  const visited: InitializedManuscriptActionView[] = [];
  const workspace = {
    getLeavesOfType: () => [
      { view: placeholder },
      { view: wrongItemView },
      { view: actual }
    ]
  };

  forEachInitializedManuscriptView(workspace, (view) => visited.push(view));

  deepEqual(visited, [actual]);
});

test("restored view is skipped early and both action families attach after initialization", () => {
  const placeholder = {
    getViewType: () => MANUSCRIPT_ACTION_VIEW_TYPE,
    containerEl: {},
    rerender: () => undefined
  };
  const state = lifecycle(placeholder);
  const preparation = new WeakSet<InitializedManuscriptActionView>();
  const reconciliation = new WeakSet<InitializedManuscriptActionView>();
  const attached: string[] = [];
  const register = () => {
    forEachInitializedManuscriptView(state.workspace, (view) => {
      if (!preparation.has(view)) { preparation.add(view); attached.push("preparation"); }
      if (!reconciliation.has(view)) { reconciliation.add(view); attached.push("reconciliation"); }
    });
  };

  register();
  deepEqual(attached, []);
  equal("addAction" in placeholder, false);

  state.replaceView(initializedView("restored"));
  register();
  register();
  deepEqual(attached, ["preparation", "reconciliation"]);
});

test("open-later and multiple Manuscript views receive independent idempotent actions", () => {
  const first = initializedView("first");
  const state = lifecycle(first);
  const visited: string[] = [];
  const seen = new WeakSet<InitializedManuscriptActionView>();
  const register = () => forEachInitializedManuscriptView(state.workspace, (view) => {
    if (seen.has(view)) return;
    seen.add(view);
    visited.push((view as typeof first).name);
  });
  register();
  const second = initializedView("second");
  state.addLeaf(second);
  register();
  register();
  deepEqual(visited, ["first", "second"]);
});

test("simulated reload restores both action families on a new initialized view", () => {
  const firstLifecycle = lifecycle({ getViewType: () => MANUSCRIPT_ACTION_VIEW_TYPE });
  const firstVisited: string[] = [];
  forEachInitializedManuscriptView(firstLifecycle.workspace, () => firstVisited.push("early"));
  firstLifecycle.replaceView(initializedView("first load"));
  forEachInitializedManuscriptView(firstLifecycle.workspace, (view) => firstVisited.push((view as unknown as { name: string }).name));
  deepEqual(firstVisited, ["first load"]);

  const reloadLifecycle = lifecycle({ getViewType: () => MANUSCRIPT_ACTION_VIEW_TYPE });
  const reloadVisited: string[] = [];
  forEachInitializedManuscriptView(reloadLifecycle.workspace, () => reloadVisited.push("early"));
  reloadLifecycle.replaceView(initializedView("reload"));
  forEachInitializedManuscriptView(reloadLifecycle.workspace, (view) => reloadVisited.push((view as unknown as { name: string }).name));
  deepEqual(reloadVisited, ["reload"]);
});
