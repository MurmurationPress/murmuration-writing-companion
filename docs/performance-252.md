# Performance maintenance measurements (#252)

This is preventative maintenance. The author reported usable ordinary editing after #251, not a confirmed slowdown. Measurements below were taken before selecting changes; the before source remains `b5664383bba08e52cf307cfd16ef049413efad60` (merged #251). Version remains 0.18.0. No private vault was read by the benchmarks.

## Reproduce

Use Node 22, `npm ci`, then:

```sh
npm run bundle:analyze
npm run bundle:report
npm run benchmark:performance
npm run test:build
```

`bundle:report` writes JSON to stdout and holds all build output in memory. `benchmark:performance` bundles the harness into an OS temporary directory and removes it when finished. To compare another revision, archive **both** `src` and `tsconfig.json` from it into an empty temporary directory, then run:

```sh
node scripts/report-bundle.mjs /path/to/archived-source
node scripts/benchmark-performance.mjs /path/to/archived-source
```

For example, archive `b5664383bba08e52cf307cfd16ef049413efad60` for the before state or `6f74f1149c047722ac9375b36134da0fd545cf70` for #201. These are read-only source snapshots, not branches or vault copies. The current build toolchain is used for both revisions. The benchmark's deferred-drain adapter explicitly supports the unconditional pre-252 callback and the new production `refreshMetadata` method; it does not represent a new production fallback.

## Bundle baseline and result

Production configuration remains minified ES2018 CommonJS from `src/entry.ts`, with `obsidian` and `node:*` external. Node 22.23.1 and esbuild 0.23.1 were used for all size comparisons. The hard installed-byte ceiling is unchanged. Gzip is informational, not the enforcement metric.

| Metric | Before | After |
| --- | ---: | ---: |
| Raw bytes | 709,773 | 704,913 |
| Gzip bytes | 196,041 | 195,534 |
| Hard limit | 720,896 | 720,896 |
| Warning above | 669,696 | 669,696 |
| Remaining headroom | 11,123 | 15,983 |

Raw reduction: **4,860 bytes (0.685%)**. Gzip reduction: **507 bytes (0.259%)**. Budget utilisation changes from 98.457% to 97.783%.

**The 50 KiB headroom target is NOT met.** The remaining gap is **35,217 bytes**. This work references #252; it must not close it or redefine the target as satisfied.

The build-only CSS transformation removes insignificant CSS whitespace using esbuild's CSS parser. Nine existing style literals opt in with `/* css */`; CSS syntax/identifier minification is disabled, strings and descendant selectors remain intact, and all style installation functions remain in their original order. Authored source stays readable; no asset is moved out of main.js. With the runtime changes but CSS transformation disabled, output is **710,411 raw / 196,227 gzip bytes**. Enabling CSS transformation produces the after values above: **5,498 raw bytes** of actual installed-byte savings. The runtime changes add 638 raw bytes relative to the baseline.

Regression tests compare production input sets before/after CSS transformation, require every contributor to remain, verify a single output with no sidecar, and compare repeated builds byte-for-byte. There are still **215** source contributors, **zero bundled node_modules inputs**, and no tests/benchmark/build helpers included in production. Repeated external Obsidian requires are not bundled copies of Obsidian. No accidental test/development input or third-party dependency duplication was found. This does not prove that every internal helper is necessary.

### Largest contributors before optimisation

These are esbuild attributed `bytesInOutput`, not standalone file sizes or measured runtime costs.

