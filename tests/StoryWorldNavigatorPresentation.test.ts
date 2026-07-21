import { deepEqual } from "node:assert/strict";
import { test } from "node:test";
import { storyWorldNavigatorStatus } from "../src/story-world/StoryWorldNavigatorPresentation";

test("keeps confirmed visually quiet while preserving its accessible status", () => {
  deepEqual(storyWorldNavigatorStatus("confirmed"), {
    kind: "confirmed", accessibleLabel: "Confirmed", visibleLabel: null
  });
});

test("keeps non-default, unknown and missing statuses readable", () => {
  deepEqual(storyWorldNavigatorStatus("planned"), { kind: "planned", accessibleLabel: "Planned", visibleLabel: "Planned" });
  deepEqual(storyWorldNavigatorStatus("candidate"), { kind: "candidate", accessibleLabel: "Candidate", visibleLabel: "Candidate" });
  deepEqual(storyWorldNavigatorStatus("unresolved"), { kind: "unresolved", accessibleLabel: "Unresolved", visibleLabel: "Unresolved" });
  deepEqual(storyWorldNavigatorStatus("superseded"), { kind: "superseded", accessibleLabel: "Superseded", visibleLabel: "Superseded" });
  deepEqual(storyWorldNavigatorStatus("custom canon"), { kind: "neutral", accessibleLabel: "Custom canon", visibleLabel: "Custom canon" });
  deepEqual(storyWorldNavigatorStatus(null), { kind: "neutral", accessibleLabel: "Unspecified", visibleLabel: "Unspecified" });
});
