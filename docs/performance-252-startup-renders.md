# #252: repeated renders and cold-start follow-up

This is a partial delivery after #264, not completion of #252. The 50 KiB headroom target remains unmet. Large cold startup and wider live acceptance remain open.

## Reproduction and boundaries

Baseline: merged #264, `92ace1a122e8e456d03feeeb154cf53e5962651c`. Production changes measured here: `d7a67099da9bb4edefb789c84b6f7a2a8f9a10f6` (including `09d1ec5`). Subsequent measurement/documentation changes do not enter the production bundle. Baseline main.js SHA-256: `31c83a3697e278122af370e96b9aca0e27ed0ea95cb3605f6e70a61f182f2eb4`; after: `8b9971957a696fb408153427a9cb8ff991114ff8ec824cd6230b3c4219e133d8`.

Linux 7.0.0-38-generic, Intel i7-6700 (4 cores/8 threads), Node 24.19.0, esbuild 0.23.1. Production configuration remains minified ES2018 CommonJS, external Obsidian/Node APIs, no source map, no split/deferred code. Run `npm ci`, `npm run bundle:analyze`, `npm run bundle:report` in separate baseline/current worktrees. Gzip uses Node's existing bundle reporter; combined gzip is the sum of independently compressed installed assets.

Live profiles use the Obsidian 1.13.7 installer / Electron 43.3.0 / Chromium 150.0.7871.212 with `--disable-gpu` on the same shared Linux desktop, serially, with no simultaneous build/test workload. Fresh-profile cold runs load bundled application 1.13.7 (confirmed from the installed archive package metadata); reused warm profiles load cached application 1.14.4. The shell user agent continues to say 1.13.7 in both cases. The medium/large warm pairs start after the same 1.14.4 archive is cached; their original output records the user agent, not the title. The small pair is rerun with that archive installed before either launch. Drivers now also capture the application title to avoid this ambiguity in future runs. Do not pool cold and warm timings across application versions. Only MWC is enabled. Synthetic fixtures contain 100 / 1,000 / 10,000 Markdown notes: three Books, three Parts, 72 / 792 / 7,992 Scenes, 20 / 200 / 2,000 entities and two control notes. Companion and Manuscript Navigator are open. No private content is used.

```sh
# Run from this checkout, passing each worktree's built assets in turn.
MWC_PROFILE_REPEATS=3 node scripts/diagnostics/profile-startup.mjs /path/to/built-worktree /tmp/cold.json
# Reuse a fixtureRoot from cold.json, after it has finished indexing.
node scripts/diagnostics/profile-warm.mjs /path/to/built-worktree /tmp/mwc-startup-XXXX /tmp/warm.json
```

The startup driver creates a fresh process, vault and empty Obsidian profile/database for every trial. This is distinct from plugin reload in an indexed host. **The OS file cache is not flushed**; fixture creation itself warms files. Process-launch observation includes host boot, a trust-author interaction and a 1.1-second settling buffer. Readiness requires metadata pending count and manuscript integrity queue to reach zero. The 60-second observation limit is censored: a busy renderer can delay the final observation beyond the limit. First contextual controls means the selected Scene, Companion title and a Navigator entry are present, sampled every 200 ms; it does not mean all metadata is ready.

The probe is appended only to the disposable installed bundle, never imported by the production entry. It counts actual callbacks, renders, rebuilds, file enumerations and frontmatter calls. Metadata event counts are handler invocations, not unique host events. Synchronous method timings are nested; do not add parent and child durations. Async settlement method timings cover invocation, not its awaited continuation. Probe overhead is present in both builds. Committed [cold samples](measurements/252-cold-start.json) retain every trial's counts/timings and representative edit event traces, omitting huge repetitive startup traces.

## Bundle accounting

