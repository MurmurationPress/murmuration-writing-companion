import { deepEqual, doesNotMatch, equal, match, ok } from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { manuscriptOrderKey } from "../src/manuscript/ManuscriptOrderKey";
import { parseStoryWorldEntity, StoryWorldEntityRecord } from "../src/story-world/StoryWorldIndex";
import { projectStoryWorldTimeline } from "../src/story-world/StoryWorldTimeline";

const run = promisify(execFile);
const root = process.cwd();
const examples = path.join(root, "examples", "v2-onboarding");
const prepared = path.join(examples, "prepared-vault");
const migration = path.join(examples, "migration-vault");

async function filesBelow(directory: string, relative = ""): Promise<string[]> {
  const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(directory, child));
    else files.push(child.split(path.sep).join("/"));
  }
  return files.sort((a, b) => a.localeCompare(b, "en"));
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
}

function fixtureFrontmatter(markdown: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) return {};
  const result: Record<string, unknown> = {};
  let listKey: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const property = /^([A-Za-z0-9_]+):(?:\s*(.*))?$/.exec(line);
    if (property) {
      listKey = property[2]?.trim() ? null : property[1];
      result[property[1]] = property[2]?.trim() ? unquote(property[2]) : [];
      continue;
    }
    const item = /^\s{2}-\s+(.+)$/.exec(line);
    if (item && listKey) (result[listKey] as unknown[]).push(unquote(item[1]));
  }
  return result;
}

async function markdownDocument(directory: string, relative: string) {
  const text = await readFile(path.join(directory, relative), "utf8");
  return { text, frontmatter: fixtureFrontmatter(text) };
}

