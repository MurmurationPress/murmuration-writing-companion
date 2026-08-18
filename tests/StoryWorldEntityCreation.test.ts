import { equal, match, throws } from "node:assert/strict";
import { test } from "node:test";
import {
  findStoryWorldCreationCollision,
  findStoryWorldPathCollision,
  planStoryWorldEntityCreation,
  safeStoryWorldFilename,
  STORY_WORLD_ENTITY_KINDS
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

test("canonical Navigator kinds plan every unresolved-link entity exactly once", () => {
  equal(new Set(STORY_WORLD_ENTITY_KINDS).size, STORY_WORLD_ENTITY_KINDS.length);
  for (const kind of STORY_WORLD_ENTITY_KINDS) {
    const plan = planStoryWorldEntityCreation({ kind, customKind: kind === "other" ? "custom-kind" : undefined, name: `Entity ${kind}` });
    equal(plan.entityType, kind === "other" ? "custom-kind" : kind);
  }
  equal(STORY_WORLD_ENTITY_KINDS.includes("event"), true);
  equal(STORY_WORLD_ENTITY_KINDS.includes("reference"), true);
});

test("adds an optional canonical source and leaves declined creation source-free", () => {
  const accepted = planStoryWorldEntityCreation({ kind: "location", name: "Greywater", sources: ["[[Book 4/Part 1/Scene 2|Scene 2]]"] });
  match(accepted.markdown, /world_sources:\n  - "\[\[Book 4\/Part 1\/Scene 2\|Scene 2\]\]"/);
  equal(planStoryWorldEntityCreation({ kind: "location", name: "Elsewhere", sources: [] }).markdown.includes("world_sources"), false);
});

test("writes recognised Location details without inventing a closed schema", () => {
  const plan = planStoryWorldEntityCreation({
    kind: "location",
    name: "Greywater Observatory",
    typedProperties: {
      address: "1 Tidal Reach",
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: "Europe/London",
      parent_location: "[[Story World/Locations/London]]",
      custom_not_in_registry: "must not be adopted"
    }
  });
  match(plan.markdown, /address: "1 Tidal Reach"/);
  match(plan.markdown, /latitude: 51\.5074/);
  match(plan.markdown, /longitude: -0\.1278/);
  match(plan.markdown, /timezone: "Europe\/London"/);
  match(plan.markdown, /parent_location: "\[\[Story World\/Locations\/London\]\]"/);
  equal(plan.markdown.includes("custom_not_in_registry"), false);
});

test("requires an explicit canonical selection for a new closed-vocabulary value", () => {
  throws(() => planStoryWorldEntityCreation({
    kind: "location",
    name: "Unknown Zone",
    typedProperties: { timezone: "Some/Unknown_Value" }
  }), /selected from IANA timezone identifiers/);
  throws(() => planStoryWorldEntityCreation({
    kind: "location",
    name: "Timezone Alias",
    typedProperties: { timezone: "GMT" }
  }), /selected from IANA timezone identifiers/);
});

test("writes Reference details through the canonical schema only", () => {
  const plan = planStoryWorldEntityCreation({
    kind: "reference",
    name: "A Study",
    reference: {
      authors: ["Vale, A.", "Fenwick, P."], title: "A study", date: "2024", publication: "A Journal",
      publisher: null, volume: "12", issue: "3", pages: "41–59", doi: "10.1000/study", link: "https://doi.org/10.1000/study"
    }
  });
  match(plan.markdown, /reference_authors:\n  - "Vale, A\."\n  - "Fenwick, P\."/);
  match(plan.markdown, /reference_title: "A study"/);
  match(plan.markdown, /reference_doi: "10\.1000\/study"/);
  equal(/\nauthors:|\njournal:|\ndoi:/.test(plan.markdown), false);
});

test("sanitises filename-only characters without changing canonical name", () => {
  const plan = planStoryWorldEntityCreation({ kind: "event", name: "Signal: First/Contact" });
  equal(safeStoryWorldFilename("Signal: First/Contact"), "Signal- First-Contact");
  equal(plan.name, "Signal: First/Contact");
});

test("preserves an explicitly path-qualified authored target", () => {
  const plan = planStoryWorldEntityCreation({ kind: "character", name: "Robin Vale", targetPath: "Story World/People/RV" });
  equal(plan.path, "Story World/People/RV.md");
  throws(() => planStoryWorldEntityCreation({ kind: "character", name: "Robin", targetPath: "../Outside" }), /safe vault path/);
});

test("blocks path, canonical-name and alias collisions case-insensitively", () => {
  const plan = planStoryWorldEntityCreation({ kind: "character", name: "Pip" });
  equal(findStoryWorldCreationCollision(plan, [{ path: "Story World/Characters/PIP.md", name: "Philippa Fenwick", aliases: [] }]), "A file already exists at Story World/Characters/Pip.md.");
  equal(findStoryWorldCreationCollision(plan, [{ path: "Elsewhere.md", name: "pip", aliases: [] }]), "An entity already uses the canonical name Pip.");
  equal(findStoryWorldCreationCollision(plan, [{ path: "Elsewhere.md", name: "Philippa Fenwick", aliases: ["PIP"] }]), "Pip is already used as an alias.");
  equal(findStoryWorldPathCollision(plan, ["Story World/Characters/PIP.md"]), "A file already exists at Story World/Characters/Pip.md.");
});
