# #252: completed large cold-start investigation and cheaper renders

This is a partial delivery after #265. The headroom target and umbrella acceptance remain open. No version, stylesheet, budget, authoring schema or compiler contract changes.

## Reproduction and scope

Baseline: `9b5568306cedc858983c081370bf1b294ffdc28d` (merged #265). Production changes: `ca1e71d4fd11a83b1a9c2352c624b0ebe09bd3dc`. Build with `npm ci`, `npm run bundle:analyze`, `npm run bundle:report`, and `npm run release:check`. Node 24.19.0, esbuild 0.23.1; unchanged minified ES2018 CommonJS with external Obsidian/Node APIs, no code splitting or production diagnostics. CSS and manifest are byte-identical to baseline.

Linux 7.0.0-38-generic, Intel i7-6700 (4 cores / 8 threads). Disposable Obsidian/Electron processes use `--disable-gpu`; no timed run overlaps a build, test suite or another timed run. The normal author vault is not used. Source inspection and report writing continue during runs. OS caches are not flushed, and fixture creation warms filesystem data. These are synthetic, instrumented measurements on a shared desktop, not physical input-to-photon measurements.

The fixtures contain exactly 100 / 1,000 / 10,000 notes: three Books, three Parts, 72 / 792 / 7,992 Scenes, 20 / 200 / 2,000 entities and two control notes. Every Book mixes direct Scenes and Part children. Companion and Navigator are open. Cold runs use a new process, empty profile/database and newly generated vault every time. Warm comparisons use the same fully indexed fixture/profile, with source restoration, one warmup and five samples per edit stage. The large warm fixture was indexed once with MWC disabled; that setup is excluded from cold results.

```sh
# Run serially, first with baseline built assets, then current assets.
MWC_PROFILE_SIZES=100,1000,10000 MWC_PROFILE_REPEATS=2 MWC_COLD_LIMIT_MS=300000 \
  node scripts/diagnostics/profile-cold-complete.mjs /path/to/built-checkout /tmp/cold.json
node scripts/diagnostics/profile-render.mjs /path/to/built-checkout /tmp/mwc-startup-XXXX /tmp/render.json
```

Set `MWC_PROFILE_HOST_ONLY=1` for a fresh-profile host-only control: MWC remains disabled and all 10,000 frontmatter caches must be present. Its empty tool panes are not a first-usable-MWC comparison.

The cold driver prints progress about every ten seconds. Its five-minute observation window is bounded; individual CDP calls also have a two-minute timeout. A busy renderer can delay the final observation. Timeouts are incomplete observations. First contextual controls, host metadata readiness, plugin initialization, index construction/reconciliation and complete settlement are separate boundaries. Completed trials assert all Books, Scenes and entities, zero unresolved manuscript notes, initial `B0S000.md` context and zero frontmatter writes. The launch-to-final-observation metric includes application boot, trust-author interaction and the same 1.1-second trailing buffer used by #265. Polling is every 200 ms.

The render driver wraps actual view methods, DOM element creation and date formatter construction. Synchronous timings are nested: do not add parent and child totals. DOM creation instrumentation does not measure all style/layout work. The driver separately measures successful native click-to-two-animation-frames, verifies exactly one toggle, and verifies blur-save persistence. That latency proxy does not include all subsequent reconciliation and is not physical OS input latency.

## Measured bottlenecks and changes

The extended baseline identifies the failure to settle: after Scene metadata discovery, each entity metadata event synchronously rebuilds Navigator, including a full-book Continuity Review count and two creation snapshots. Expensive rendering delays host discovery, allowing reconciliation/render timers to fire repeatedly between individual notes. Two five-minute baseline trials stopped with only 116 / 121 of 2,000 entities indexed, half the Scenes unresolved (their Parts had not arrived), and over 100 seconds spent inside Navigator rendering in each trial. It is not a completed startup timing.

Non-manuscript metadata now requests a bounded `ReconciliationQueue` render: one render per burst, a maximum one-second wait during continuous imports, and cancellation on unload. Index updates remain immediate. All active-file, author action, manuscript integrity and interaction-guard paths remain intact. This combines duplicate work; it does not queue one delayed callback per event or assume a partial index is complete.

Inside a representative baseline large render, Navigator constructs 2,665 identical `Intl.DateTimeFormat` objects (about 214 ms median); Companion spends about 205 ms in Chapter Context, mostly preparing an offer that cannot be shown for the already-dated Scene. Three display-only library rebuilds account for three of the five warm Markdown scans.

- Navigator reuses one fixed en-GB/UTC formatter, preserving output and date validation. It caches the formatter, not authored values.
- A dated or unsupported-date Scene fails the existing undated eligibility check before building a preceding-date snapshot. Undated offers and acceptance retain fresh structural validation and original-Scene targeting.
- Navigator passes its already-settled library to the Part/Scene creation **display** snapshots. Modal, planning, execution and recognition callers still rebuild from current authority. No persistent snapshot cache is introduced.
- Always-overridden plugin-base fallback implementations become abstract contracts. The sole production entry already implements every hook; inherited methods called through `super` remain. This removes unreachable fallback notices and no-op methods without removing functionality.

## Bundle

| Asset | Baseline raw / gzip | Current raw / gzip |
| --- | ---: | ---: |
| JavaScript | 682,657 / 193,487 | 682,304 / 193,378 |
| CSS | 63,555 / 10,217 | 63,555 / 10,217 |
| Manifest | 277 / 185 | 277 / 185 |
| Installed total | 746,489 / 203,889 | 746,136 / 203,780 |

Genuine total saving: **353 raw / 109 summed-gzip bytes**; CSS relocation: **zero**. Runtime safeguards and reuse parameters cost 208 raw bytes before removing 561 bytes of obsolete base implementations. Headroom is **38,592**, and the remaining gap is **12,608**. The **720,896 ceiling / 669,696 warning threshold** remain unchanged, with the warning visible.

The composition report still contains no third-party bundled dependency, duplicate dependency package, tests or instrumentation. The largest modules are feature implementations. This pass does not introduce a higher syntax floor, fragile minification settings, deferred asset loading or broad view rewrites to force a 12 KiB reduction. Further safe consolidation remains work under #252; the target has not been lowered.

## Completed cold measurements

The current production bundle completes both fresh 10,000-note trials. All completed trials assert complete indexes, no unresolved manuscript structure, initial context and zero frontmatter writes. The original head's 682,657 / 193,487 size and representative ~5.3-second medium startup reproduce (5.442 seconds in this pass).

| Notes | Baseline final observation | Current final observation | Baseline → current Navigator renders |
| --- | --- | --- | --- |
| 100 | 3.317 s | 3.355 / 3.841 s | 28 → 7 / 6 |
| 1,000 | 5.442 s | 5.069 / 4.973 s | 208 → 7 / 7 |
| 10,000 | incomplete at 302.291 / 301.894 s | **94.808 / 97.922 s** | partial baseline counts are not a completed-work comparison |

Two earlier candidate runs, before removal of unreachable base fallbacks, also completed in 96.769 / 101.467 seconds. Their bundle hash and samples are retained separately. No speedup ratio is calculated from censored baseline results, and no small-vault startup speedup is claimed.

For the final large runs:

| Boundary or work | Trial 1 | Trial 2 |
| --- | ---: | ---: |
| Plugin `onload` (awaited wall duration) | 22.3 ms | 318.1 ms |
| First contextual Companion/Navigator controls (since plugin entry) | 46.951 s | 51.996 s |
| Host metadata ready observed (since plugin entry) | 89.507 s | 93.853 s |
| Settlement observed (since process launch, before trailing buffer) | 93.383 s | 96.515 s |
| World rebuilds / cumulative synchronous time | 55 / 3.944 s | 60 / 4.293 s |
| Manuscript builds / cumulative synchronous time | 16 / 3.265 s | 22 / 4.165 s |
| Companion renders / cumulative synchronous time | 58 / 5.417 s | 69 / 5.835 s |
| Navigator renders / cumulative synchronous time | 41 / 7.406 s | 45 / 7.679 s |
| Markdown enumerations | 308 | 358 |

Clock origins differ deliberately and are labeled. `onload` overlaps discovery and is variable; no initialization-duration speedup is claimed. First controls do **not** imply metadata completeness. Synchronous work totals exclude subsequent browser style/layout and are nested with other counters; they must not be summed as exclusive CPU time. The `settle()` wrapper measures async invocation, so use the completed index assertions and observed settlement boundary rather than treating that wrapper's milliseconds as complete settlement duration.

Fresh host-only controls, with MWC disabled, took **24.714 / 24.802 seconds** through the same final-observation buffer, asserting all 10,000 frontmatter caches present. This distinguishes the substantial host discovery cost from the slower combined host/plugin path; the difference is not a measurement of exclusive plugin CPU time. Remaining work includes the many partial World/Manuscript reconciliations, full-book review calculations and browser layout/GC during discovery. Completing these synthetic runs does not complete large-vault startup optimization.

## Warm render results

All scales use application **1.14.4 on both sides**, with the same synthetic source, panels, settings and driver; the archive is copied into each reused profile before either comparison. Cold results separately use 1.13.7. All final samples retain **one Companion / one Navigator render** and perform **two Markdown enumerations**, versus five in the baseline. One large baseline prose sample also recorded a sixth enumeration with an unclassified idle cause; its trace is retained and no extra render occurred. Enumerations through `getAllLoadedFiles`, notably creation inventories, are not counted as Markdown scans.

Median cumulative synchronous render work per save, milliseconds:

| Notes | Prose Companion | Prose Navigator | Metadata Companion | Metadata Navigator |
| --- | ---: | ---: | ---: | ---: |
| 100 | 20.3 → 12.8 | 16.7 → 8.5 | 19.1 → 13.1 | 17.2 → 8.0 |
| 1,000 | 37.5 → 16.9 | 97.6 → 34.6 | 36.5 → 16.9 | 93.9 → 32.4 |
| 10,000 | **348.0 → 148.2** | **957.5 → 319.6** | **342.3 → 145.7** | **961.7 → 313.3** |

At 10,000 notes, formatter constructions fall **2,665 → 1** per measured edit (the remaining constructor is outside the cached Navigator formatter); median constructor time falls **213.9 → 0.2 ms**, tooltip method totals **326.0 → 84.6 ms**, and Companion Chapter Context **205.4 → 4.7 ms**. Reusing the creation library removes two display rebuilds; rejecting a dated target before offer construction removes the third. These are reductions in actual work, not timer redistribution. The fixture's active Scene is dated: an undated Scene still requires its fresh offer snapshot and can perform another scan.

Median element creation count remains **42,823 → 42,823** for the large saved edit. Full-book review count calculation remains approximately **241 ms across two calls**, one in each view. The single Navigator render is still a substantial long task. This pass preserves the full tree rather than introducing unreviewed virtualization; deferred style/layout/GC and these remaining projections need further profiling.

Successful native click-to-two-frame medians, milliseconds (one warmup for edit stages, five samples per interaction scenario):

| Notes | Clean toggle | Blur-save toggle |
| --- | ---: | ---: |
| 100 | 53.7 → 50.2 | 38.5 → 55.1 |
| 1,000 | 44.2 → 47.1 | 51.4 → 43.0 |
| 10,000 | 45.0 → 45.0 | 44.7 → 37.6 |

All toggles execute once and blur saves persist the original Scene exactly once. These proxy latencies do not show a universal speedup and must not be substituted for cumulative rendering work or physical input latency. [Complete repeated measurements and composition](measurements/252-cold-render.json) preserve every count/timing sample and representative traces. Failed setup attempts on the initially partial large host database are excluded; that database was fully indexed with MWC disabled before either warm measurement.

## Validation and remaining work

Local validation passes **1,000 TypeScript tests + 15 script tests**, both TypeScript checks, production build/analysis, bundle and release/package checks, performance/chronology/numbering benchmarks, synthetic Codex Press integration and whitespace checks. The compiler check compares authoritative order/prose with stale and refreshed numbers; it is not a live export. Exact final-head Ubuntu/Windows CI results are recorded in the PR. Production JavaScript SHA-256: `2d1466becd5c458b493b1a68fd8f619d3d25e5989a14a8b4320a607e615fc828`.

New deterministic regressions cover fixed formatter reuse with unchanged date semantics, display-only snapshot reuse versus fresh mutation/default reads, early dated-target rejection without a scan, and queued rendering adopting the latest metadata/context and cancelling on disposal. Existing external evidence, late collection, numbering, Trash, preparation Undo and exact-content protections remain enabled.

Disposable Linux Obsidian 1.14.4 with **unmodified production assets** passes Book-only refresh (26 owned files), zero-write unchanged repeat, author alias preservation, external cross-Book stale status with zero automatic writes, pending World and Navigator queue cancellation, reload context and native CSS loading. Plain-target creation/deletion and a resolver-only late update refresh both cached evidence and the retained Continuity Review collection. The latter check changes the host resolver for one synthetic reference and emits only `resolved`; it is a host-seam test, not a claim of real sync-provider timing.

Native replay passes **35 pointer blur cases, 25 keyboard cases, two external-update cases, one injected failure/retry, and 30 first-click cases**, plus **five uninstrumented blur cases in a fresh host**. Original-Scene persistence, successful single actions and focus assertions stay enabled. A setup attempt retained Book1 selection after the late-review check and lacked the Book0 replay target; resetting the synthetic selection and rerunning the complete suite passes. Protected/failed/cancelled/concurrent numbering and preparation Undo remain automated coverage, not newly claimed live checks.

```sh
node scripts/diagnostics/verify-performance-safety.mjs /path/to/built-checkout /tmp/mwc-startup-XXXX /tmp/safety.json
# The driver leaves the disposable host open. Restore B0S000's Book0 parent/order,
# select Book0, and set B0S001's title to "Scene 0 001" before native replay.
node scripts/diagnostics/replay-blur-save.mjs --vault=/tmp/mwc-startup-XXXX/vault --expect-fixed
node scripts/diagnostics/replay-first-click.mjs --vault=/tmp/mwc-startup-XXXX/vault --expect-fixed
# Restart the host to remove all probe wrappers before this check:
node scripts/diagnostics/replay-blur-save.mjs --vault=/tmp/mwc-startup-XXXX/vault --uninstrumented --expect-fixed
```

Keep #252 open: the bundle gap, remaining large-render/layout cost, broad-panel profiling and wider live acceptance are separate from completing these synthetic cold trials. Windows CI is not Windows UI acceptance. Physical application focus, multi-window/IME, broader themes/plugins, native Bases and live PDF/EPUB exports remain unverified in this pass. No author vault is changed or used as a benchmark.
