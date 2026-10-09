# First-click and render investigation after #256

This records the initial #258 head, `c1195f9`. The blur-save failure identified here is addressed by the [continuation and final validation](blur-save-follow-up.md); the historical measurements below remain unchanged.

On 2026-10-01, #256 was reviewed, amended for cancellation/unload safety and squash-merged as `50e5a400481e59f9b698548cb14f0b2c02445f94`. Its reviewed head was `345ea19891744eeb1d1a64525bf8153d858d8b63`, with passing Ubuntu and Windows CI; the merged tree matches. See [queue review](scene-numbering-review-256.md). #255 remains an unmerged draft. Only its development capture script and corresponding tests are reused here, from `5b32c4347654830448543ae4833fb7bbfe923a2a`; none of its production normalization changes is included. #252 must remain open.

## What the live experiment establishes

This is actual Obsidian 1.12.7, Electron 39.8.3, Chromium 142.0.7444.265 on Linux, running in an isolated profile with 95 synthetic Markdown notes, default theme and MWC alone. Input uses trusted Chromium CDP mouse events, with a requested 35 ms press. It is not a synthetic DOM test, but neither is it Ted's Windows environment or author vault. No author-vault deployment occurred. Builds/tests did not run concurrently with the final timing trials. [Measurements and representative event traces](measurements/first-click-live.json) record installed bundle hashes, actual render calls, DOM removals, pointer order, long tasks and handler counts.

| Operation (five repetitions per case) | Merged #256 baseline | Initial #258 head |
| --- | --- | --- |
| First click, inactive Manuscript Create book | 0/5; second click needed | 5/5; handler once |
| First click, inactive Companion Chapter Notes toggle | 0/5; second click needed | 5/5; handler once |
| Same two controls, pane already active | 10/10 | 10/10 |
| Native File Explorer disclosure, active/inactive | 10/10 | 10/10 |
| Inactive MWC press-to-release median | 136–138 ms | 38–39 ms |
| Settled prose save: numbering passes / write attempts / metadata events | 1 / 0 / 1 | 1 / 0 / 1 |
| Settled prose save: cached library rebuilds / Companion renders / Navigator renders | 1 / 4 / 3 | 1 / 4 / 3 |
| Settled prose save: Markdown file enumerations | 202 | 19 |
| Settled prose save: total Navigator render time, median | 312.2 ms | 19.1 ms |

Uninstrumented repetitions, with neither captures nor handler wrappers, reproduced the baseline activation failures and the draft's successful first actions. Instrumented trials counted original handlers directly: the failed first click did not invoke its handler. On the baseline, `pointerdown` activated the pane, a synchronous render removed its target, and `pointerup` landed on another node. There was no click delivered to the original button. One Companion and one Navigator render occurred with no metadata event and no numbering pass. Main-thread rendering also extended the requested press interval. This is evidence of both lost actions and blocking work, rather than delayed feedback alone. Input-to-paint latency was not measured.

The draft preserves the target during tool-pane activation. Switching between two already-open Markdown leaves still updates current chapter and Companion title. Tab/Shift-Tab navigation followed by Enter and Space on Create book each invoked its handler once. These checks do not establish every keyboard, view, theme, other-plugin or operating-system interaction.

## Source path and correction

`src/main.ts`'s `active-leaf-change` listener previously refreshed Companion and Manuscript unconditionally. `src/entry.ts` independently refreshed Story World Navigator and Graph. Activating a tool pane does not select a new Markdown source. Both listeners now retain their housekeeping but skip source-following renders unless the active view is Markdown. All Markdown activations still run their previous refresh path, including same-file context changes; this is not a path-only deduplication.

`ManuscriptNavigatorView.render()` empties its container. Its mismatch indicators and metadata tooltips previously called `ObsidianManuscriptNameAlignmentAdapter.snapshot()` per row. Each snapshot called `buildObsidianManuscriptLibrary()` to revalidate authority. With 30 visible scenes, the heading plus two checks per scene caused 61 avoidable whole-library builds per render, across all books. Three renders explain the 183-enumeration reduction. Display now uses the already-resolved tree entry and reads the current title from metadata. Transactional name-alignment planning still obtains a fresh authoritative snapshot, including membership revalidation. Focused regression coverage checks that display does not enumerate files, reflects changed title aliases, rejects missing/trash/unsupported entries, and that transactional snapshots still rescan and reject detached notes.

Prose remains a broader invalidation problem. After Obsidian saves the editor buffer, metadata `changed` reaches `ManuscriptProjectionService.affectsMetadata()`, which returns true for a known manuscript member without comparing structural fields. `main.ts` queues the integrity coordinator; after its 100 ms settlement it rebuilds the cached library and requests numbering, which finds no reporting changes. The same event reaches `metadataContinuityRefreshDecision()` (Navigator refresh is unconditional), current-chapter Companion refresh, and deferred chronology/world paths. `entry.ts` also schedules consumers. Subsequent convergence refreshes add further renders. The measured four Companion/three Navigator renders remain in this draft. Zero numbering writes therefore does not mean zero regeneration, scans or DOM rebuilds.