| Input | Before bytes | After bytes |
| --- | ---: | ---: |
| `src/main.ts` | 23,113 | 23,072 |
| `src/manuscript/ManuscriptNavigatorView.ts` | 20,948 | 20,948 |
| `src/story-world/StoryWorldReview.ts` | 16,909 | 16,909 |
| `src/entry.ts` | 16,783 | 16,783 |
| `src/story-world/StoryWorldGraphView.ts` | 16,459 | 16,459 |
| `src/companion/EditorialWritingCompanionView.ts` | 13,960 | 13,960 |
| `src/ui/EditorialEnhancementStyles.ts` | 13,375 | 11,517 |
| `src/ui/StoryWorldEntityCreationModal.ts` | 12,684 | 12,684 |
| `src/companion/ContinuityReviewView.ts` | 12,181 | 12,181 |
| `src/story-world/StoryWorldTimelineView.ts` | 11,182 | 11,182 |
| `src/ui/EntityRelationshipWorkspace.ts` | 10,591 | 10,591 |
| `src/editorial/PortableEditorialStorage.ts` | 10,218 | 10,218 |
| `src/ui/StoryWorldTimelineStyles.ts` | 9,894 | 8,926 |
| `src/story-world/StoryWorldGraph.ts` | 9,665 | 9,665 |
| `src/observations/ChapterContextContinuity.ts` | 9,164 | 9,164 |
| `src/companion/CollapsibleWritingCompanionView.ts` | 8,718 | 8,718 |
| `src/manuscript/ManuscriptReconciliation.ts` | 8,708 | 8,708 |
| `src/ui/StoryWorldBuilderStyles.ts` | 8,274 | 7,358 |
| `src/backup/VaultBackupService.ts` | 7,551 | 7,551 |
| `src/story-world/StoryWorldReviewView.ts` | 7,304 | 7,304 |

### Historical baseline reconciliation

The complete #201 source snapshot, **including its tsconfig.json**, reproduces **612,890 raw / 167,592 gzip bytes** with the same esbuild 0.23.1 toolchain. An earlier investigation archived only `src`; that incomplete build context produced 615,169 bytes. Restoring the historical TypeScript configuration explains the entire 2,279-byte discrepancy. The historical lockfile also pins esbuild 0.23.1. There is no need to infer a dependency-version regression to explain the discrepancy.

The pre-252 bundle grew **96,883 raw bytes (15.808%)** since #201. Feature and source growth—not merely build settings—must be considered. The following are the largest positive attributed input deltas, not a complete allocation of net growth or a list of removable features:

| Input | Growth since #201 |
| --- | ---: |
| `src/story-world/StoryWorldReview.ts` | +9,119 |
| `src/main.ts` | +6,040 |
| `src/story-world/IanaTimezoneFallback.ts` | +5,808 |
| `src/backup/VaultBackupService.ts` | +5,633 |
| `src/ui/StoryWorldEntityCreationModal.ts` | +5,069 |
| `src/story-world/TypedEntityProperties.ts` | +4,738 |
| `src/derived-artefacts/DerivedArtefactDefinition.ts` | +4,135 |
| `src/derived-artefacts/LineChartSvg.ts` | +3,788 |
| `src/derived-artefacts/DerivedArtefactService.ts` | +2,634 |
| `src/chat/ManuscriptChat.ts` | +2,596 |
| `src/companion/ContinuitySettingsTab.ts` | +2,529 |
| `src/manuscript/ObsidianManuscriptReorder.ts` | +2,388 |

## Runtime methodology and limits

`benchmarks/RuntimeBaseline.ts` builds 100 / 1,000 / 10,000 synthetic Markdown metadata records. Every fifth note is an entity, alternating Event and an open-vocabulary institution; remaining notes are synthetic scene metadata. Entities have aliases and explicit links to the preceding entity. No prose or author content is loaded. The fixtures exercise actual Story World index, cached review, graph/timeline projection and relationship-target code through a read-only fake Obsidian adapter whose write methods throw.

Each report uses one warmup and five repetitions per fixture. Operation counts are the automated contract. Median and maximum Node durations are informational and never fail CI. CPU scheduling, JIT and GC affect timings; compare counts separately from wall-clock results. The tables below retain both faster and slower results rather than implying universal latency improvements.

`refreshRequests` counts deferred/settled consumer callbacks requested by the harness. It is **not a measured DOM render count**. The harness does not load the plugin into Electron, render the Writing Companion or Manuscript DOM, or measure real Obsidian editor latency. Real DOM/fan-out profiling and broader manuscript-library fixtures remain open work under #252. Existing 10/30/100 KB editor tests still check one changed-line read and zero position scans for ordinary keystrokes.

