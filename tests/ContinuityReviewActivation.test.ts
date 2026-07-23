import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  ContinuityReviewActivation,
  ContinuityReviewCollectionCoordinator,
  continuityReviewDependencyChanged,
  ContinuityReviewLeaf,
  ContinuityReviewWorkspace
} from "../src/companion/ContinuityReviewActivation";

interface Leaf extends ContinuityReviewLeaf {
  readonly id: string;
  readonly states: Array<{ type: string; active: boolean; state?: Record<string, unknown> }>;
}

function leaf(id: string, wait?: Promise<void>): Leaf {
  const value: Leaf = {
    id,
    view: {},
    states: [],
    setViewState: async (state) => { value.states.push(state); await wait; }
  };
  return value;
}

function workspace(existing: Leaf[], created: Leaf) {
  let requests = 0;
  const revealed: Leaf[] = [];
  const value: ContinuityReviewWorkspace<Leaf> = {
    getLeavesOfType: () => existing,
    getLeaf: () => { requests += 1; return created; },
    revealLeaf: async (item) => { revealed.push(item); }
  };
  return { value, revealed, requests: () => requests };
}

test("Continuity Review reuses its existing centre-pane leaf", async () => {
  const existing = leaf("existing");
  const mock = workspace([existing], leaf("unused"));
  const result = await new ContinuityReviewActivation().activate(mock.value, "continuity-review", "Book/A.md");
  equal(result, existing);
  equal(mock.requests(), 0);
  deepEqual(mock.revealed, [existing]);
});

test("late collection results cannot replace the latest selected book", async () => {
  const coordinator = new ContinuityReviewCollectionCoordinator();
  let releasePlurality!: () => void;
  const pluralityWait = new Promise<void>((resolve) => { releasePlurality = resolve; });
  const plurality = coordinator.request(async () => { await pluralityWait; return "PLURALITY"; });
  const emergence = coordinator.request(async () => "EMERGENCE");
  equal((await emergence).current, true);
  releasePlurality();
  equal((await plurality).current, false);
});

test("rapid collection requests publish only the final selected book", async () => {
  const coordinator = new ContinuityReviewCollectionCoordinator();
  const first = coordinator.request(async () => "PLURALITY");
  const second = coordinator.request(async () => "EMERGENCE");
  const third = coordinator.request(async () => "CONVERGENCE");
  equal((await first).current, false);
  equal((await second).current, false);
  deepEqual(await third, { current: true, value: "CONVERGENCE" });
});

test("Continuity Review creates one tab with initial book state", async () => {
  const created = leaf("created");
  const mock = workspace([], created);
  await new ContinuityReviewActivation().activate(mock.value, "continuity-review", "Book/A.md");
  equal(mock.requests(), 1);
  deepEqual(created.states, [{ type: "continuity-review", active: true, state: { bookPath: "Book/A.md" } }]);
});

test("overlapping Continuity Review activation is coalesced", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const created = leaf("created", waiting);
  const mock = workspace([], created);
  const activation = new ContinuityReviewActivation();
  const first = activation.activate(mock.value, "continuity-review", "Book/A.md");
  const second = activation.activate(mock.value, "continuity-review", "Book/A.md");
  equal(mock.requests(), 1);
  release();
  await Promise.all([first, second]);
  equal(mock.requests(), 1);
});

test("a referenced Story World metadata change requires full recollection", () => {
  const dependencies = new Set(["Books/PLURALITY/Scene.md", "World/Referenced Entity.md"]);
  equal(continuityReviewDependencyChanged(dependencies, "World/Referenced Entity.md"), true);
  equal(continuityReviewDependencyChanged(dependencies, "World/Unrelated.md"), false);
});
