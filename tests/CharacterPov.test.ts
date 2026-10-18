import { test } from "node:test";
import { deepEqual, equal, throws } from "node:assert/strict";
import { changeCharacterPov } from "../src/story-world/CharacterPov";
import { parseStoryWorldEntity } from "../src/story-world/StoryWorldIndex";
import { planStoryWorldEntityCreation } from "../src/story-world/StoryWorldEntityCreation";
import { resolvePovProfileChain } from "../src/story-world/PovProfile";

function record(path: string, type: string, properties: Record<string, unknown> = {}) {
  const parsed = parseStoryWorldEntity({ path, basename: path, frontmatter: { world_entity: type, ...properties } });
  if (!parsed) throw new Error("Invalid fixture");
  return parsed;
}

test("characters exist independently; retrospective selection, change and removal preserve facts", () => {
  const plan = planStoryWorldEntityCreation({ kind: "character", name: "Mira" });
  equal(plan.markdown.includes("pov_profile"), false);
  const properties = { world_entity: "character", custom: { fact: "navigator" }, aliases: ["M"], pov_profile: undefined };
  const one = record("Profiles/One.md", "pov-profile");
  const two = record("Profiles/Two.md", "pov-profile");
  changeCharacterPov(properties, undefined, one);
  equal(properties.pov_profile, "[[Profiles/One]]");
  changeCharacterPov(properties, "[[Profiles/One]]", two);
  changeCharacterPov(properties, "[[Profiles/Two]]", null);
  deepEqual(properties, { world_entity: "character", custom: { fact: "navigator" }, aliases: ["M"] });
});

test("stale and invalid associations fail without mutating any properties", () => {
  const properties = { pov_profile: "[[Newer]]", unrelated: [1, 2] };
  const before = JSON.stringify(properties);
  throws(() => changeCharacterPov(properties, "[[Older]]", null), /changed elsewhere/);
  throws(() => changeCharacterPov(properties, "[[Newer]]", record("Wrong.md", "location")), /POV Profile/);
  equal(JSON.stringify(properties), before);
});

test("created base and Book extensions use existing schema and Chapter Context inheritance", () => {
  const base = record("Base.md", "pov-profile");
  const extensionPlan = planStoryWorldEntityCreation({ kind: "pov-profile", name: "Mira Book Two", scope: "[[Two]]", typedProperties: { pov_extends: "[[Base]]" }, povProfileTemplate: "scoped" });
  equal(extensionPlan.markdown.includes('pov_extends: "[[Base]]"'), true);
  const extension = record("Extension.md", "pov-profile", { pov_extends: "[[Base]]", world_scope: "[[Two]]" });
  const properties: Record<string, unknown> = { world_entity: "character" };
  changeCharacterPov(properties, undefined, base);
  const character = record("Mira.md", "character", properties);
  const entities = [character, base, extension];
  const resolve = (reference: string) => entities.find((entity) => `[[${entity.path.replace(/\.md$/, "")}]]` === reference) ?? null;
  const chain = (book: string) => resolvePovProfileChain({ pov: "[[Mira]]" }, "Scene.md", resolve, { activeBookPath: book, indexedEntities: entities, resolveScope: () => "Two.md" });
  deepEqual(chain("One.md").profiles.map((profile) => profile.path), ["Base.md"]);
  deepEqual(chain("Two.md").profiles.map((profile) => profile.path), ["Base.md", "Extension.md"]);
  entities.splice(1, 1);
  equal(chain("Two.md").issues[0].kind, "missing-profile");
  equal(chain("Two.md").povEntity?.path, "Mira.md");
});

test("legacy missing links can be removed; renamed canonical references resolve without migration", () => {
  const properties: Record<string, unknown> = { world_entity: "character", pov_profile: "[[Deleted|Old name]]", legacy: "keep" };
  const character = () => record("Mira.md", "character", properties);
  const missing = resolvePovProfileChain({ pov: "[[Mira]]" }, "Scene.md", (reference) => reference === "[[Mira]]" ? character() : null);
  equal(missing.issues[0].kind, "missing-profile");
  equal(missing.povEntity?.entityType, "character");
  const renamed = record("Elsewhere/Renamed.md", "POV-Profile");
  changeCharacterPov(properties, "[[Deleted|Old name]]", renamed);
  equal(properties.pov_profile, "[[Elsewhere/Renamed]]");
  const chain = resolvePovProfileChain({ pov: "[[Mira]]" }, "Scene.md", (reference) => reference === "[[Mira]]" ? character() : renamed);
  deepEqual(chain.profiles.map((profile) => profile.path), ["Elsewhere/Renamed.md"]);
  changeCharacterPov(properties, "[[Elsewhere/Renamed]]", null);
  equal(properties.legacy, "keep");
  equal(resolvePovProfileChain({ pov: "[[Mira]]" }, "Scene.md", () => character()).profiles.length, 0);
});

test("creating a reusable profile does not associate it until explicitly confirmed", () => {
  const plan = planStoryWorldEntityCreation({ kind: "pov-profile", name: "Mira POV", povProfileTemplate: "base" });
  const properties: Record<string, unknown> = { world_entity: "character", world_name: "Mira" };
  const before = JSON.stringify(properties);
  equal(plan.markdown.includes("## Attention"), true);
  equal(JSON.stringify(properties), before);
  changeCharacterPov(properties, undefined, record(plan.path, "pov-profile"));
  equal(properties.pov_profile, `[[${plan.path.replace(/\.md$/, "")}]]`);
});