### Accepted changes and explicit lifecycle ownership

1. **Retain unchanged index records during authoritative reconciliation.** Previously every pass cleared all primary/secondary maps, parsed/cloned each valid entity and sorted/serialised the full entity array twice. The index now reconciles the complete document set, uses its existing defensive frontmatter copy to recognise unchanged documents before parsing/cloning, updates only changed records, and removes absent paths. There is no new persistence, TTL or independent cache. Last duplicate path wins, matching the prior final-state semantics. The comparison preserves YAML value types (in particular Date objects versus equal-looking strings); JSON alone is insufficient here. Per-file updates still detect in-place metadata changes; identity/alias indexes are updated or removed normally.
2. **Avoid a redundant deferred consumer refresh when nothing settled differently.** The existing coalesced pending-path set and 50 ms delay remain. `StoryWorldReviewProjectionService.refreshMetadata` always retries the paths, updates the index and review fingerprints, and returns whether either changed. Only a true result requests the additional consumer refresh. Changed review evidence without an entity change still requests refresh. Initial/late missing metadata still enters the index on a later read or resolved pass.
3. **Read each review fingerprint's file cache once.** Frontmatter and links come from the same cached object. This removes repeated metadata lookups without changing fingerprint content or invalidation ownership.

The initial index-reconciliation experiment retained records but still parsed every unchanged entity; its sampled large-vault time did not improve. It was not accepted in that form. Comparing the stored defensive frontmatter before parsing was measured next; the final results are below.

No startup or post-startup `resolved` pass was removed or deferred. Every resolved batch still enumerates all Markdown and invalidates review before refreshing consumers. No work was added to `editor-change`. This is deliberately narrower than coalescing all workspace refresh paths.

### Deterministic before/after counts

For a vault of N Markdown files with N/5 entities:

- Startup remains one initial pass, one layout fallback if needed, and a resolved pass; later resolved events each perform one pass.
- Each unchanged resolved pass still enumerates N files once, but changed upserts drop from N/5 to **0**, and full-entity sorts from **2 to 0**. Unchanged record identity is retained.
- Cold review lookup reads drop from **4N to 3N** (25%); its two vault enumerations remain. Ten warm review consumers still perform **zero** enumerations/reads.
- A burst of 20 unchanged ordinary metadata notifications plus its one deferred drain drops from **63 to 42** cache reads (33.3%). Deferred refresh requests drop **1 to 0**; there are no vault scans in this burst. This does not claim that all other immediate/resolved callbacks disappear.
- Delayed import still requests refresh and resolves from the same shared index. Existing tests retain unresolved-to-resolved Continuity findings, canonical names/aliases/path-qualified links, ambiguity blocking, custom types, rename, restore, delete and Trash exclusions.

### Complete measured stage results

Counts below are ordered as **vault enumerations / cache reads / upserts / changed upserts / full-entity sorts / refresh requests**. Timings are milliseconds (median / maximum of five runs).

