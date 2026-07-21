import { equal, match } from "node:assert/strict";
import { test } from "node:test";
import {
  findStoryWorldCreationCollision,
  findStoryWorldPathCollision,
  planStoryWorldEntityCreation,
  safeStoryWorldFilename
} from "../src/story-world/StoryWorldEntityCreation";

test("plans minimal ordinary Markdown without inventing canon", () => {
  const plan = planStoryWorldEntityCreation({
    kind: "character",
    name: "Ada Vale",
    scope: "[[PRIME Trilogy]]"
  });
  equal(plan.path, "Story World/Characters/Ada Vale.md");
  match(plan.markdown, /world_entity: character/);
  match(plan.markdown, /world_name: "Ada Vale"/);
  match(plan.markdown, /world_scope:\n  - "\[\[PRIME Trilogy\]\]"/);
  equal(plan.markdown.includes("world_status"), false);
  equal(plan.markdown.includes("world_summary"), false);
});

test("supports explicit custom entity kinds", () => {
  const plan = planStoryWorldEntityCreation({ kind: "other", customKind: "weather-system", name: "Storm Curve" });
  equal(plan.entityType, "weather-system");
  equal(plan.path, "Story World/Other/Storm Curve.md");
});

test("sanitises filename-only characters without changing canonical name", () => {
  const plan = planStoryWorldEntityCreation({ kind: "event", name: "Signal: First/Contact" });
  equal(safeStoryWorldFilename("Signal: First/Contact"), "Signal- First-Contact");
  equal(plan.name, "Signal: First/Contact");
});

test("blocks path, canonical-name and alias collisions case-insensitively", () => {
  const plan = planStoryWorldEntityCreation({ kind: "character", name: "Pip" });
  equal(findStoryWorldCreationCollision(plan, [{ path: "Story World/Characters/PIP.md", name: "Philippa Fenwick", aliases: [] }]), "A file already exists at Story World/Characters/Pip.md.");
  equal(findStoryWorldCreationCollision(plan, [{ path: "Elsewhere.md", name: "pip", aliases: [] }]), "An entity already uses the canonical name Pip.");
  equal(findStoryWorldCreationCollision(plan, [{ path: "Elsewhere.md", name: "Philippa Fenwick", aliases: ["PIP"] }]), "Pip is already used as an alias.");
  equal(findStoryWorldPathCollision(plan, ["Story World/Characters/PIP.md"]), "A file already exists at Story World/Characters/Pip.md.");
});
