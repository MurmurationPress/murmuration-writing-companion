import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { canonicalWikilink, isWikilinkActivationKey, presentReferenceCandidates, presentWikilinkValue, presentWikilinkValues } from "../src/story-world/WikilinkPresentation";

test("presents scalar aliases, headings and block references without storage syntax", () => {
  equal(presentWikilinkValue("[[Tobias]]")?.label, "Tobias");
  deepEqual(presentWikilinkValue("[[Characters/Tobias#History|Tobias Hale]]"), { authored: "[[Characters/Tobias#History|Tobias Hale]]", label: "Tobias Hale", linkpath: "Characters/Tobias", wikilink: true });
  equal(presentWikilinkValue("[[Tobias#^arrival]]")?.label, "Tobias");
  equal(presentWikilinkValue("Unknown Character")?.label, "Unknown Character");
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
  deepEqual(choices[0].searchTerms, ["Robin", "Pip", "World/One/Robin.md"]);
});