## Remaining defect at the initial head

Editing **Change summary**, then pressing **Chapter Notes** in the already-active Companion, still failed on the first press in all five instrumented draft trials. `EditorialWritingCompanionView` saves the textarea on blur; `updateChapterContextProperty()` awaits the frontmatter write. Metadata listeners then refresh the view and remove the pressed toggle before `pointerup`. The original toggle handler executed zero times. The write helper itself does not directly refresh the view. A representative trace is retained in the measurements.

At the initial head, this needed a control-lifetime correction for save-triggered renders, with tests covering focus, blur commits, pending edits, validation failures and external updates. Arbitrary delays or replaying lost clicks would conceal the lifetime problem. The initial head changed neither persistence semantics nor these save handlers. Its disposable-vault first-click criterion was **not met**; see the continuation for the correction. Large-vault performance, physical return from another application, Windows and the other Story World controls remain unverified.

## Short capture for Ted

1. In a **disposable copy**, install this draft build, enable only MWC, and open a scene, Companion and Manuscript side by side. Open Developer Tools and paste `scripts/diagnostics/capture-interactions.js` and `scripts/diagnostics/capture-numbering.js`.
2. Run `const i = startMwcInteractionCapture(); const n = startMwcNumberingCapture();`. Click once into each inactive pane's control, then edit Change summary and click Chapter Notes. Also try returning from another application. For prose, type once and wait at least four seconds for the save to settle.
3. Run `copy(JSON.stringify({ interaction: i.stop(), numbering: n.stop() }))`. Record Obsidian/OS version, active panes, intended action and whether the first click worked. The captures omit note contents and paths. Repeat once without captures to check observer effects. Captures count DOM/render events; the automated fixture also wraps selected original handlers, so console captures alone do not prove handler invocation.

## Automated disposable-host replay

Requires Node with built-in `WebSocket` (the investigation used Node 22), an isolated Obsidian profile with local CDP on port 19347, and a disposable vault. Never attach to an author profile. Start a separate Linux instance with `obsidian --user-data-dir=/absolute/disposable/profile --remote-debugging-port=19347`; choose the disposable vault and enable its copied MWC build. Chromium sandbox/display options depend on the host; they are not plugin requirements.

Fixture: three root book notes `Book0.md` through `Book2.md` (`type: book`); 30 root scene notes per book named `B0S000.md` through `B2S029.md` with `type: scene`, `parent: '[[Book0]]'` (corresponding book), and distinct ascending ten-character zero-padded `manuscript_order_key` strings. Give every note a matching `title` and synthetic body. Add `README.md` and `Control/Note.md`, for 95 Markdown notes. Add `.mwc-performance-fixture` containing exactly `MWC disposable performance fixture` followed by a newline. Enable native File Explorer; leave its Control folder visible. Keep Companion and Manuscript visible beside the editor. The script refuses a missing marker, a different active vault or additional community plugins.

From the checkout, run:

```sh
node scripts/diagnostics/replay-first-click.mjs --vault=/absolute/disposable/vault > clicks.json
node scripts/diagnostics/replay-first-click.mjs --vault=/absolute/disposable/vault --uninstrumented > clicks-uninstrumented.json
node scripts/diagnostics/replay-first-click.mjs --vault=/absolute/disposable/vault --prose-only > prose.json
```

Install the comparison bundle **only into this disposable vault**, disable/re-enable MWC and repeat. Add `--expect-fixed` on the draft's click runs to assert first actions and exactly one original handler call in instrumented MWC cases. This assertion covers activation trials, not the remaining blur defect. Prose mode performs five real editor insertions and waits four seconds per save; its assertions require settled captures with one metadata event, one regeneration pass and no reporting writes. Stop all captures before reloading. The script mutates only the explicitly marked fixture and reports its environment and installed bundle hash.

## Initial-head validation and separate schema proposal

926 TypeScript tests and 13 script tests pass; production/test type checks, production build, bundle analysis/report, release metadata checks and whitespace checks pass. Bundle size is 705,940 raw / 195,810 gzip bytes, leaving 14,956 bytes below the unchanged hard ceiling; the existing headroom warning remains. Capture forwarding/restoration tests and real-host replay complement the display-authority regression test. No test result is a claim that all live first-click paths are fixed.

[Draft #257](https://github.com/MurmurationPress/murmuration-writing-companion/pull/257) separately proposes keeping `parent` plus `manuscript_order_key` authoritative and deriving visible numbering. Its inventory includes generic report/export consumers, Codex Press inline metadata expressions and actual Bases dependencies. `manuscript_sequence` must be addressed alongside the two scene-number fields. No field migration, deletion or numbering schema change belongs to this correction.
