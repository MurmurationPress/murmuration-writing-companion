import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { StoryWorldTimelineActivation, TimelineLeaf, TimelineWorkspace } from "../src/story-world/StoryWorldTimelineActivation";

interface Leaf extends TimelineLeaf { id: string; states: Array<{ type: string; active: boolean }>; }
function leaf(id: string, wait?: Promise<void>): Leaf { const value: Leaf = { id, states: [], setViewState: async (state) => { value.states.push(state); await wait; } }; return value; }
function workspace(existing: Leaf[], created: Leaf) {
  let requests = 0; const revealed: Leaf[] = [];
  const value: TimelineWorkspace<Leaf> = { getLeavesOfType: () => existing, getLeaf: () => { requests += 1; return created; }, revealLeaf: async (item) => { revealed.push(item); } };
  return { value, revealed, requests: () => requests };
}

test("reuses and reveals an existing timeline leaf", async () => {
  const existing = leaf("existing"); const mock = workspace([existing], leaf("unused"));
  await new StoryWorldTimelineActivation().activate(mock.value, "timeline");
  equal(mock.requests(), 0); deepEqual(mock.revealed, [existing]); deepEqual(existing.states, []);
});

test("creates a timeline tab only when none exists", async () => {
  const created = leaf("created"); const mock = workspace([], created);
  await new StoryWorldTimelineActivation().activate(mock.value, "timeline");
  equal(mock.requests(), 1); deepEqual(created.states, [{ type: "timeline", active: true }]); deepEqual(mock.revealed, [created]);
});

test("coalesces overlapping timeline activation", async () => {
  let release!: () => void; const waiting = new Promise<void>((resolve) => { release = resolve; });
  const created = leaf("created", waiting); const mock = workspace([], created); const activation = new StoryWorldTimelineActivation();
  const first = activation.activate(mock.value, "timeline"); const second = activation.activate(mock.value, "timeline");
  equal(mock.requests(), 1); release(); await Promise.all([first, second]); equal(mock.requests(), 1);
});
