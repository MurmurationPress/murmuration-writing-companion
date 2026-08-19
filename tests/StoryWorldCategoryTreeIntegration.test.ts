import { match, doesNotMatch } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";

async function navigatorSource(): Promise<string> {
  return (await readFile(path.join(process.cwd(), "src/story-world/StoryWorldNavigatorView.ts"), "utf8"))
    .replace(/\r\n?/gu, "\n");
}

test("navigator projects indexed entities and preserves existing open navigation", async () => {
  const source = await navigatorSource();
  match(source, /storyWorldIndex\.index\.getAll\(\)\.map\(builderItemFromEntity\)/u);
  match(source, /storyWorldIndex\.getSupportingModels\(\)/u);
  doesNotMatch(source, /getMarkdownFiles\(\)/u);
  match(source, /await leaf\.openFile\(file, \{ active: true \}\)/u);
  match(source, /await this\.plugin\.activateView\(\)/u);
});

test("search and category toggles rerender only the cached tree projection", async () => {
  const source = await navigatorSource();
  const searchHandler = source.match(/search\.oninput = \(\) => \{(?<body>[\s\S]*?)\n    \};/u)?.groups?.body ?? "";
  const toggleHandler = source.match(/toggle\.onclick = \(\) => \{(?<body>[\s\S]*?)\n      \};/u)?.groups?.body ?? "";
  match(searchHandler, /renderTreeRegion\(\)/u);
  doesNotMatch(searchHandler, /this\.render\(\)|getMarkdownFiles/u);
  match(toggleHandler, /storyWorldCategoryPreferences\.setCollapsed/u);
  match(toggleHandler, /this\.renderTreeRegion\(\)/u);
  doesNotMatch(toggleHandler, /vault\.|metadataCache\.|this\.render\(\)/u);
});