| Installed asset | Baseline raw / gzip | After raw / gzip |
| --- | --- | --- |
| main.js | 685,795 / 193,821 | 682,307 / 193,386 |
| styles.css | 63,555 / 10,217 | 63,555 / 10,217 |
| manifest.json | 277 / 185 | 277 / 185 |
| Total | 749,627 / 204,223 | 746,139 / 203,788 |

Genuine total raw reduction: **3,488 bytes**; summed gzip reduction: **435 bytes**. CSS movement: **zero**. JavaScript headroom: **38,589 bytes**; remaining reduction needed for the unchanged target: **12,611 bytes**. The warning is expected and remains visible. Stylesheet generation, native loading, installation/release assets and cascade order are unchanged.

Cumulative size attribution, rebuilding each source group with the same options ([raw measurements](measurements/252-size-steps.json)):

| Source step | JS raw / gzip | Incremental raw / gzip change |
| --- | --- | --- |
| #264 baseline | 685,795 / 193,821 | — |
| Remove overridden/unused renderers | 682,870 / 193,095 | −2,925 / −726 |
| Group unchanged timezone identifiers | 680,754 / 192,903 | −2,116 / −192 |
| Runtime reconciliation and lifecycle safeguards | 682,307 / 193,386 | +1,553 / +483 |

To reproduce attribution, archive baseline `src`, `tsconfig.json` and `manifest.json` into a temporary source directory. Run `node scripts/report-bundle.mjs /path/to/archive` after each cumulative copy from the measured production commit: (1) `WritingCompanionView.ts` and `EditorialWritingCompanionView.ts`; (2) `IanaTimezoneFallback.ts`; (3) the remaining changed production files listed by `git diff 92ace1a d7a6709 --name-only -- src`. Each report uses the current shared build options and writes no installed bundle. All steps retain identical CSS/manifest bytes. Runtime safety/convergence code consumes some of the savings; removing it to chase size would be the wrong tradeoff. Runtime results below measure the combined event-ownership changes, not isolated causal timing claims for each line edit.

[Full composition](measurements/252-bundle.json) has no bundled third-party dependencies or diagnostic/test inputs. Largest remaining contributors are main (24,884), Navigator (21,087), Story World review (16,909), entry (16,867), Graph (16,468) and editorial Companion (14,883 bytes). There is no duplicated dependency package to remove. Broader product-view consolidation is a possible future design task, not a safe arbitrary deletion to reach the target. All shipped code is included; no deferred-loading proposal is used.

## Changes and event ownership

- Manuscript metadata changes already queue authoritative integrity settlement. That settlement now owns the Companion/Navigator refresh, removing the early old-index render and chronology timer render. The entry-level Navigator timer continues refreshing Story World consumers, but no longer repeats Manuscript rendering.
- `resolved` bursts now produce one authoritative reconciliation after 100 ms quiet, with a 1,000 ms maximum wait during continuous activity. This **removes repeated full passes**, rather than simply postponing each callback. Initial construction remains synchronous. Disposal cancels both timers and guards late callbacks.
- Unchanged full Story World rebuilds no longer invalidate consumers. Late non-entity metadata/link evidence and missed deletions are still compared using the same authoritative file enumeration. Incremental evidence changes are remembered until the consumer drain, even if the later rebuild is unchanged.
- Initial host file discovery also emits `create` for each file. The existing integrity queue includes those new notes; the redundant immediate Companion/Navigator requests are removed. File-open context handling remains immediate. Actual new entity evidence still marks world consumers dirty.
- Always-overridden base renderers and an unused private Markdown renderer are removed. Abstract intermediate classes make the concrete renderer requirement explicit. The unchanged 312-entry IANA fallback is grouped by region, with a digest test preserving identifiers and order. This replaces repeated prefixes with a small bounded string-expansion step; it does not remove timezone support.

Native interaction/persistence code, authoritative order, numbering writer, preparation/Undo, stylesheet source/order and compiler integration are unchanged. The new bounded queue plus unload guards prevent pending startup callbacks from resurrecting work after unload. Meaningful regressions cover burst coalescing, continuous-stream deadlines, disposal/late callbacks, late review evidence, missed deletions and unchanged snapshot reuse.

