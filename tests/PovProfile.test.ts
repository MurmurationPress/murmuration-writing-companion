import { deepEqual, equal, match } from "node:assert/strict";
import { test } from "node:test";
import {
  buildEffectivePovGuidance,
  buildPovGuidanceMarkdown,
  povProfileResolutionIssueMessage,
  povProfileMarkdownBody,
  resolvePovProfileChain
} from "../src/story-world/PovProfile";
import type { StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";
import { buildWorldContext } from "../src/story-world/WorldContext";

function entity(
  path: string,
  name: string,
  entityType: string,
  properties: Record<string, unknown> = {}
): StoryWorldEntityRecord {
  return {
    path,
    basename: path.split("/").pop()?.replace(/\.md$/i, "") ?? path,
    entityType,
    name,
    aliases: [],
    facets: [],
    scope: [],
    status: null,
    summary: null,
    firstAppearance: null,
    sources: [],
    links: [],
    properties
  };
}

function resolver(records: Record<string, StoryWorldEntityRecord>) {
  return (reference: string) => records[reference] ?? null;
}

test("a Scene POV resolves a direct Markdown profile without world_context duplication", () => {
  const tobias = entity("Story World/Characters/Tobias.md", "Tobias", "character", {
    pov_profile: "[[Story World/POV Profiles/Tobias POV]]"
  });
  const profile = entity("Story World/POV Profiles/Tobias POV.md", "Tobias POV", "pov-profile");
  const resolve = resolver({ "[[Tobias]]": tobias, "[[Story World/POV Profiles/Tobias POV]]": profile });
  const frontmatter = { pov: "[[Tobias]]" };
  const before = JSON.stringify(frontmatter);
  const chain = resolvePovProfileChain(frontmatter, "Books/One/Scene.md", resolve);
  const guidance = buildEffectivePovGuidance(chain, () => "---\nworld_entity: pov-profile\n---\n\nDiagnostic and pattern-first.\n");

  deepEqual(chain.profiles.map((item) => item.name), ["Tobias POV"]);
  deepEqual(guidance.sections.map((section) => section.markdown), ["Diagnostic and pattern-first."]);
  equal(buildWorldContext(frontmatter, resolve).entries.map((entry) => entry.entity.name).join(","), "Tobias");
  equal(JSON.stringify(frontmatter), before);
});

test("shared Intelligence guidance is ordered before PRIME and JANUS specialisations", () => {
  const shared = entity("Story World/POV Profiles/Intelligence POV.md", "Intelligence POV", "pov-profile");
  const primeProfile = entity("Story World/POV Profiles/PRIME POV.md", "PRIME POV", "pov-profile", {
    pov_extends: "[[Intelligence POV]]"
  });
  const janusProfile = entity("Story World/POV Profiles/JANUS POV.md", "JANUS POV", "pov-profile", {
    pov_extends: "[[Intelligence POV]]"
  });
  const prime = entity("Story World/Intelligences/PRIME.md", "PRIME", "intelligence", { pov_profile: "[[PRIME POV]]" });
  const janus = entity("Story World/Intelligences/JANUS.md", "JANUS", "intelligence", { pov_profile: "[[JANUS POV]]" });
  const resolve = resolver({
    "[[PRIME]]": prime, "[[JANUS]]": janus,
    "[[PRIME POV]]": primeProfile, "[[JANUS POV]]": janusProfile,
    "[[Intelligence POV]]": shared
  });

  for (const [pov, specialised] of [["[[PRIME]]", "PRIME POV"], ["[[JANUS]]", "JANUS POV"]]) {
    const chain = resolvePovProfileChain({ pov }, "Books/One/Scene.md", resolve);
    deepEqual(chain.profiles.map((profile) => profile.name), ["Intelligence POV", specialised]);
    const guidance = buildEffectivePovGuidance(chain, (profile) => profile.name === "Intelligence POV"
      ? "Structured records are narrative content."
      : `${profile.name} adds entity-specific representation rules.`);
    const markdown = buildPovGuidanceMarkdown(guidance);
    match(markdown, /^## POV Guidance\n\n### Intelligence POV/u);
    equal(markdown.indexOf("Structured records") < markdown.indexOf(specialised), true);
  }
});

test("human and non-human POVs use the same profile mechanism", () => {
  const pip = entity("Story World/Characters/Pip.md", "Pip", "character", { pov_profile: "[[Pip POV]]" });
  const pipProfile = entity("Story World/POV Profiles/Pip POV.md", "Pip POV", "pov-profile");
  const resolve = resolver({ "[[Pip]]": pip, "[[Pip POV]]": pipProfile });
  const guidance = buildEffectivePovGuidance(
    resolvePovProfileChain({ pov: "[[Pip]]" }, "Books/One/Scene.md", resolve),
    () => "Concrete first, conceptual second; use ecological field vocabulary."
  );
  equal(guidance.sections[0]?.profile.name, "Pip POV");
  match(guidance.sections[0]?.markdown ?? "", /ecological field vocabulary/u);
});

test("missing and wrong-type profile links fail quietly without losing the POV entity", () => {
  const missing = entity("Story World/Characters/Mara.md", "Mara", "character", { pov_profile: "[[Missing POV]]" });
  const wrong = entity("Story World/Characters/Robin.md", "Robin", "character", { pov_profile: "[[Not A Profile]]" });
  const ordinary = entity("Story World/Characters/Pip.md", "Pip", "character");
  const notProfile = entity("Story World/Notes/Not A Profile.md", "Not A Profile", "concept");
  const resolve = resolver({
    "[[Mara]]": missing, "[[Robin]]": wrong, "[[Pip]]": ordinary,
    "[[Not A Profile]]": notProfile
  });

  const missingResult = resolvePovProfileChain({ pov: "[[Mara]]" }, "Scene.md", resolve);
  equal(missingResult.povEntity?.name, "Mara");
  deepEqual(missingResult.profiles, []);
  deepEqual(missingResult.issues.map((issue) => issue.kind), ["missing-profile"]);

  const wrongResult = resolvePovProfileChain({ pov: "[[Robin]]" }, "Scene.md", resolve);
  deepEqual(wrongResult.issues.map((issue) => issue.kind), ["wrong-profile-type"]);
  deepEqual(resolvePovProfileChain({ pov: "[[Pip]]" }, "Scene.md", resolve).issues, []);
  deepEqual(resolvePovProfileChain({ pov: "plain text" }, "Scene.md", resolve).profiles, []);
});

test("profile inheritance cycles terminate and include each readable profile once", () => {
  const subject = entity("Story World/Intelligences/JANUS.md", "JANUS", "intelligence", { pov_profile: "[[Profile A]]" });
  const profileA = entity("Story World/POV Profiles/A.md", "Profile A", "pov-profile", { pov_extends: "[[Profile B]]" });
  const profileB = entity("Story World/POV Profiles/B.md", "Profile B", "pov-profile", { pov_extends: "[[Profile A]]" });
  const chain = resolvePovProfileChain({ pov: "[[JANUS]]" }, "Scene.md", resolver({
    "[[JANUS]]": subject, "[[Profile A]]": profileA, "[[Profile B]]": profileB
  }));

  deepEqual(chain.profiles.map((profile) => profile.name), ["Profile B", "Profile A"]);
  deepEqual(chain.issues.map((issue) => issue.kind), ["inheritance-cycle"]);
  equal(new Set(chain.profiles.map((profile) => profile.path)).size, 2);
});

test("a broken base link preserves the readable specialised profile", () => {
  const subject = entity("Story World/Intelligences/PRIME.md", "PRIME", "intelligence", { pov_profile: "[[PRIME POV]]" });
  const profile = entity("Story World/POV Profiles/PRIME POV.md", "PRIME POV", "pov-profile", { pov_extends: "[[Missing Base]]" });
  const chain = resolvePovProfileChain({ pov: "[[PRIME]]" }, "Scene.md", resolver({
    "[[PRIME]]": subject,
    "[[PRIME POV]]": profile
  }));
  deepEqual(chain.profiles.map((item) => item.name), ["PRIME POV"]);
  deepEqual(chain.issues.map((issue) => issue.kind), ["missing-profile"]);
});

test("profile body extraction is line-ending independent and never changes source", () => {
  const source = "---\r\nworld_entity: pov-profile\r\nworld_name: Example\r\n---\r\n\r\n# Guidance\r\n\r\nKeep this prose.\r\n";
  const before = source.slice();
  equal(povProfileMarkdownBody(source), "# Guidance\n\nKeep this prose.");
  equal(source, before);
});

test("Book-scoped descendants append after the durable base-first profile chain", () => {
  const shared = entity("Story World/POV Profiles/Intelligence POV.md", "Intelligence POV", "pov-profile");
  const primeProfile = entity("Story World/POV Profiles/PRIME POV.md", "PRIME POV", "pov-profile", {
    pov_extends: "[[Intelligence POV]]"
  });
  const multiplicity = {
    ...entity("Story World/POV Profiles/PRIME POV - MULTIPLICITY.md", "PRIME POV — MULTIPLICITY", "pov-profile", {
      pov_extends: "[[PRIME POV]]",
      world_scope: ["[[Books/MULTIPLICITY]]"]
    }),
    scope: ["[[Books/MULTIPLICITY]]"]
  };
  const prime = entity("Story World/Intelligences/PRIME.md", "PRIME", "intelligence", {
    pov_profile: "[[PRIME POV]]"
  });
  const resolve = resolver({
    "[[PRIME]]": prime,
    "[[PRIME POV]]": primeProfile,
    "[[Intelligence POV]]": shared
  });
  const frontmatter = { pov: "[[PRIME]]" };
  const before = JSON.stringify(frontmatter);
  const chain = resolvePovProfileChain(frontmatter, "Books/MULTIPLICITY/Scene.md", resolve, {
    activeBookPath: "Books/MULTIPLICITY.md",
    indexedEntities: [shared, primeProfile, multiplicity, prime],
    resolveScope: (reference) => reference === "[[Books/MULTIPLICITY]]" ? "Books/MULTIPLICITY.md" : null
  });

  deepEqual(chain.profiles.map((profile) => profile.name), [
    "Intelligence POV", "PRIME POV", "PRIME POV — MULTIPLICITY"
  ]);
  deepEqual(chain.issues, []);
  equal(JSON.stringify(frontmatter), before);
});

test("Book scope selects zero or one explicit child and never infers from folders", () => {
  const pip = entity("Story World/Characters/Pip.md", "Pip", "character", { pov_profile: "[[Pip POV]]" });
  const base = entity("Storage/Anywhere/Pip POV.md", "Pip POV", "pov-profile");
  const scoped = {
    ...entity("Not/A/Profile/Folder/Pip Later.md", "Pip POV — MULTIPLICITY", "pov-profile", {
      pov_extends: "[[Pip POV]]"
    }),
    scope: ["[[MULTIPLICITY]]"]
  };
  const resolve = resolver({ "[[Pip]]": pip, "[[Pip POV]]": base });
  const options = {
    indexedEntities: [pip, base, scoped],
    resolveScope: (reference: string) => reference === "[[MULTIPLICITY]]" ? "Books/MULTIPLICITY.md" : null
  };
  const otherBook = resolvePovProfileChain({ pov: "[[Pip]]" }, "Scenes/One.md", resolve, {
    ...options,
    activeBookPath: "Books/EMERGENCE.md"
  });
  const matchingBook = resolvePovProfileChain({ pov: "[[Pip]]" }, "Unrelated/Scene.md", resolve, {
    ...options,
    activeBookPath: "Books/MULTIPLICITY.md"
  });
  deepEqual(otherBook.profiles.map((profile) => profile.name), ["Pip POV"]);
  deepEqual(matchingBook.profiles.map((profile) => profile.name), ["Pip POV", "Pip POV — MULTIPLICITY"]);
});

test("multiple scoped siblings surface deterministic ambiguity without choosing", () => {
  const janus = entity("JANUS.md", "JANUS", "intelligence", { pov_profile: "[[JANUS POV]]" });
  const base = entity("JANUS POV.md", "JANUS POV", "pov-profile");
  const first = { ...entity("Z/First.md", "First delta", "pov-profile", { pov_extends: "[[JANUS POV]]" }), scope: ["[[Book]]"] };
  const second = { ...entity("A/Second.md", "Second delta", "pov-profile", { pov_extends: "[[JANUS POV]]" }), scope: ["[[Book]]"] };
  const chain = resolvePovProfileChain({ pov: "[[JANUS]]" }, "Scene.md", resolver({
    "[[JANUS]]": janus,
    "[[JANUS POV]]": base
  }), {
    activeBookPath: "Books/Book.md",
    indexedEntities: [janus, base, first, second],
    resolveScope: () => "Books/Book.md"
  });
  deepEqual(chain.profiles.map((profile) => profile.name), ["JANUS POV"]);
  deepEqual(chain.issues, [{
    kind: "ambiguous-scoped-profile",
    reference: "Books/Book.md",
    profilePath: "JANUS POV.md",
    candidatePaths: ["A/Second.md", "Z/First.md"]
  }]);
  match(povProfileResolutionIssueMessage(chain.issues) ?? "", /Multiple Book-scoped POV profiles/u);
  equal(povProfileResolutionIssueMessage([]), null);
});

test("explicit scoped extensions can recurse deterministically without duplication", () => {
  const tobias = entity("Tobias.md", "Tobias", "character", { pov_profile: "[[Tobias POV]]" });
  const base = entity("Tobias POV.md", "Tobias POV", "pov-profile");
  const bookDelta = { ...entity("Book Delta.md", "Book delta", "pov-profile", { pov_extends: "[[Tobias POV]]" }), scope: ["[[Book]]"] };
  const focusedDelta = { ...entity("Focused Delta.md", "Focused delta", "pov-profile", { pov_extends: "[[Book Delta]]" }), scope: ["[[Book]]"] };
  const chain = resolvePovProfileChain({ pov: "[[Tobias]]" }, "Scene.md", resolver({
    "[[Tobias]]": tobias,
    "[[Tobias POV]]": base,
    "[[Book Delta]]": bookDelta
  }), {
    activeBookPath: "Book.md",
    indexedEntities: [tobias, base, bookDelta, focusedDelta],
    resolveScope: () => "Book.md"
  });
  deepEqual(chain.profiles.map((profile) => profile.name), ["Tobias POV", "Book delta", "Focused delta"]);
  equal(new Set(chain.profiles.map((profile) => profile.path)).size, 3);
});
