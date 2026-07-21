import { equal, match } from "node:assert/strict";
import { test } from "node:test";
import {
  exactDateQualifierState,
  exactDateQualifierUpdate,
  exactIsoDate,
  resolveEntityRelationshipTarget
} from "../src/story-world/EntityRelationshipFormValues";
import type { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";

function entity(overrides: Partial<StoryWorldEntityRecord> = {}): StoryWorldEntityRecord {
  return {
    path: "Story World/Organisations/Northbridge Systems.md",
    basename: "Northbridge Systems",
    entityType: "organisation",
    name: "Northbridge Systems",
    aliases: ["Northbridge"],
    facets: [], scope: [], status: "confirmed", summary: null,
    firstAppearance: null, sources: [], links: [], properties: {},
    ...overrides
  };
}

const paths = ["Story World/Organisations/Northbridge Systems.md"];

test("resolves ordinary canonical names and aliases to shortest unambiguous wikilinks", () => {
  const canonical = resolveEntityRelationshipTarget("Northbridge Systems", [entity()], paths);
  equal(canonical.displayName, "Northbridge Systems");
  equal(canonical.reference, "[[Northbridge Systems]]");

  const alias = resolveEntityRelationshipTarget("Northbridge", [entity()], paths);
  equal(alias.displayName, "Northbridge Systems");
  equal(alias.reference, "[[Northbridge Systems]]");
});

test("continues to resolve existing stored wikilinks", () => {
  const resolved = resolveEntityRelationshipTarget(
    "[[Story World/Organisations/Northbridge Systems]]",
    [entity()],
    paths
  );
  equal(resolved.entity?.name, "Northbridge Systems");
  equal(resolved.error, null);
});

test("reports ambiguous and unresolved ordinary target names without guessing", () => {
  const ambiguous = resolveEntityRelationshipTarget("Northbridge", [
    entity(),
    entity({
      path: "Story World/Technologies/Northbridge.md",
      basename: "Northbridge",
      name: "Northbridge Protocol",
      aliases: ["Northbridge"]
    })
  ], [...paths, "Story World/Technologies/Northbridge.md"]);
  match(ambiguous.error ?? "", /ambiguous/);
  equal(ambiguous.reference, null);

  const unresolved = resolveEntityRelationshipTarget("Missing Entity", [entity()], paths);
  match(unresolved.error ?? "", /No Story World entity matches/);
});

test("accepts only real ISO calendar dates without timezone conversion", () => {
  equal(exactIsoDate("2028-02-29"), "2028-02-29");
  equal(exactIsoDate("2027-02-29"), null);
  equal(exactIsoDate("2029-06"), null);
  equal(exactIsoDate("2029-06-28T23:00:00Z"), null);
});

test("preserves unsupported temporal qualifiers until exact replacement is explicit", () => {
  const imprecise = exactDateQualifierState("sometime in 2029");
  equal(imprecise.requiresReplacement, true);
  equal(imprecise.preservedLabel, "sometime in 2029");
  equal(exactDateQualifierUpdate(imprecise, false, "").changed, false);
  equal(exactDateQualifierUpdate(imprecise, true, "").changed, false);
  const replacement = exactDateQualifierUpdate(imprecise, true, "2029-06-28");
  equal(replacement.changed, true);
  equal(replacement.value, "2029-06-28");

  const structured = exactDateQualifierState({ from: "2029", to: "2030" });
  equal(structured.requiresReplacement, true);
  equal(exactDateQualifierUpdate(structured, false, "2029-06-28").changed, false);
});

test("loads existing exact dates directly and leaves an empty control non-destructive", () => {
  const exact = exactDateQualifierState("2029-06-28");
  equal(exact.exactValue, "2029-06-28");
  equal(exact.requiresReplacement, false);
  equal(exactDateQualifierUpdate(exact, true, "").changed, false);
});
