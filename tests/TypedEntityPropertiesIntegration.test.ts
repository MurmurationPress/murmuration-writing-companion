import { doesNotMatch, match } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";

test("Story World creation and inspector consume the central typed-property mechanism", async () => {
  const creation = (await readFile(path.join(process.cwd(), "src/ui/StoryWorldEntityCreationModal.ts"), "utf8")).replace(/\r\n?/g, "\n");
  const inspector = (await readFile(path.join(process.cwd(), "src/ui/StoryWorldEntityInspector.ts"), "utf8")).replace(/\r\n?/g, "\n");
  match(creation, /storyWorldTypedPropertyDefinitions\(entityType\)/u);
  match(creation, /buildStoryWorldTypedEntityReferenceCandidates/u);
  match(creation, /storyWorldControlledVocabularyCandidates/u);
  match(creation, /definition\.valueType === "controlled-value"/u);
  match(creation, /storyWorldTypedPropertyDefinition\("reference"/u);
  match(inspector, /readStoryWorldTypedProperties\(item\.type, item\.properties\)/u);
  doesNotMatch(inspector, /reference_authors|parent_location|latitude|longitude/u);
});

test("typed-property keystrokes update only creation-form state before explicit creation", async () => {
  const creation = (
    await readFile(path.join(process.cwd(), "src/ui/StoryWorldEntityCreationModal.ts"), "utf8")
  ).replace(/\r\n?/g, "\n");
  const typedSection = creation.match(/private renderTypedPropertySection\(\): void \{(?<body>[\s\S]*?)\n  \}\n\n  private applyReferenceTitleDefault/u)?.groups?.body ?? "";
  match(typedSection, /this\.typedProperties\[definition\.property\] =/u);
  doesNotMatch(typedSection, /processFrontMatter|vault\.modify|vault\.create|metadataCache/u);
});
