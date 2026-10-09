# Blur-save continuation of #258

This continues the [initial investigation](first-click-follow-up.md) at `c1195f93db6a50760f83a5c3a98fdfa756694c55`. #256 remains merged as `50e5a40`; #255 and the separate schema proposal #257 are not included. The measurements use the same isolated Linux Obsidian 1.12.7 / Electron 39.8.3 instance and 95-note synthetic fixture. They are actual renderer/input observations, not synthetic DOM test timings. No author-vault deployment or modification occurred.

## Complete sequence and cause

1. `EditorialWritingCompanionView.renderChapterContext()` creates the Change summary editor with its original `TFile` and field definition captured in the save closure. Editing changes the control's value; it does not change the selected scene or persist on every keystroke.
2. Pressing another control dispatches `pointerdown`. The browser's focus change then blurs the textarea. Its blur handler submits the captured value for the original file through `updateChapterContextProperty()` and Obsidian `processFrontMatter()`.
3. Obsidian saves the file and emits metadata `changed`/`resolved`. MWC updates its indexes and requests Companion, Manuscript and other index-backed view refreshes. Several independent convergence paths can request the same view. The write helper itself does not directly render the view.
4. Previously, those requests immediately reached full renders, including `container.empty()`. In all five original summary trials, the next button was removed before `pointerup`; its original click handler never ran. The remaining defect therefore did not require numbering writes and was not merely delayed visual feedback.
5. Expanded testing found the same lost action after POV editing even when the next target stayed connected: `renderResting()` replaced the compact editor and shifted the layout before release. In that exploratory trace, pointer-down targeted node 1, pointer-up targeted node 4, and the resulting click targeted their ancestor, node 5. Connectivity alone is insufficient; a pressed target must also stay in place.

## Correction and boundaries

`src/ui/InteractionRefresh.ts` observes native input in the main document and Obsidian popout documents. Pointer-down is observed at capture, before blur. Render requests are coalesced by view/control identity while a pointer, Enter/Space activation or composition is in progress. Pointer-up/cancellation and key-up arrange a frame to apply the latest requested renders after native event dispatch; release without a click also drains the queue. There is no chosen millisecond timeout and no synthetic click, handler retry or action replay. Persistence and index reconciliation continue immediately; only view commits wait.

The main Companion request now owns the complete overridable render operation, including Inspector/authoring additions. Navigator and the other metadata-driven view refreshes use the same boundary. Delayed closures read current selection when they render. Closing a popout releases its gestures; plugin disposal removes listeners and cancels pending frames/callbacks. A failed deferred renderer is reported without dropping the other queued consumers. Direct action rendering unrelated to this metadata path is not broadly rewritten.

The small POV/location resting-state update also uses this boundary, avoiding the demonstrated layout shift. It is skipped if its original container has already been replaced by a complete refresh. Their previous zero-delay blur timers are removed. Enter commits are marked as no longer editing, so they can return to the resting control after key-up; the input is read-only while its commit finishes and becomes editable again on failure.

Dirty Chapter Context inputs and active compact editors retain their nodes until they commit on blur or Enter. External authoritative changes are still indexed immediately; a dirty local editor postpones display reconciliation until commit rather than losing the unsaved text. Clean editors display external changes normally. Explicit `data-mwc-focus-key` identities restore keyboard focus only in the same pane and scene/book, and only if a render removed the previously focused element. They never redirect focus from an action that deliberately selected another scene, editor or modal. Native section buttons retain their existing handlers and disclosure state.

`ChapterContextEdit` holds only transient field drafts. Commits serialize per editor/file/field, share an already-pending identical commit and preserve a newer unsaved draft. The write retains the original file reference even if navigation finishes first. An asynchronous metadata-cache comparison cannot skip the last write in a rapid A/B/A sequence; actual mutations remain inside `processFrontMatter`. A failed save produces a notice and retains the draft for explicit retry rather than claiming success. These drafts are not a durable recovery store and do not survive disposal of the view or application exit after a failed write.

Title/date text inputs share the change-on-commit path; POV and Location have the additional compact-editor path described above. Status selectors save on change. Chapter Notes were inspected: their input handler updates the editorial model, and blur flushes that captured file's pending store write; they do not use the Change summary metadata writer. No editorial-storage or frontmatter schema changes are made here.

## Live verification

Final counts and comparable timings are recorded in [the measurement summary](measurements/blur-save-live.json), including bundle hashes and representative pointer traces. `scripts/diagnostics/replay-blur-save.mjs` checks disk read-back, metadata values, original handler counts, selected scene and unchanged destination metadata. Each pointer case repeats five times; the last holds the button for 180 ms rather than 35 ms. Delayed-host cases inject 300 ms latency solely in the disposable test and assert that navigation finishes before the original scene's persistence.

| Check | Initial #258 head | Final build |
| --- | --- | --- |
| Change summary → Chapter Notes, first click | 0/5; original handler 0 each | 5/5; original handler 1 each |
| All blur pointer cases (seven cases × five) | Summary baseline above | 35/35; one handler and one save per case |
| Uninstrumented summary → Chapter Notes | Earlier investigation reproduced failure | 5/5 |
| Pane activation: Companion/Manuscript, active and inactive | Earlier activation correction retained | 20/20; handler 1 each |
| Native File Explorer control, active/inactive | Control case | 10/10 |
| Summary → Tab → Enter/Space | Not established at initial head | 10/10; handler 1 each, disk persistence verified |
| Title → Tab → open POV editor | Not established at initial head | 5/5; handler 1 each, disk persistence verified |
| POV/Location Enter commits | Not established at initial head | 10/10; one save each, resting-control focus restored |
| Native Tab/Shift-Tab then Create book Enter/Space | Earlier correction retained | 2/2; handler 1 each |
| External metadata convergence | Existing contract | 2/2: clean editor updates; dirty draft survives unrelated update and commits |
| Injected write failure and explicit retry | Not established at initial head | First action once; draft survives refresh; second write attempt persists |