function wikilinkTarget(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^\[\[([^\]|#]+)/.exec(value);
  return match?.[1] ?? null;
}

test("prepared example has one authoritative mixed-hierarchy Book in Navigator order", async () => {
  const expected = [
    ["Manuscript/The Greywater Signal.md", "book", null, null],
    ["Manuscript/The Greywater Signal/Opening at Greywater.md", "scene", "Manuscript/The Greywater Signal", "8000000000"],
    ["Manuscript/The Greywater Signal/Listening.md", "part", "Manuscript/The Greywater Signal", "G000000000"],
    ["Manuscript/The Greywater Signal/Listening/First Survey.md", "scene", "Manuscript/The Greywater Signal/Listening", "C000000000"],
    ["Manuscript/The Greywater Signal/Listening/Signal at Low Tide.md", "scene", "Manuscript/The Greywater Signal/Listening", "O000000000"],
    ["Manuscript/The Greywater Signal/Returning.md", "part", "Manuscript/The Greywater Signal", "O000000000"],
    ["Manuscript/The Greywater Signal/Returning/Return to the Observatory.md", "scene", "Manuscript/The Greywater Signal/Returning", "C000000000"],
    ["Manuscript/The Greywater Signal/Returning/The Recorded Pattern.md", "scene", "Manuscript/The Greywater Signal/Returning", "O000000000"]
  ] as const;
  for (const [relative, kind, parent, key] of expected) {
    const document = await markdownDocument(prepared, relative);
    equal(document.frontmatter.type, kind, `${relative} type`);
    if (parent) equal(wikilinkTarget(document.frontmatter.parent), parent, `${relative} parent`);
    if (key) equal(manuscriptOrderKey(document.frontmatter.manuscript_order_key), key, `${relative} key`);
  }
  const rootChildren = expected.filter((item) => item[2] === "Manuscript/The Greywater Signal").sort((a, b) => a[3]!.localeCompare(b[3]!));
  deepEqual(rootChildren.map((item) => path.basename(item[0], ".md")), ["Opening at Greywater", "Listening", "Returning"]);
  equal(expected.filter((item) => item[1] === "part").length, 2);
  equal(expected.filter((item) => item[1] === "scene").length, 5);
});

test("prepared Story World recognises identity, aliases, chronology, relationships and Reference", async () => {
  const files = (await filesBelow(path.join(prepared, "Story World"))).filter((file) => file.endsWith(".md"));
  const entities: StoryWorldEntityRecord[] = [];
  for (const relative of files) {
    const fullRelative = `Story World/${relative}`;
    const document = await markdownDocument(prepared, fullRelative);
    const entity = parseStoryWorldEntity({ path: fullRelative, basename: path.basename(relative, ".md"), frontmatter: document.frontmatter });
    ok(entity, `${relative} should be an entity`);
    entities.push(entity);
  }
  equal(entities.length, 8);
  equal(entities.filter((entity) => entity.entityType.toLowerCase() === "event").length, 2);
  equal(entities.some((entity) => entity.entityType.toLowerCase() === "reference"), true);
  equal(entities.find((entity) => entity.name === "Mara Venn")?.aliases.includes("Mara"), true);
  const timeline = projectStoryWorldTimeline(entities, (reference) => {
    const target = wikilinkTarget(reference);
    const entity = entities.find((candidate) => candidate.path.replace(/\.md$/, "") === target);
    return entity?.path ?? null;
  });
  deepEqual(timeline.points.map((event) => event.name), ["Signal Emerges", "Return Survey"]);
  const mara = await readFile(path.join(prepared, "Story World/Characters/Mara Venn.md"), "utf8");
  match(mara, /predicate:\s*works_for[\s\S]*target:\s*"\[\[Story World\/Organisations\/Pelagic Field Unit\]\]"/);
  const returnSurvey = await readFile(path.join(prepared, "Story World/Events/Return Survey.md"), "utf8");
  match(returnSurvey, /predicate:\s*follows[\s\S]*target:\s*"\[\[Story World\/Events\/Signal Emerges\]\]"/);
  const reference = entities.find((entity) => entity.entityType.toLowerCase() === "reference");
  deepEqual(reference?.properties.reference_authors, ["Venn, Mara", "Saye, Ivo"]);
  equal(reference?.properties.reference_title, "Greywater hydrophone field log");
});

test("prepared Reference Base and Dataview examples use canonical read-only properties", async () => {
  const base = await readFile(path.join(prepared, "Story World/References/References.base"), "utf8");
  const dataview = await readFile(path.join(prepared, "Reference Projections/References Dataview.md"), "utf8");
  for (const property of ["world_entity", "reference_authors", "reference_date", "reference_title", "reference_publication", "reference_doi", "reference_link", "world_sources"]) {
    match(`${base}\n${dataview}`, new RegExp(property));
  }
  match(base, /name: All References/);
  match(base, /name: References used by The Greywater Signal/);
  match(base, /file\.backlinks\.contains\(link\("Manuscript\/The Greywater Signal\/Listening\/First Survey\.md"\)\)/);
  match(base, /world_sources\.contains\(link\("Manuscript\/The Greywater Signal\/Returning\/The Recorded Pattern\.md"\)\)/);
  match(dataview, /file\.link AS Title/);
  match(dataview, /file\.path ASC/);
  match(dataview, /contains\(file\.inlinks, link\("Manuscript\/The Greywater Signal\/Listening\/First Survey\.md"\)\)/);
  match(dataview, /contains\(world_sources, link\("Manuscript\/The Greywater Signal\/Listening\.md"\)\)/);
  doesNotMatch(`${base}\n${dataview}`, /startsWith\("Manuscript\/The Greywater Signal/);
  doesNotMatch(`${base}\n${dataview}`, /(?:fuzzy|prose|filename similarity)/i);
  doesNotMatch(`${base}\n${dataview}`, /(?:create|modify|write|save)\s*\(/i);
});

test("World Context and provenance references resolve except the documented review fixture", async () => {
  const files = (await filesBelow(prepared)).filter((file) => file.endsWith(".md"));
  let worldContextScenes = 0;
  let missing = 0;
  for (const relative of files) {
    const { text, frontmatter } = await markdownDocument(prepared, relative);
    if (Array.isArray(frontmatter.world_context) && frontmatter.world_context.length) worldContextScenes += 1;
    for (const raw of text.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)) {
      const target = raw[1];
      const exists = await stat(path.join(prepared, `${target}.md`)).then(() => true).catch(() => false);
      if (!exists) {
        equal(target, "Field Notes/Uncatalogued Calibration Sheet");
        missing += 1;
      }
    }
  }
  ok(worldContextScenes >= 2);
  equal(missing, 1);
});

test("migration example owns one complete legacy array and preserves unrelated metadata", async () => {
  const book = await markdownDocument(migration, "Manuscript/The Low Water Ledger.md");
  equal(book.frontmatter.type, "book");
  const order = book.frontmatter.manuscript_order as string[];
  equal(order.length, 7);
  for (const reference of order) {
    const target = wikilinkTarget(reference);
    ok(target);
    await stat(path.join(migration, `${target}.md`));
  }
  equal(book.frontmatter.demonstration_note, "Preserve this unrelated property exactly.");
  for (const target of order) {
    const child = await markdownDocument(migration, `${wikilinkTarget(target)}.md`);
    equal(child.frontmatter.type, undefined);
    equal(child.frontmatter.parent, undefined);
    equal(child.frontmatter.manuscript_order_key, undefined);
    ok(typeof child.frontmatter.demonstration_note === "string");
  }
});

test("example vaults contain no production names, local paths, secrets, generated reports or workspace state", async () => {
  const files = await filesBelow(examples);
  equal(files.some((file) => /(^|\/)\.obsidian\//.test(file)), false);
  equal(files.some((file) => /(^|\/)(main\.js|data\.json|workspace(?:\.json)?|\.git)(\/|$)/.test(file)), false);
  for (const relative of files) {
    const text = await readFile(path.join(examples, relative), "utf8");
    if (relative.endsWith(".md")) {
      equal(/\b(?:Pip|Tobias|JANUS|Divergent|Skip)\b/.test(text), false, relative);
      equal(/\bPRIME\b/.test(text), false, relative);
      equal(/(?:\/home\/|\/Users\/|[A-Za-z]:\\Users\\)/.test(text), false, relative);
      equal(/(?:BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_)/.test(text), false, relative);
      equal(/report_type:\s*/.test(text), false, relative);
    }
  }
});

test("example archive is byte-for-byte reproducible and contains only source fixtures", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "mwc-example-"));
  try {
    const first = path.join(temporary, "first.zip");
    const second = path.join(temporary, "second.zip");
    await run(process.execPath, ["scripts/build-example-vault.mjs", "--output", first], { cwd: root });
    await run(process.execPath, ["scripts/build-example-vault.mjs", "--output", second], { cwd: root });
    const [left, right] = await Promise.all([readFile(first), readFile(second)]);
    equal(left.equals(right), true);
    const archiveText = left.toString("utf8");
    match(archiveText, /mwc-v2-example-vaults\/prepared-vault\/README\.md/);
    match(archiveText, /mwc-v2-example-vaults\/migration-vault\/README\.md/);
    equal(/(?:\.obsidian|main\.js|workspace\.json|\.git\/)/.test(archiveText), false);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("onboarding documentation links resolve and command labels match registrations", async () => {
  const documents = ["README.md", "docs/v2-onboarding-guide.md", "docs/v2-command-reference.md", "docs/v2-onboarding-manual-validation.md", "docs/project-readiness.md"];
  for (const relative of documents) {
    const text = await readFile(path.join(root, relative), "utf8");
    for (const link of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = link[1];
      if (/^(?:https?:|#)/.test(target)) continue;
      const clean = target.split("#", 1)[0];
      if (!clean) continue;
      await stat(path.resolve(path.dirname(path.join(root, relative)), decodeURIComponent(clean)));
    }
  }
  const registrations = `${await readFile(path.join(root, "src/main.ts"), "utf8")}\n${await readFile(path.join(root, "src/entry.ts"), "utf8")}\n${await readFile(path.join(root, "src/manuscript/ManuscriptPreparationCommands.ts"), "utf8")}`;
  for (const label of ["Open project readiness", "Prepare existing manuscript", "Open Manuscript", "Open Story World Navigator", "Open Story World Review", "Open Continuity Review", "Rebuild Story World Index", "Generate entity index"]) match(registrations, new RegExp(`name: "${label}"`));
  const commandGuide = await readFile(path.join(root, "docs/v2-command-reference.md"), "utf8");
  match(commandGuide, /no \*\*Generate references report\*\* command/);
  const screenshots = await readFile(path.join(root, "docs/v2-onboarding-screenshot-checklist.md"), "utf8");
  const expectedScreenshots = [
    "readiness-invitation.png",
    "readiness-prepared.png",
    "readiness-preparation-available.png",
    "prepare-action.png",
    "preparation-preview.png",
    "preparation-blocked.png",
    "preparation-undo.png",
    "manuscript-navigator.png",
    "story-world-navigator.png",
    "continuity-review.png",
    "story-world-graph.png",
    "references.png",
    "entity-index.png"
  ];
  const listedScreenshots = [...screenshots.matchAll(/^\| `docs\/images\/v2\/([^`]+)` \|/gm)].map((entry) => entry[1]);
  deepEqual(listedScreenshots, expectedScreenshots);
  for (const filename of expectedScreenshots) {
    equal(listedScreenshots.filter((listed) => listed === filename).length, 1, `${filename} checklist row`);
    await stat(path.join(root, "docs/images/v2", filename));
  }
  const screenshotDocumentation = `${screenshots}\n${await readFile(path.join(root, "docs/v2-onboarding-manual-validation.md"), "utf8")}\n${await readFile(path.join(root, "docs/website-v2-onboarding-summary.md"), "utf8")}`;
  doesNotMatch(screenshotDocumentation, /all (?:screenshot )?targets are explicitly pending|screenshots? (?:are|remain) (?:explicitly )?(?:pending|missing|placeholders?)|(?:pending|missing|placeholder) screenshot(?:s| assets)?/i);
});
