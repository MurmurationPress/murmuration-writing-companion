import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { canonicalWikilink, isWikilinkActivationKey, presentWikilinkValue, presentWikilinkValues } from "../src/story-world/WikilinkPresentation";

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
});