## Cold results

Three fresh-profile trials per size and build; ranges below. These are process-launch observation times, not plugin `onload` duration.

| Notes | Baseline observation | After observation | Full file enumerations before → after | World rebuilds before → after |
| --- | --- | --- | --- | --- |
| 100 | 4.00–4.17 s | 3.11–3.23 s | 578–621 → 44 | 86–93 → 3 |
| 1,000 | 31.87–57.47 s | 5.03–5.21 s | 6,148–7,308 → 47 | 881–956 → 4 |
| 10,000 | censored at 60 s | censored at 60 s | 4,401–4,549 → 278–380 within observed windows | 545–565 → 33–36 within observed windows |

Separate measured boundaries (ranges in ms):

| Notes | Plugin onload before → after | Cumulative world rebuild before → after | First contextual controls after plugin entry, before → after |
| --- | --- | --- | --- |
| 100 | 15.2–17.8 → 16.7–20.4 | 15.4–17.9 → 3.4–4.2 | 1,532–1,738 → 910–1,008 |
| 1,000 | 11.1–42.3 → 8.2–55.9 | 1,118–1,200 → 29.4–31.3 | 24,792–30,354 → 2,752–2,938 |

No improvement to the short, variable `onload` boundary is claimed. The larger benefit is reduced work during host metadata discovery/reconciliation. At 10,000 notes the after run performs more manuscript index construction because it advances much further through metadata discovery; comparing that partial work as a completed-index speedup would be misleading.

All completed cold trials preserve initial `B0S000.md` context and make zero frontmatter writes. At 10,000 notes the baseline still has 9,421–9,429 pending metadata tasks; after has 1,998–2,074. This shows progress within a bounded observation window, **not a completed-startup speedup ratio**. Two after trials show contextual controls at 45.81 / 50.34 s; the third does not before timeout. No partial-index edit samples are compared.

Cold Companion renders fall from 110–115 to 6 (100 notes) and 1,085–1,160 to 6 (1,000). Navigator renders remain 28 and 208 respectively, including entity-related metadata updates. Those remaining renders and the large-vault host/index interaction need further investigation. Plugin `onload`, index construction and reconciliation counts/times are separately recorded in the JSON; they must not be equated with the process boundary or first usable views.

## Warm results and interaction boundaries

After each completed cold trial, one prose warmup and five measured saved edits produce **four → one Companion renders, three → one Navigator renders and 14 → 5 file enumerations per edit**, consistently at both completed scales. Cumulative synchronous Companion work ranges 29.2–49.2 → 12.0–23.9 ms (100 notes), 163.5–221.5 → 36.1–49.1 ms (1,000). Navigator ranges 35.0–64.6 → 14.1–17.9 ms and 263.0–295.0 → 86.6–162.2 ms. These are comparable panes/workloads; #264's 22-scan all-tools workload is different and must not be substituted as this baseline.

The large warm fixture was first fully indexed with MWC temporarily disabled, then MWC was re-enabled and the setup run discarded. Both measured builds subsequently launch fresh processes against that same persisted host database and identical synthetic source. To reproduce this preparation, disable MWC in the disposable vault, wait for `app.metadataCache.inProgressTaskCount === 0`, re-enable MWC, close Obsidian cleanly, then run the warm driver for each build. This is deliberately excluded from cold-start results.

The separate warm driver measures an already indexed process, one warmup plus five prose and five metadata saves, and five clean/five blur-save native pointer interactions. Each interaction asserts one successful toggle; blur-save also asserts immediate persistence of the original Scene value and exactly one frontmatter call. Click-to-two-animation-frames is a renderer responsiveness proxy, **not physical input-to-photon latency**. Pointerdown-to-frames additionally includes the requested 35 ms hold and CDP round trips. The cold driver's older pointerdown-only samples are retained as raw evidence but are not used as successful-action latency claims.

