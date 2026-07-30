import { equal, match, rejects, throws } from "node:assert/strict";
import { test } from "node:test";
import {
  findStoryWorldCreationCollision,
  findStoryWorldPathCollision,
  planStoryWorldEntityCreation,
  safeStoryWorldFilename,
  executeStoryWorldEntityCreation
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

test("previews minimal and optional Reference Markdown without inventing fields", () => {
  const minimal = planStoryWorldEntityCreation({ kind: "reference", name: "Companion cognition" });
  equal(minimal.path, "Story World/References/Companion cognition.md");
  equal(minimal.markdown.includes("reference_"), false);
  const full = planStoryWorldEntityCreation({ kind: "reference", name: "Companion cognition", reference: {
    category: "research-note", title: "Companion cognition and personal AI",
    journal: "Journal of Example Studies", authors: ["Hawkins, Edward", "Vale, Ada"],
    date: "2026", key: "hawkins-2026-companion", link: "https://example.org/source"
  } });
  match(full.markdown, /reference_authors:\n  - "Hawkins, Edward"\n  - "Vale, Ada"/);
  match(full.markdown, /reference_date: "2026"/);
  match(full.markdown, /reference_journal: "Journal of Example Studies"/);
  match(full.markdown, /link: "https:\/\/example.org\/source"/);
  equal(full.markdown.includes("reference_url"), false);
  equal(full.markdown.includes("world_status"), false);
  equal(full.markdown.includes("world_relationship"), false);
  equal(full.markdown.includes("citation"), false);
});

test("creation executor revalidates stale confirmation, verifies writes and rolls back", async () => {
  const plan = planStoryWorldEntityCreation({ kind: "reference", name: "Source" });
  let creates = 0; let rollbacks = 0;
  await rejects(executeStoryWorldEntityCreation(plan, {
    revalidate: () => "A collision appeared.", create: async () => { creates += 1; return "file"; },
    read: async () => plan.markdown, rollback: async () => { rollbacks += 1; }
  }), /collision appeared/);
  equal(creates, 0);
  await rejects(executeStoryWorldEntityCreation(plan, {
    revalidate: () => null, create: async () => { creates += 1; return "file"; },
    read: async () => "different", rollback: async () => { rollbacks += 1; }
  }), /could not be verified/);
  equal(creates, 1); equal(rollbacks, 1);
});

test("Reference creation rejects non-HTTP Link values", () => {
  throws(() => planStoryWorldEntityCreation({
    kind: "reference", name: "Unsafe", reference: { link: "javascript:alert(1)" }
  }), /HTTP or HTTPS/);
});

test("preserves aliased, unresolved and legacy plain-text scope values", () => {
  const aliased = planStoryWorldEntityCreation({ kind: "character", name: "Ada", scope: "[[Books/One|Book One]]" });
  match(aliased.markdown, /"\[\[Books\/One\|Book One\]\]"/);
  equal(aliased.scope, "[[Books/One|Book One]]");
  equal(planStoryWorldEntityCreation({ kind: "character", name: "Bea", scope: "Unresolved legacy scope" }).scope, "Unresolved legacy scope");
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
