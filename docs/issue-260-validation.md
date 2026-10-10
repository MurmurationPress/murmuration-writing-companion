# Issue #260 validation and compatibility review

Implemented from main `58df33f` in an isolated worktree. No applicable AGENTS.md was present in the repository or its ancestor directories. The updated issue, Constitution, merged #256, unmerged draft #257 and #261/#262 were reviewed before implementation. The original checkout and private author content were not modified.

## Lifecycle and consumer audit

The integrity coordinator's startup/settled calls and its vault-wide rebuild entry point are removed. The old preparation-command reporting service/command is removed. The only production owner of the reporting writer is `ManuscriptNumberingCommands`, and only its explicit command/status action calls `renumber`. The old all-Book reconciliation scope helper was removed. The diagnostic capture and synthetic numbering benchmark now follow the manual lifecycle rather than patching the old automatic writer.

#256's serialisation, failure recovery, cancellation at mutation boundaries, unload handling and exact-content protections remain covered for explicit runs. Preparation from #261/#262 writes no reporting properties. Undo comparison ignores the new disposable snapshot/token fields but still treats `manuscript_series_number` as authored data. Preparation now retains original bytes for already-canonical structural notes without writing them, so later manual numbering of an otherwise untouched Book also participates in exact Undo.

`series_scene_number` remains only as a retired cleanup/Undo compatibility property in production. Both alias spellings were searched in source, help, documentation and Git history. No MWC writer or ownership evidence was found for `manuscript_series_number`, so it is not deleted. Historical performance documents are labelled as superseded. #257's consumer inventory informed the documentation; its proposed policy switch and wholesale field retirement were not adopted.

Navigator, hierarchy and compiler ordering still use the authoritative structural tree and sibling order keys. Configurable charts/tables and Codex Press generic inline/query readers can read stored reporting metadata; those consumers now intentionally receive manual snapshots. The reporting guide documents the two-segment book-local Text key, per-Book filters, mixed direct Scenes/Parts, old-format migration, stale detached notes, series removal and older-client compatibility.

## Automated validation

- `npm test`: 984 TypeScript regression tests plus 13 build-tool/interaction-capture tests passed; includes production/test TypeScript checking.
- `npm run build`, `npm run release:check`, `npm run bundle:analyze`, `npm run bundle:report`, `npm run benchmark:performance` and `git diff --check` passed. The existing bundle headroom warning remains; no ceiling or version was changed.
- `node scripts/benchmark-numbering.mjs`: synthetic three-Book fixtures of 30, 300 and 1,000 Scenes per Book; five measured runs after warmup. Startup, repeated startup, prose/context edits, reorder, detach, restore, cross-Book reparent and Book switch all produced **zero reporting write attempts and zero reporting writes**. Existing library/index reconciliation still runs and converges.
- `node scripts/validate-manual-numbering-compiler.mjs ../codex-press`: a separate unmodified Codex Press checkout assembles the synthetic mixed hierarchy in explicit order. Stale reporting values and refreshed values produce identical ordered manuscript paths and prose. A detached Scene with an old reporting snapshot stays excluded. The script asserts explicit (not fallback) compiler order.

Focused tests cover single-Book isolation without vault enumeration, idempotence even with lagging reporting cache values, series cleanup/alias preservation, restart freshness, tail deletion/restoration, cross-Book moves, structural and neutral renames, external values, missing tokens, unsupported/invalid hierarchy, Trash exclusion, protected writes, skipped host writes, partial failure, repair, concurrent changes during mutation/verification, cancellation, unload and pending picker closure. The actual command registration and status owner are exercised with a shared host harness. Exact preparation Undo is tested after manual numbering.

GitHub's Build and test workflow runs the required Ubuntu/Windows matrix with Node 22 on this PR. Local runs used Node 24 on Linux; CI results are reported by the PR checks.

## Disposable real Obsidian checks — 10 October 2026

A separate temporary profile and synthetic two-Book vault under `/tmp` were opened with the installed Linux Obsidian application (launcher/user agent 1.13.7, Electron 43.3.0). No author vault was opened. DevTools automation checked the real compiled plugin and UI:

- Command palette contains **Renumber book scenes**. From an empty tab it opens a Book picker showing Alpha and Beta; closing the picker cancels it.
- Opening Alpha's Scene shows **Scene numbers out of date** with Alpha's title/path in the tooltip. The command updates Alpha's five structural notes only (Book, Part, three Scenes); a repeated invocation performs **zero writes**.
- The Part's Scene receives `book_scene_number: 2` and `manuscript_sequence: "0000000002.0000000001"`; the status clears after verification.
- Prose modification and a neutral Scene rename trigger **zero automatic reporting writes** and keep the snapshot current.
- Externally changing the Scene number to 999 triggers **zero automatic reporting writes** and shows stale status. Clicking the real status item repairs one file and clears it.
- Moving a Scene between Alpha and Beta shows stale status in both Book contexts with **zero automatic reporting writes**.
- Removing a final Scene leaves the remaining Scene's correct number intact but shows stale status. Reloading Obsidian reconstructs that stale state from persisted snapshots.
- The final command/status implementation was also checked after replacing the disposable plugin bundle and re-enabling it.

Live failure injection, cancellation under slow disk I/O, Windows Obsidian UI, native Bases query rendering and PDF/EPUB export were not performed. Those failure/cancellation paths have automated regression coverage; compiler assembly was checked through its production integration boundary. No release, merge, version change or live-vault deployment was performed.

## Deliberate limits

Renumbering is not an all-or-nothing transaction: already committed reporting updates survive interruption, remain stale and can be repaired by a later explicit run. The command cannot revoke a host write already committed during unload. Previously unnumbered unassigned notes cannot be safely attributed to a Book, so they conservatively block declaring a snapshot current until resolved. Snapshot tokens are disposable reporting identities, not manuscript authority. Older MWC installations can still regenerate the former automatic fields and should be updated together.
