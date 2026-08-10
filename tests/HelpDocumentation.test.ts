import { doesNotMatch, match, ok } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";

const root = process.cwd();

async function text(relative: string): Promise<string> {
  return readFile(path.join(root, relative), "utf8");
}

test("author Help has one discoverable task-oriented entry point", async () => {
  const [repositoryReadme, helpReadme] = await Promise.all([
    text("README.md"),
    text("Help/README.md")
  ]);

  match(repositoryReadme, /\[Author Help\]\(Help\/README\.md\)/);
  for (const page of [
    "Getting_Started.md",
    "Writing_with_MWC.md",
    "Story_World.md",
    "Events_and_Time.md",
    "Relationships.md",
    "References.md",
    "Reviews_and_Reports.md",
    "Manuscript_Chat.md",
    "Backup_Preparation_and_Recovery.md",
    "Troubleshooting.md",
    "Property_Reference.md",
    "Developer_and_Legacy_Appendix.md",
    "Author_Facing_Glossary.md"
  ]) {
    match(helpReadme, new RegExp(`\\(${page.replace(".", "\\.")}\\)`));
    ok((await text(`Help/${page}`)).trim().length > 0, `${page} should contain documentation`);
  }
});

test("canonical Help recommends current Location, Event, Reference, and chat forms", async () => {
  const [writing, events, references, properties, chat] = await Promise.all([
    text("Help/Writing_with_MWC.md"),
    text("Help/Events_and_Time.md"),
    text("Help/References.md"),
    text("Help/Property_Reference.md"),
    text("Help/Manuscript_Chat.md")
  ]);

  match(writing, /location: "\[\[Story World\/Locations\/Coastal Nature Reserve\]\]"/);
  match(writing, /do not need to repeat it in `world_context`/i);
  match(events, /world_participants:/);
  match(events, /precision: day/);
  match(references, /reference_publication:/);
  match(references, /reference_link:/);
  doesNotMatch(properties, /reference_journal|reference_url|published_in/);
  match(chat, /```chat/);
  match(chat, /\{\{header\|body\|subtext\}\}/);
  doesNotMatch(chat, /Chat View is (?:a )?(?:current )?dependency/i);
});

test("prepared examples keep semantic Location out of explicit world_context", async () => {
  for (const scene of [
    "examples/v2-onboarding/prepared-vault/Manuscript/The Greywater Signal/Opening at Greywater.md",
    "examples/v2-onboarding/prepared-vault/Manuscript/The Greywater Signal/Listening/Signal at Low Tide.md"
  ]) {
    const markdown = await text(scene);
    const location = /^location:\s*"(\[\[[^\n]+\]\])"$/m.exec(markdown)?.[1];
    ok(location, `${scene} should have a canonical semantic Location`);
    const worldContext = /^world_context:\s*$([\s\S]*?)(?=^[A-Za-z0-9_]+:|^---$)/m.exec(markdown)?.[1] ?? "";
    doesNotMatch(worldContext, new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