| Files | Stage | Before counts | After counts | Before ms | After ms |
| ---: | --- | --- | --- | ---: | ---: |
| 100 | startup-initial | 1/100/100/20/2/0 | 1/100/100/20/0/0 | 0.504 / 0.621 | 0.286 / 0.458 |
| 100 | startup-layout | 1/100/100/20/2/1 | 1/100/100/0/0/1 | 0.286 / 0.468 | 0.139 / 0.244 |
| 100 | metadata-resolved | 1/100/100/20/2/1 | 1/100/100/0/0/1 | 0.484 / 0.654 | 0.170 / 0.525 |
| 100 | review-cold | 2/400/0/0/1/0 | 2/300/0/0/1/0 | 1.888 / 2.796 | 1.609 / 2.441 |
| 100 | review-warm-10-consumers | 0/0/0/0/0/0 | 0/0/0/0/0/0 | 0.004 / 0.008 | 0.003 / 0.005 |
| 100 | unchanged-resolved | 1/100/100/20/2/1 | 1/100/100/0/0/1 | 0.301 / 0.577 | 0.156 / 0.172 |
| 100 | ordinary-metadata-burst-20 | 0/63/21/0/0/1 | 0/42/21/0/0/0 | 0.105 / 0.236 | 0.073 / 0.147 |
| 100 | delayed-import | 1/104/102/22/2/2 | 1/103/102/1/0/2 | 0.348 / 0.603 | 0.171 / 0.296 |
| 100 | relationship-candidates-10 | 0/0/0/0/20/0 | 0/0/0/0/20/0 | 1.148 / 2.404 | 1.344 / 2.500 |
| 100 | graph-projection | 0/0/0/0/1/0 | 0/0/0/0/1/0 | 0.229 / 0.333 | 0.325 / 0.647 |
| 100 | timeline-projection | 0/0/0/0/1/0 | 0/0/0/0/1/0 | 0.027 / 0.038 | 0.032 / 0.074 |
| 1,000 | startup-initial | 1/1000/1000/200/2/0 | 1/1000/1000/200/0/0 | 1.331 / 1.744 | 1.396 / 2.169 |
| 1,000 | startup-layout | 1/1000/1000/200/2/1 | 1/1000/1000/0/0/1 | 1.562 / 1.936 | 0.897 / 1.591 |
| 1,000 | metadata-resolved | 1/1000/1000/200/2/1 | 1/1000/1000/0/0/1 | 1.833 / 2.611 | 0.686 / 1.561 |
| 1,000 | review-cold | 2/4000/0/0/1/0 | 2/3000/0/0/1/0 | 11.109 / 14.378 | 13.109 / 13.301 |
| 1,000 | review-warm-10-consumers | 0/0/0/0/0/0 | 0/0/0/0/0/0 | 0.004 / 0.007 | 0.006 / 0.007 |
| 1,000 | unchanged-resolved | 1/1000/1000/200/2/1 | 1/1000/1000/0/0/1 | 1.410 / 2.426 | 1.046 / 1.145 |
| 1,000 | ordinary-metadata-burst-20 | 0/63/21/0/0/1 | 0/42/21/0/0/0 | 0.063 / 0.203 | 0.071 / 0.121 |
| 1,000 | delayed-import | 1/1004/1002/202/2/2 | 1/1003/1002/1/0/2 | 1.425 / 2.674 | 0.575 / 0.937 |
| 1,000 | relationship-candidates-10 | 0/0/0/0/20/0 | 0/0/0/0/20/0 | 9.210 / 10.501 | 7.837 / 11.032 |
| 1,000 | graph-projection | 0/0/0/0/1/0 | 0/0/0/0/1/0 | 0.952 / 1.189 | 0.903 / 1.106 |
| 1,000 | timeline-projection | 0/0/0/0/1/0 | 0/0/0/0/1/0 | 0.104 / 0.124 | 0.095 / 0.103 |
| 10,000 | startup-initial | 1/10000/10000/2000/2/0 | 1/10000/10000/2000/0/0 | 16.330 / 21.683 | 14.322 / 14.917 |
| 10,000 | startup-layout | 1/10000/10000/2000/2/1 | 1/10000/10000/0/0/1 | 16.037 / 16.741 | 5.947 / 6.237 |
| 10,000 | metadata-resolved | 1/10000/10000/2000/2/1 | 1/10000/10000/0/0/1 | 14.917 / 18.285 | 7.299 / 7.575 |
| 10,000 | review-cold | 2/40000/0/0/1/0 | 2/30000/0/0/1/0 | 72.502 / 83.703 | 70.379 / 72.289 |
| 10,000 | review-warm-10-consumers | 0/0/0/0/0/0 | 0/0/0/0/0/0 | 0.004 / 0.005 | 0.004 / 0.004 |
| 10,000 | unchanged-resolved | 1/10000/10000/2000/2/1 | 1/10000/10000/0/0/1 | 14.884 / 16.394 | 5.187 / 5.631 |
| 10,000 | ordinary-metadata-burst-20 | 0/63/21/0/0/1 | 0/42/21/0/0/0 | 0.069 / 0.082 | 0.077 / 0.131 |
| 10,000 | delayed-import | 1/10004/10002/2002/2/2 | 1/10003/10002/1/0/2 | 13.687 / 15.867 | 5.189 / 6.229 |
| 10,000 | relationship-candidates-10 | 0/0/0/0/20/0 | 0/0/0/0/20/0 | 81.387 / 88.336 | 76.755 / 80.497 |
| 10,000 | graph-projection | 0/0/0/0/1/0 | 0/0/0/0/1/0 | 6.934 / 7.601 | 6.055 / 7.527 |
| 10,000 | timeline-projection | 0/0/0/0/1/0 | 0/0/0/0/1/0 | 0.392 / 1.505 | 0.328 / 1.017 |

