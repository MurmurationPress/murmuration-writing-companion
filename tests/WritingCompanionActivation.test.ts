import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  WritingCompanionActivation,
  WritingCompanionLeaf,
  WritingCompanionWorkspace
} from "../src/companion/WritingCompanionActivation";

const VIEW_TYPE = "writing-companion";

interface MockLeaf extends WritingCompanionLeaf {
  readonly id: string;
  states: Array<{ type: string; active: boolean }>;
}

function leaf(id: string, setViewState?: MockLeaf["setViewState"]): MockLeaf {
  const states: MockLeaf["states"] = [];
  return {
    id,
    states,
    setViewState: setViewState ?? (async (state) => { states.push(state); })
  };
}

function workspace(existing: MockLeaf[], right: MockLeaf | null) {
  const revealed: MockLeaf[] = [];
  let rightLeafRequests = 0;
  const value: WritingCompanionWorkspace<MockLeaf> = {
    getLeavesOfType: () => existing,
    getRightLeaf: () => {
      rightLeafRequests += 1;
      return right;
    },
    revealLeaf: async (target) => { revealed.push(target); }
  };
  return { value, revealed, rightLeafRequests: () => rightLeafRequests };
}

test("reveals an existing Companion leaf without requesting another right leaf", async () => {
  const existing = leaf("existing");
  const mock = workspace([existing], leaf("unused"));

  equal(await new WritingCompanionActivation().activate(mock.value, VIEW_TYPE), true);
  equal(mock.rightLeafRequests(), 0);
  deepEqual(mock.revealed, [existing]);
  deepEqual(existing.states, []);
});

test("creates and reveals a right leaf when no Companion leaf exists", async () => {
  const created = leaf("created");
  const mock = workspace([], created);

  equal(await new WritingCompanionActivation().activate(mock.value, VIEW_TYPE), true);
  equal(mock.rightLeafRequests(), 1);
  deepEqual(created.states, [{ type: VIEW_TYPE, active: true }]);
  deepEqual(mock.revealed, [created]);
});

test("coalesces overlapping activations while a Companion leaf is initialising", async () => {
  let finishInitialising!: () => void;
  const initialising = new Promise<void>((resolve) => { finishInitialising = resolve; });
  const created = leaf("created", async (state) => {
    created.states.push(state);
    await initialising;
  });
  const mock = workspace([], created);
  const activation = new WritingCompanionActivation();

  const first = activation.activate(mock.value, VIEW_TYPE);
  const second = activation.activate(mock.value, VIEW_TYPE);
  equal(mock.rightLeafRequests(), 1);

  finishInitialising();
  deepEqual(await Promise.all([first, second]), [true, true]);
  equal(mock.rightLeafRequests(), 1);
  deepEqual(created.states, [{ type: VIEW_TYPE, active: true }]);
  deepEqual(mock.revealed, [created]);
});
