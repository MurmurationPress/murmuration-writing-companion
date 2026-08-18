import { doesNotMatch, match } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";

test("Manuscript search filters the loaded tree region without rebuilding the vault projection", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/manuscript/ManuscriptNavigatorView.ts"),
    "utf8"
  );
  match(source, /const library = this\.plugin\.manuscriptProjection\.get\(\)/u);
  const handler = source.match(/search\.oninput = \(\) => \{(?<body>[\s\S]*?)\n    \};/u)?.groups?.body ?? "";
  match(handler, /this\.searchQuery = search\.value/u);
  match(handler, /renderTreeRegion\(\)/u);
  doesNotMatch(handler, /manuscriptProjection|get\(\)|this\.render\(\)|vault/u);
});

test("Manuscript search has compact title-only UI and Escape handling", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/manuscript/ManuscriptNavigatorView.ts"),
    "utf8"
  );
  match(source, /placeholder: "Search manuscript…"/u);
  match(source, /"aria-label": "Search Part and Scene titles"/u);
  match(source, /clearManuscriptSearchOnEscape\(this\.searchQuery, event\.key\)/u);
  match(source, /filterManuscriptTree\(book\.result\.roots, this\.searchQuery\)/u);
});
