# Scene numbering performance investigation

Numbering persistence is a confirmed source of write and metadata amplification in synthetic structural operations, especially membership changes in an early Book. It is **not established as the cause of the author's live slowdown or two-click defect**. Matching numbers already produce no writes during ordinary settled prose edits. Pane activation, metadata handling and save completion can rebuild controls independently of numbering.

The minimal correction in this branch coalesces pending numbering requests to the latest library snapshot while allowing the active pass to finish serially. It does not remove fields, skip metadata events, change view refreshes, or migrate ordering. A controlled pending-write experiment demonstrates the benefit; it does not demonstrate how frequently that backlog occurs in Obsidian.

## Baseline and prior work

Checked GitHub on 1 October 2026. [Issue 252](https://github.com/MurmurationPress/murmuration-writing-companion/issues/252) is OPEN. Its initial description explicitly called the earlier work preventative, with usable real-vault behaviour; the later two-click report must not be retroactively treated as a measured regression in that baseline. [PR 253](https://github.com/MurmurationPress/murmuration-writing-companion/pull/253) is merged, providing the current measurement infrastructure and index optimisations. Remote main is `ac0c39b00b85b1d698a1c1dd38ce4218b6370065`.

[PR 255](https://github.com/MurmurationPress/murmuration-writing-companion/pull/255) remains OPEN and unmerged at `5b32c4347654830448543ae4833fb7bbfe923a2a`, with Ubuntu and Windows checks successful. Its [investigation](https://github.com/MurmurationPress/murmuration-writing-companion/blob/5b32c4347654830448543ae4833fb7bbfe923a2a/docs/runtime-responsiveness-252.md) finds possible control replacement but does not reproduce the two-click defect. Its only production optimisation is property-name normalisation. This branch starts from remote main, not that PR; its normalisation optimisation and benchmark numbers are not silently included here.

Read CONSTITUTION.md, MANIFESTO.md, ARCHITECTURE.md and the manuscript ordering/reporting contracts. No AGENTS.md was found in applicable parent directories or the repository. The original checkout at `b566438` is preserved; work is isolated on `fix/scene-numbering-performance`. No author vault was read or modified. Obsidian processes exist on the machine, but there is no controlled disposable Obsidian UI session or browser/computer automation available here. The running author's session was not instrumented. All measurements below are Node simulations.

## Calculation, persistence and consumers

| Responsibility | Evidence and behaviour |
| --- | --- |
| Authoritative hierarchy and order | `src/manuscript/ManuscriptOrderKey.ts:1` defines **manuscript_order_key**, ten uppercase base-36 characters, scoped to siblings. `parent` supplies containment. There is no `manuscript_order_number` field in MWC source. `ManuscriptOrder.ts:497` supports distributed keys, legacy Book `manuscript_order` arrays and filename fallback. |
| Library and Book order | `ObsidianManuscript.ts:397` scans Markdown, resolves membership and builds every Book; Books are sorted by display title with numeric collation, not by current UI selection. |
| Calculation | `ManuscriptSequenceProjection.ts:36` walks resolved roots. `book_scene_number` starts at 1 per Book; `series_scene_number` accumulates across projectable Books. `manuscript_sequence` is the padded Book/root/Scene position (`01.02.003`), with `000` for a Scene directly under a Book. |
| Persistence | `ManuscriptSequenceProperty.ts:84` derives all projectable Books, then enumerates **all Markdown files**, skipping Trash and deferred legacy paths. It compares the three exact current property values, writes all three together only on mismatch, and removes stale managed fields from files no longer projected. The affected-Book set supplied to view reconciliation does not narrow this scan. |
| Safety | `ManuscriptSequenceReconciliation.ts:7` defers non-distributed Books; `ExactContentProtection.ts` and the synchronous checks in `sync` protect exact restoration/Undo. These remain unchanged. |
| Consumers | Repository references to the numeric field names are the projection/writer, preparation/Undo exclusions and tests/documentation. They are documented as native **Bases-facing reporting fields**, not Navigator sorting authority. Graph/chronology fields named `manuscriptSequence` are separate in-memory traversal positions (`ObsidianStoryWorldGraph.ts:103`), not reads of these YAML numbers. |
| Explicit rebuild | `ManuscriptPreparationCommands.ts:185` creates a separate service for the reporting rebuild command. The coordinator also exposes `rebuildReportingSequence`. The fix coalesces within one service instance; it does not globally serialize independent command instances. |

Current nested Parts are not supported authority: `VisibleManuscriptOrder.ts:17` diagnoses Parts not directly under a Book and hoists Parts to visible roots. The pure reporting projector omits actual nested child Parts, but the library passes its **visible** tree; that omission test alone does not prove all malformed nested structures receive no numbers in the integrated path. Nested-part support requires a separate model/compiler decision, not an assumption based on dotted labels.

## Trigger and feedback trace

| Operation | Numbering and refresh path |
| --- | --- |
| Startup | `main.ts:249` layout-ready calls `ManuscriptIntegrityCoordinator.initialise`, which rebuilds/publishes the library, invokes settled refreshes and requests numbering (`ManuscriptIntegrityCoordinator.ts:52`). Missing fields write every projectable Scene; matching fields write none. |
| Prose editing | `editor-change` clears annotation lookup, without direct numbering. When Obsidian later emits metadata `changed` for a recognised Scene, `ManuscriptProjection.ts:36` accepts it irrespective of whether structural properties changed. That queues a settled library rebuild and numbering pass. Matching numbers write nothing; the rebuild and refresh still occur. |
| Metadata changes | `main.ts:374` queues recognised manuscript files, updates world/review state and may refresh Companion/chronology immediately. `entry.ts:163,564` additionally queues a 100 ms Manuscript/World/Graph refresh on every metadata change. Context edits do not need changed numbers to refresh views. |
| Moves, insertion, detach, restore, deletion, rename | Metadata and create/delete/rename handlers (`main.ts:401–494`) queue affected paths. The coordinator coalesces paths with a 100 ms debounce, retries absent metadata at 75 ms up to four times, rebuilds the complete library and requests reporting reconciliation (`ManuscriptIntegrityCoordinator.ts:111–147`). Structural operations also have explicit refresh paths (`main.ts:1025`). |
| Resolved metadata | `ManuscriptIntegrityCoordinator.metadataResolved` reschedules pending paths; it does not independently start a numbering pass with an empty queue. The separate Story World resolved handler still performs its convergence/consumer work. |
| Book switching | The selection subscription (`entry.ts:69`) refreshes views/scopes but does not directly regenerate reporting. The library cache is shared. An active-leaf/file-open event can also refresh controls; neither directly calls numbering. Outstanding metadata work can coincide with the switch. |

A changed report follows this sequence: **settled library → numbering pass → processFrontMatter → host metadata change → manuscript queue plus other refresh paths → settled library → numbering pass**. With immediately current cache data, the second pass finds matching values and stops writing. This is feedback amplification, not proof of an infinite loop. Host cache lag can cause extra write attempts because equality is checked against metadata cache before `processFrontMatter`; there is no second equality check against current frontmatter inside `sync`. The experiment does not simulate that lag.

Before this correction, every `reconcile(library)` chained another whole pass and retained that snapshot. If several newer snapshots arrived during writes, all intermediate orders would subsequently be persisted. Afterward there is at most one not-yet-started snapshot per service, replaced by the latest request; all callers in that pending batch await the same completion. The active pass is not cancelled. Failed batches reject normally; the next queued batch still runs. Continuous changes can still produce multiple passes over time.

A within-Book reorder can shift many local `book_scene_number` and `manuscript_sequence` values, but does not change later Books' series offsets. Insertion/removal in an early Book changes later Books' `series_scene_number`; this is necessary under today's reporting contract, although undesirable for a book-local workflow. Changing a Book's display title can reorder Books and change series offsets **and** the Book segment of `manuscript_sequence`. Every pass examines other Books even when their values remain unchanged.

## Reproducible measurements

Run `node scripts/benchmark-numbering.mjs`. As in #253's harness, an esbuild bundle is created in an OS temporary directory and removed afterward. To measure another revision, archive **src and tsconfig.json**, then pass that directory as the script argument. The fixture uses the real library builder, projection, coordinator and persistence service against an in-memory host. It contains three Books with 30, 300 or 1,000 direct-child Scenes each (93, 903 or 3,003 notes), valid sibling keys and no private text. Assertions check manuscript recognition, diagnostics, event convergence, expected operation counts and final backlog order.

There is one warmup and five sequential repetitions per size/mode, with median and maximum elapsed milliseconds. Complete measurements, including attempted writes, distinct files, other-Book writes, enumerations and maxima: [before](measurements/scene-numbering-before.json), [after](measurements/scene-numbering-after.json). The comparison uses the same final harness and toolchain. Final benchmark runs are sequential, after tests/builds have finished.

The experiment temporarily modifies only the bundled service source, never tracked production source or a vault:

- **persist** uses the production code.
- **no-numbers** removes the two numeric properties from comparisons, writes and managed cleanup, retaining `manuscript_sequence`. Calculation still runs. This models cessation of numeric persistence, not field deletion/migration.
- **no-reporting** bypasses `sync` for all three properties while retaining projection calculation and the file scan.

Each mode starts with its own empty reporting fields. Thus differences also include parsing fewer frontmatter keys, not just write-call cost. No debounce wait, actual disk/YAML serialization, editor work, DOM, paint or complete plugin startup is timed. Generated metadata is made visible immediately and dispatched as one batch after each pass; one settled callback stands for the production refresh boundary. **View rebuild counts are unknown (`null`), not zero.** The normal application's immediate, deferred, resolved and selection refresh fan-out is not replayed. The selection-only measurement establishes zero numbering work, not zero UI work. Reported file writes exclude the initiating author mutation.

For 3,003 notes (1,000 Scenes per Book), elapsed median ms. Disabling columns use baseline source, while the correction column retains all reporting fields. Smaller fixtures and all maxima are retained in the JSON. Node v22.23.1.

| Operation | Baseline | Queue correction | Numeric persistence off | All reporting off |
| --- | ---: | ---: | ---: | ---: |
| startup-missing | 152.825 | 181.421 | 208.095 | 77.749 |
| startup-repeat | 82.144 | 94.38 | 87.031 | 74.082 |
| prose-save | 85.361 | 93.797 | 92.814 | 74.056 |
| context-edit | 83.813 | 94.156 | 98.567 | 75.214 |
| move-last-to-first | 186.775 | 193.94 | 185.101 | 73.799 |
| detach-first | 175.373 | 201.947 | 177.762 | 75.134 |
| restore-scene | 172.783 | 202.025 | 174.306 | 76.317 |
| reparent-to-book1 | 174.489 | 197.804 | 176.483 | 74.564 |
| book-switch | 0.02 | 0.021 | 0.031 | 0.035 |

Counts below are **regeneration passes / file writes / metadata changed events / settled refresh callbacks**. Normal counts are identical before and after the correction. Actual view rebuilds are unmeasured.

| Operation | Normal | Numeric persistence off | All reporting off |
| --- | --- | --- | --- |
| startup-missing | 2/3000/3000/2 | 2/3000/3000/2 | 1/0/0/1 |
| startup-repeat | 1/0/0/1 | 1/0/0/1 | 1/0/0/1 |
| prose-save | 1/0/1/1 | 1/0/1/1 | 1/0/1/1 |
| context-edit | 1/0/1/1 | 1/0/1/1 | 1/0/1/1 |
| move-last-to-first | 2/1000/1001/2 | 2/1000/1001/2 | 1/0/1/1 |
| detach-first | 2/3000/3001/2 | 2/1000/1001/2 | 1/0/1/1 |
| restore-scene | 2/3000/3001/2 | 2/1000/1001/2 | 1/0/1/1 |
| reparent-to-book1 | 2/2000/2001/2 | 2/2000/2001/2 | 1/0/1/1 |
| book-switch | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |

Detaching the first Scene writes all 3,000 Scene files with full persistence, including **2,000 in other Books**. Numeric-only suppression reduces that to 1,000 local files; all-reporting suppression reduces it to zero. A settled prose save still rebuilds the full library once in every mode.

The queue correction deliberately leaves ordinary settled-operation counts unchanged. It is not evidence for faster ordinary clicks. Disabling only the numeric fields still writes every moved Scene because `manuscript_sequence` changes too. Disabling all reporting removes the generated-event round trip, but cannot remove the initial manuscript rebuild or independent refresh paths.

The backlog experiment blocks the first write, requests ten successive rotations, then releases it. It uses the real persistence service with a synthetic resolved library, immediate cache visibility and no metadata-event dispatch or views. Its elapsed time includes CPU work and the artificial gate's scheduling, **not** representative storage latency. “Files” below means distinct files; the same files are rewritten on successive passes. This is an adversarial but valid pending-I/O schedule, not a measured frequency in the author's session.

| Scenes | Requests | Passes before → after | Writes before → after | Distinct files | Median / max ms before | Median / max ms after |
| ---: | ---: | --- | --- | ---: | ---: | ---: |
| 30 | 11 | 11 → 2 | 330 → 60 | 30 | 0.782 / 0.989 | 0.187 / 0.233 |
| 300 | 11 | 11 → 2 | 3300 → 600 | 300 | 4.571 / 6.518 | 1.287 / 1.608 |
| 1000 | 11 | 11 → 2 | 11000 → 2000 | 1000 | 16.114 / 17.124 | 3.607 / 4.115 |

## Interaction diagnosis and live capture

The code can explain a *possible* lost first action: an input blurs or an inactive pane activates after pointer-down, a refresh calls `container.empty()`, and the original target is disconnected before pointer-up/click. `WritingCompanionView.ts:49`, `ManuscriptNavigatorView.ts:314` and PR #255's view audit show those replacement paths. `main.ts:343` unconditionally refreshes Companion and Manuscript on active-leaf change; `updateChapterContextProperty` also refreshes after its write. These paths remain even with all reporting persistence disabled.

No actual pointer-down → replacement → lost action sequence has been captured here. Numbering therefore **confirms synthetic structural-operation overhead; it does not establish the live slowdown, and does not establish the two-click cause**. A delivered action followed by delayed paint, a focus-only first click, or another plugin's behaviour remains distinguishable only through live observation.

Focused capture on Linux and Windows:

1. Create disposable synthetic vaults with three Books, valid distributed order and a mix of populated/missing reports. Use identical copies for each mode. Record Obsidian/MWC/OS versions. Start with MWC alone/default theme; later repeat the failing sequence with the normal plugin/theme set. Do not use the author's manuscript vault.
2. Open Companion, Manuscript, Inspector, Graph and Review before capturing. Load [PR #255's pinned interaction capture](https://github.com/MurmurationPress/murmuration-writing-companion/blob/5b32c4347654830448543ae4833fb7bbfe923a2a/scripts/diagnostics/capture-interactions.js) and start it as documented there. Paste this branch's `scripts/diagnostics/capture-numbering.js`, then run `const numbering = startMwcNumberingCapture();`. This records actual pass requests/completions, write attempts, host modify/metadata events, library rebuilds, refresh calls and available open-view render methods; it stores no paths, prose, control labels or arguments.
3. Separately capture: matching startup/reload, missing reports, one prose save, one POV edit, last-to-first move, first-Book insert/detach/restore, reparent to another Book and Book switch. Repeat at least five times after settlement. For complete startup, start DevTools Performance recording before reload; the pasted script cannot observe work before installation.
4. In each case click a reversible control **once**, then wait two seconds. Repeat after pane activation, after a context-field blur/save, and after returning from another app; also use Tab/Enter/Space. Log intended action invocation/completion and final state. Compare a native Obsidian disclosure/checkbox. Distinguish missing invocation from delayed result and verify that a second press does not execute the action twice.
5. Stop both captures and retain anonymous output: `copy(JSON.stringify(numbering.stop()))`. Require `dropped === 0`. Host modify counts include all writers and write attempts are not proven changed files. In the disposable fixture, compare before/after file hashes locally to count distinct changed files and attribute the reporting fields. Do not infer DOM rebuilds from refresh-call counts; inspect actual render entries and PR #255's DOM mutations.
6. On an identical disposable copy, after initial settlement, repeat with `startMwcNumberingCapture({ disableReportingPersistence: true })`. This temporarily suppresses **all three reporting fields** in this service only; it cannot attribute an improvement specifically to the two numeric fields. Stop restores the methods/listeners; reload and let reporting settle before another normal run. Avoid the separate explicit rebuild command during this experiment, since it creates its own service. Use the synthetic source variants above for the numeric-only comparison.
7. Record DevTools Performance with screenshots off and inspect pointer/blur/active-leaf/metadata/render ordering, original target connectivity, click-handler entry, long tasks and paint. Repeat uninstrumented to assess capture overhead. A disconnected target plus no action invocation supports replacement; a delivered click followed by later completion supports delay. Raw profiles may contain paths—review locally before sharing.

Capture unit tests cover promise forwarding, suppression lifetime and cleanup only. Actual Obsidian compatibility, DOM/input ordering, input-to-visible-response time, cache settlement behaviour and exactly-once actions remain unproven. Nested asynchronous durations overlap and must not be summed.

## Separate ordering and persistence proposal

The recommended model remains **parent relationships plus stable sibling keys, with visible numbers derived on demand**. The existing midpoint key allocator normally changes only an inserted/moved note; exhausted gaps require a reviewed rebalance of that sibling group. Keep that structural advantage instead of making display numbering authoritative.

| Choice | Insertion/move cost and implications |
| --- | --- |
| Persist legal numbers such as `1`, `1.1`, `1.1.1` as authority | A prefix can imply parentage, but inserting an early sibling renumbers following siblings and their descendants; moving a subtree changes all descendant prefixes. References based on numbers become unstable. Numeric segment parsing is required (`1.10` must follow `1.2`, unlike simple lexical sort). It replaces one mass-renumbering mechanism with another and changes compiler authority. |
| Keep `parent` and sibling keys; derive legal labels | Insertion/move changes the structural note(s); display/export traverses the current Book to produce labels without writing other scenes. References remain wikilinks/paths rather than mutable display positions. Nested traversal can support arbitrary depth later, but current Part restrictions and Codex Press validation must be deliberately extended together. |
| Keep continuously persisted flat counters | Maintains native Bases/Dataview compatibility but keeps offset churn and generated-event feedback. Removing only series numbers reduces cross-Book membership churn, not local `manuscript_sequence` renumbering. |
| Explicit reporting/export snapshot | Derive book-local labels/scene count at export or an explicit report rebuild. This preserves author-controlled snapshot workflows without continuous frontmatter maintenance. Native Bases cannot consume an MWC-only in-memory projection; retain a documented opt-in snapshot path if that consumer is needed. |

Book-local display/export derivation is feasible now from the same resolved order; do not use stored numbers as stable scene identifiers. Decide whether labels count all manuscript scenes or only compiler-included scenes, and keep separate notions if both are useful. Today `scene-draft` explicitly opts out of membership; trash, unresolved relationships and deferred legacy Books have their own rules. Do not silently substitute a filter named “excluded” for that contract. A detached Scene should retain its identity for editorial history/links while losing its manuscript position. A visual outline label and a continuous count of Scenes also need not be the same number (Parts consume outline positions, not scene counts).

Checked public Codex Press main at [`93af44922cdb1b83b6166c4f8429d7d9f5b32c07`](https://github.com/MurmurationPress/codex-press/tree/93af44922cdb1b83b6166c4f8429d7d9f5b32c07): `src/compiler/manuscript-order.ts:89,497`, `manuscript-order-key.ts` and `tests/compiler/manuscript-membership.test.ts` establish distributed order/membership. No `book_scene_number` or `series_scene_number` references were found in that checkout. This supports compiler compatibility for deriving/removing counters, **not** compatibility with every installed compiler version, custom template, Bases or Dataview query. Its membership tests explicitly reject treating a stale `manuscript_sequence` as membership authority.

The author no longer needs series numbering, so a follow-up should retire its continuous persistence and offer book-local derived display/export numbers. Audit reporting consumers, specify what happens to old snapshots, provide an explicit reversible cleanup/versioned migration where required, and update documentation and compiler acceptance tests together. Existing unnamespaced reporting fields do not satisfy the Constitution's `mwc_` naming rule. This is an existing contract mismatch to resolve in the separate deprecation/migration proposal; this narrow fix preserves the compatibility boundary (Articles I–III, VII–IX) without adding fields or silently renaming them. Do not add both legal numbering and parent/key as competing authorities. Keep field removal, nested structure support and any new reporting format out of this performance PR.

## Validation and remaining scope

Local validation: full tests (919 TypeScript tests plus 8 build-tool tests), production/test TypeScript checks, production build, bundle analysis/report, release consistency and diff whitespace checks. Added regression coverage for pending snapshot replacement, shared completion, serial active writes, failure recovery, matching-value no-ops, membership cleanup, unrelated property preservation, legacy deferral and exact Undo protection. Benchmark assertions validate counts; no timing threshold is used.

Bundle: 704,913 → **705,049 raw bytes**, 195,534 → **195,571 gzip**; 15,847 raw bytes remain below the unchanged 720,896-byte ceiling. The 669,696-byte warning remains expected; #252's headroom target is still unmet. Version stays 0.18.0. Remote CI status is reported in the draft PR, separately from local results. No merge, release or deployment is part of this work.
