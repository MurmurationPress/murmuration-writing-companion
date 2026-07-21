import { deepEqual } from "node:assert/strict";
import { test } from "node:test";
import { navigateTimelineSelection, TimelineSelectionQueue, timelineSelectionLeaf } from "../src/story-world/TimelineSelectionNavigation";

test("establishes selected Markdown context before Companion refresh and restores editor focus", async () => {
  const calls: string[] = [];
  await navigateTimelineSelection({
    openSelectedNote: async () => { calls.push("open note"); },
    setSelectedNoteActive: () => { calls.push("activate note"); },
    activateCompanion: async () => { calls.push("refresh Companion"); },
    focusSelectedEditor: () => { calls.push("focus editor"); }
  });
  deepEqual(calls, ["open note", "activate note", "refresh Companion", "activate note", "focus editor"]);
});

test("reuses an existing Markdown leaf before creating another tab", () => {
  let creates = 0;
  const existing = { id: "already-open" };
  deepEqual(timelineSelectionLeaf(existing, () => { creates += 1; return { id: "new" }; }), existing);
  deepEqual(creates, 0);
  deepEqual(timelineSelectionLeaf(null, () => { creates += 1; return { id: "new" }; }), { id: "new" });
  deepEqual(creates, 1);
});

test("serialises overlapping selections so the latest selection finishes last", async () => {
  const queue = new TimelineSelectionQueue();
  const calls: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const first = queue.run(async () => { calls.push("first start"); await firstGate; calls.push("first finish"); });
  const second = queue.run(async () => { calls.push("second start"); calls.push("second finish"); });
  await Promise.resolve();
  deepEqual(calls, ["first start"]);
  releaseFirst();
  await Promise.all([first, second]);
  deepEqual(calls, ["first start", "first finish", "second start", "second finish"]);
});