The five delayed-write navigation trials each completed the intended navigation before the original scene's save finished. Every pointer trial passed original-file disk read-back and unchanged destination-property assertions. No duplicate action or duplicate save occurred in those 35 trials. The 35 ms and 180 ms holds both passed; the queue releases on events rather than guessing a safe duration.

For summary blur, the baseline rendered Companion/Navigator **4/3** times in every trial. The correction rendered **3/3** for each of the four 35 ms holds and **1/1** for the 180 ms hold: repeated refresh requests during that gesture converge to one render per panel. No metadata event or indexing update is discarded.

Comparable prose runs restore the same synthetic source contents before five actual editor inserts per build, wait four seconds for each save and assert settlement:

| Per settled prose save | Initial #258 head, repeated now | Final build |
| --- | --- | --- |
| Numbering passes / numbering write attempts | 1 / 0 | 1 / 0 |
| File modify / metadata changed events | 1 / 1 | 1 / 1 |
| Cached library rebuilds | 1 | 1 |
| Markdown enumerations | 19 | 19 |
| Companion / Navigator renders | 4 / 3 | 4 / 3 |
| Median total Navigator render time | 23.4 ms | 21.2 ms |

The earlier #256 baseline was 202 enumerations and 312.2 ms, and the initial #258 investigation recorded 19 enumerations and 19.1 ms. These new timings preserve that large improvement; the small 23.4-to-21.2 ms difference is not evidence of a further meaningful prose-render speedup. The redundant settled-prose refreshes remain.

A preliminary baseline trial immediately following raw fixture restoration/plugin reload lost current-chapter context after its handler ran. That uncontrolled startup observation is retained separately in the measurement file, not counted as evidence of blur handler loss. The committed replay establishes source context by opening another scene and then the source before each trial; its controlled baseline retains the intended scene and loses all five original handlers. Startup and normal-vault acceptance remain outstanding.

No measurements here establish Windows live interaction, physical return from another application, touch input, normal-vault behaviour, third-party plugin/theme combinations or input-to-paint latency. The view barrier is observed directly in Linux Chromium; Windows CI is a build/test gate, not Windows UI acceptance. Popout cleanup and composition are regression-tested with host event fixtures, not claimed as completed physical multi-window/IME acceptance.

## Reproduction and shortest remaining manual check

Use the isolated profile, marker and 95-note fixture from the initial investigation. The replay refuses a missing marker, a different active vault or other enabled community plugins. With only MWC enabled and Companion/Manuscript visible, run:

```sh
node scripts/diagnostics/replay-blur-save.mjs --vault=/absolute/disposable/vault --expect-fixed > blur.json
node scripts/diagnostics/replay-blur-save.mjs --vault=/absolute/disposable/vault --uninstrumented --expect-fixed > blur-uninstrumented.json
node scripts/diagnostics/replay-first-click.mjs --vault=/absolute/disposable/vault --expect-fixed > activation.json
node scripts/diagnostics/replay-first-click.mjs --vault=/absolute/disposable/vault --prose-only > prose.json
```

For the initial head, omit `--expect-fixed` and use `--case=summary-toggle` to capture its known failure. The blur replay deliberately changes synthetic title/POV/location/summary values; restore the synthetic fixture's starting metadata before comparing prose runs. Both comparison builds must use the same fixture, settings and Obsidian version. Do not run builds or tests concurrently with timings. The original capture scripts remain available for manual traces.

For Ted: on a disposable Windows copy, edit Change summary, then click Chapter Notes and a different scene once each; reopen the original scene and check the saved text. Repeat with POV/Location, Tab then Enter/Space, and after switching to another application and back. Check one external metadata edit. Record any missed/duplicate action and the intended scene. Normal-vault acceptance with the usual panes/plugins remains a separate outstanding check; this work does not install a build into that vault.

## Review and validation

941 TypeScript tests and 13 script tests pass locally, including production and test type checks. The focused additions cover held/cancelled pointers, native key activation boundaries, dirty edits/composition, same-scene focus restoration, no focus stealing, latest-request coalescing, view errors, window closure/disposal, serial A/B/A commits, shared pending commits, retained failed drafts and retry. Existing Story World convergence coverage still passes; its source-routing assertion follows the complete queued Companion render operation.

Production build, bundle analysis/report, `release:check`, benchmark assertions and `git diff --check` pass. Final bundle: **712,293 raw / 197,824 gzip bytes**, with **8,603 bytes** beneath the unchanged 720,896-byte hard ceiling. The 669,696-byte warning threshold still warns; the 50 KiB headroom target is not met. All final live runs identify bundle SHA-256 `ec77bcbe383e93b27a1c2ce7c3e48c9bace41a4ad4963db4e48fc0c775cdf1cc`.

Review resolved both full-container removal and compact-editor layout movement, the Enter commit/focus edge case, late older-write ordering, and scene/Inspector focus identity. Merge requires Ubuntu and Windows CI on the exact reviewed head and a SHA-guarded merge; the PR/issue record contains that final head and merge result. No live-vault first-click claim follows from these fixtures.

The full PR preserves the earlier pane-activation guard and fresh transactional name-alignment authority. This continuation adds no numbering migration, release, version change or relaxed bundle ceiling. #252 must remain open for normal-vault/Windows first-click acceptance, remaining view/scale profiling and the unmet bundle-headroom target.
