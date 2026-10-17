import { test } from 'node:test';
import { doesNotMatch, match } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('0.20 removes dataset aliases and runtime coupling while retaining manuscript-aware commands', async () => {
  const main = await readFile('src/main.ts', 'utf8');
  doesNotMatch(main, /ReportsCommandBridge|installReportsCommandBridge|murmurationReports|generate-derived-artefact|generate-all-derived-artefacts/);
  const registrations = main + await readFile('src/companion/AnnotationBoardView.ts', 'utf8') + await readFile('src/entry.ts', 'utf8');
  for (const command of ['generate-entity-index', 'open-continuity-review', 'annotate', 'open-annotation-board']) match(registrations, new RegExp(command));
  const guide = await readFile('docs/murmuration-reports-transition.md', 'utf8');
  for (const id of ['generate-derived-artefact', 'generate-all-derived-artefacts']) {
    match(guide, new RegExp(`murmuration-writing-companion:${id}`));
    match(guide, new RegExp(`murmuration-reports:${id}`));
  }
  match(guide, /neither plugin edits/);
});

test('published release notes use versioned URLs instead of repository-relative guide links', async () => {
  const notes = await readFile('RELEASE_NOTES.md', 'utf8');
  doesNotMatch(notes, /\]\((?:Help|docs)\//);
  for (const target of ['Help/Writing_with_MWC.md', 'docs/murmuration-reports-transition.md', 'docs/installation-and-upgrade.md', 'docs/release-readiness-0.20.0.md']) {
    match(notes, new RegExp(`https://github.com/MurmurationPress/murmuration-writing-companion/blob/0\\.20\\.0/${target.replaceAll('.', '\\.').replaceAll('/', '\\/')}`));
  }
});
