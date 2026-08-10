import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { canonicalWikilink, isWikilinkActivationKey, presentReferenceCandidates, presentWikilinkValue, presentWikilinkValues, resolvedReferenceNavigationTarget, wikilinkNavigationTarget } from "../src/story-world/WikilinkPresentation";

test("presents scalar aliases, headings and block references without storage syntax", () => {
  equal(presentWikilinkValue("[[Tobias]]")?.label, "Tobias");
  deepEqual(presentWikilinkValue("[[Characters/Tobias#History|Tobias Hale]]"), { authored: "[[Characters/Tobias#History|Tobias Hale]]", label: "Tobias Hale", linkpath: "Characters/Tobias", wikilink: true });
  equal(presentWikilinkValue("[[Tobias#^arrival]]")?.label, "Tobias");
  equal(presentWikilinkValue("Unknown Character")?.label, "Unknown Character");
});

test("separates canonical storage, visible labels and safe navigation linktext", () => {
  const stored = "[[Story World/Locations/Tobias' Home|Tobias' Home]]";
  equal(canonicalWikilink("Story World/Locations/Tobias' Home", "Tobias' Home"), stored);
  equal(presentWikilinkValue(stored)?.label, "Tobias' Home");
  equal(wikilinkNavigationTarget(stored), "Story World/Locations/Tobias' Home");
  equal(wikilinkNavigationTarget("Tobias' Home"), null);
  equal(wikilinkNavigationTarget("[[Missing Place]]"), "Missing Place");
  equal(resolvedReferenceNavigationTarget("Story World/Locations/Tobias' Home.md"), "Story World/Locations/Tobias' Home");
});

test("accepts native keyboard activation keys", () => {
  equal(isWikilinkActivationKey("Enter"), true);
  equal(isWikilinkActivationKey(" "), true);
  equal(isWikilinkActivationKey("Escape"), false);
});

test("preserves list order and authored unresolved values", () => {
  const values = presentWikilinkValues(["[[A|Alpha]]", "[[Missing#Section]]", "plain"]);
  deepEqual(values.map((item) => item.label), ["Alpha", "Missing", "plain"]);
  deepEqual(values.map((item) => item.authored), ["[[A|Alpha]]", "[[Missing#Section]]", "plain"]);
  equal(canonicalWikilink("Story World/PRIME.md", "PRIME"), "[[Story World/PRIME|PRIME]]");
  const markdownSource = "A scene still contains [[Characters/Tobias|Tobias]].";
  presentWikilinkValue("[[Characters/Tobias|Tobias]]");
  equal(markdownSource, "A scene still contains [[Characters/Tobias|Tobias]].");
});

test("reference candidates keep storage identity while presenting names, aliases and concise duplicate context", () => {
  const choices = presentReferenceCandidates([
    { storedValue: "[[World/One/Robin]]", path: "World/One/Robin.md", name: "Robin", aliases: ["Pip"] },
    { storedValue: "[[World/Two/Robin]]", path: "World/Two/Robin.md", name: "Robin" },
    { storedValue: "[[World/Prime]]", path: "World/Prime.md", name: "PRIME" }
  ]);
  deepEqual(choices.map((choice) => choice.label), ["Robin", "Robin", "PRIME"]);
  deepEqual(choices.map((choice) => choice.secondary), ["World/One", "World/Two", null]);
  equal(choices[0].storedValue, "[[World/One/Robin]]");
  equal(choices[0].navigationTarget, "World/One/Robin");
  equal(choices[1].navigationTarget, "World/Two/Robin");
  deepEqual(choices[0].searchTerms, ["Robin", "Pip", "World/One/Robin.md"]);
});