[All warm samples and representative event traces](measurements/252-warm.json) include both stages at every size. Median click-to-two-frame results (clean / blur-save, before → after): 100 notes **53.9 / 52.4 → 51.6 / 58.7 ms**; 1,000 notes **53.9 / 205.5 → 58.0 / 53.0 ms**. Small-fixture interaction timings do not show a universal speedup and remain sensitive to frame scheduling. All toggles and blur persistence assertions passed. Failed setup attempts, a too-short initial frame polling timeout and the large pre-indexing setup run are excluded; the committed driver polls up to ten seconds for the frame observation.

The fully indexed 10,000-note fixture also gives exactly **4 → 1 Companion, 3 → 1 Navigator, 14 → 5 scans** on every measured prose and metadata edit. Median cumulative synchronous work per prose save: Companion **1,548.1 → 336.9 ms**, Navigator **2,680.8 → 916.7 ms**. Metadata-save medians: Companion **1,557.7 → 345.5 ms**, Navigator **2,640.4 → 910.4 ms**. A single large Navigator render remains a substantial long task; this pass does not claim that large-vault interaction costs are solved.

For the same large fixture, median successful click-to-two-frame observations are **41.0 → 21.7 ms** (clean) and **1,902.9 → 27.0 ms** (blur-save). The blur value verifies the original Scene's save and a successful one-click action, but the frame boundary does not promise that all subsequent reconciliation/render work has completed. The baseline and final runs use the same probe, warmed fixture, sections, click hold and five repetitions. This is distinct from physical input-to-photon latency and from cumulative render time.

## Validation and live safety

Local validation passes: **997 TypeScript tests + 14 script tests**, both TypeScript checks, production build/analysis, bundle/release asset checks, synthetic Codex Press integration, performance and manual-numbering benchmarks, and `git diff --check`. Codex Press assembles identical authoritative order/prose with stale and refreshed reporting numbers, and excludes detached stale snapshots. Final-head Ubuntu/Windows CI results are linked in the PR rather than implying that Linux live UI tests cover Windows.

Unmodified production assets in disposable Obsidian 1.14.4 pass the additional [live safety checks](measurements/252-live-safety.json): explicit Book0 refresh writes only its 26 owned files; an unchanged repeat writes zero; the author-owned series alias survives; an external filesystem move makes both Books stale with zero automatic frontmatter calls; Book2's source note is unchanged; disabling with a queued resolution produces zero late rebuilds; reload preserves the active Scene and stale status; native CSS is loaded and its generated bytes match #264 exactly.

The existing trusted-input blur-save replay also passes **35 pointer cases, 25 keyboard cases, two external-update cases and one injected failure/retry**, plus five uninstrumented pointer cases. These exercise original-Scene targeting, immediate persistence and successful actions in real Electron, with the production bundle hash recorded. They do not establish physical OS focus, IME or Windows UI behavior. Numbering cancellation/concurrent changes/protected files, Trash and preparation Undo remain covered by the automated suite; this pass does not claim a new live Undo/export check. For reproduction, use the disposable fixture marker and commands documented in `docs/first-click-follow-up.md`, including `replay-blur-save.mjs --expect-fixed` and `--uninstrumented --expect-fixed`.

## Remaining work

Keep #252 open. The raw size target remains 669,696 bytes, and the hard ceiling remains 720,896. Further reductions need a maintainable design, not feature deletion, a compatibility-floor increase or fragile minifier tricks. Large cold startup, repeated entity-related Navigator rendering, broader panels/workloads and normal-vault acceptance remain unfinished. Windows CI is distinct from Windows live UI; physical focus/IME, broader themes/plugins, native Bases and live PDF/EPUB exports are not established by these synthetic Linux checks. No version change, release, merge or live-vault deployment is part of this pass.