Some cold-review timings are slower in these runs despite fewer cache reads; no end-to-end cold-review speedup is claimed. The unchanged-index stage shows a timing improvement as well as fewer mutations/sorts. The deferred-drain improvement removes one whole consumer callback rather than shifting it to another timer.

## Warning policy

`bundle-policy.mjs` is shared by production build, analysis/reporting and release validation. Raw size at or below **669,696** bytes is healthy; above that threshold prints an explicit warning. Above **720,896** bytes fails. Exactly the hard limit remains allowed but warns. Every build/release report includes raw/gzip bytes, both thresholds and remaining headroom. CI already invokes build and release validation, so both Ubuntu and Windows expose this policy. The current result intentionally warns; the hard ceiling is not raised.

## Remaining work and real-vault checks

Do not close #252 with this partial result. The raw headroom gap above and full Obsidian refresh-duration baselines remain outstanding. No evidence was found for a safe, single dependency/development-code removal that would supply the missing bytes. Reaching the target now requires additional measured consolidation, not dropping features or moving bytes to an uncounted asset.

Concrete next steps:

- Profile callback fan-out and actual DOM work in Writing Companion, Manuscript Navigator, Entity Inspector, Continuity Review, Timeline and Graph, with no views, one view and multiple visible/inactive leaves. Instrument existing 50/100/150 ms queues and measure total batch work before considering further coalescing.
- Extend synthetic fixtures to manuscript hierarchy/order and editorial-store workloads, and record lifecycle timings for rename/restore/delete and real editor interactions. Existing correctness tests cover these events, but this harness does not time every one.
- Audit the inherited Companion renderers and repeated inspector/form controls for consolidation, proving which compatibility paths are unused before removing them. Current production contributions are not proof of dead code.
- Inspect repeated style rules/data tables for maintainable source-level deduplication; the accepted whitespace savings are much smaller than the remaining target. Report any total installed-asset tradeoff explicitly.
- Recheck #250/#251 in the real vault: delayed/imported entities, an already-open relationship editor, valid Cabinet Office/UK Government resolution, Continuity findings, alias ambiguity and Trash/restore behaviour. Do not deploy or modify that vault automatically.

Preserve Markdown/YAML authority, disposable indexes, author-facing functionality/accessibility, manuscript/editorial-storage safety and Undo/reconciliation fresh reads. No migration, dependency change, lockfile churn, private manuscript fixture, version change or release is part of this work. Related completed work: #197/#198, #199/#200/#201, #239 and #250/#251.

## Local validation of this partial implementation

- `npm test`: passed; direct execution confirms **921 tests across 118 files**, including **107 focused tests across 12 files** (index, review, relationships, refresh, keystroke and build policy).
- Both production and test TypeScript checks: passed.
- Production build, bundle analysis and JSON composition report: passed; the early headroom warning is expected, and the hard ceiling remains satisfied.
- Warning/ceiling boundary tests (including exact thresholds, UTF-8 and highly compressible oversized input): passed.
- CSS significant-whitespace, contributor-retention and repeated-build byte equality tests: passed.
- `release:check` and `git diff --check`: passed.
- Ubuntu/Windows CI results belong to the published branch/PR; local Linux validation does not substitute for those remote checks.

The diff contains only intended source, build tooling, synthetic benchmarks, tests and maintainer documentation. Version/manifest, dependency versions, package-lock, styles.css and release state are unchanged. Runtime benchmarks and build analysis do not read or write any author vault.
