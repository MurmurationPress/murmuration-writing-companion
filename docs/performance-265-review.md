# PR #265 review correction

Review started at `bbe474a455f1634c4124826633fc40cee3749855`. Its 682,307 raw / 193,386 gzip JavaScript and 746,139 total raw installed bytes reproduce exactly. The original measurements remain historical evidence in [the implementation report](performance-252-startup-renders.md).

## Finding and correction

The unchanged-result shortcut missed a dependency: a cached Story World review can change when an explicit link starts/stops resolving to a plain note or attachment, even though source metadata and the entity index are unchanged. In particular, an unresolved `world_sources` reference should disappear when its plain target becomes available. The new regression fails on the reported head.

The collector now records reference/source/resolution tuples actually used by the cached review. At settled reconciliation it compares those destinations, including indexed/excluded status, and invalidates changed evidence. This also detects late host resolution without assuming that a note's creation callback carries complete metadata. It adds no file enumeration and no work to the editor-change handler. Dependency memory and resolution lookups scale with references used by the cached review; closed, unbuilt reviews have none. Source/target changes still use Markdown and the host's resolver as authority.

Production correction commits: `b8877c3cddb800bd0db34b31cc040cb8f24dab7f` and `23c5db77fc6ce79b9d79ca12a11ff7eedbd8cc9c`. The extra safety code adds 350 raw / 101 gzip bytes over the reported PR head.

A second live check showed that repainting Continuity Review did not recollect its retained collection after late resolved evidence. The changed-consumer path now queues recollection, coalescing with its existing pending refresh, and guards that callback on unload. In disposable Obsidian the underlying review and visible collection both converge after a resolver change delivered only through `resolved`; before the correction the collection stayed stale.

| Asset | #264 baseline raw / gzip | Corrected raw / gzip |
| --- | --- | --- |
| main.js | 685,795 / 193,821 | 682,657 / 193,487 |
| styles.css | 63,555 / 10,217 | 63,555 / 10,217 |
| manifest.json | 277 / 185 | 277 / 185 |
| Total | 749,627 / 204,223 | 746,489 / 203,889 |

Genuine total reduction: **3,138 raw / 334 summed gzip bytes**. CSS is byte-identical. Headroom: **38,239 bytes**; gap to the unchanged 669,696-byte target: **12,961 bytes**. The 720,896-byte hard ceiling and warning are preserved.

## Representative reproduction

The review repeats the committed drivers serially, with no simultaneous local build/test workload. Environment and timing boundaries are unchanged. A temporary extension to the cold driver asserts the fully settled index contains **3 Books, 792 Scenes and 200 entities**, zero unresolved notes, preserved `B0S000.md` context and zero frontmatter writes. This explicitly tests completeness rather than inferring it from visible controls.

One fresh-profile 1,000-note review trial per build measured **32.525 s** for #264, **5.317 s** for the originally reported implementation, and **5.910 s** for the reference-cache correction, and **5.301 s** for the final production build including collection recollection. All completion assertions pass. These are representative reruns, not a replacement statistical range for the original three-trial 31.9–57.5 → 5.0–5.2 s report. Fresh profiles load application 1.13.7; warm comparisons separately use application 1.14.4 and record the actual title. OS caches remain warm, GPU is disabled, and process time includes host boot/trust plus the settling buffer.

The 10,000-note cold trials remain **incomplete**. Neither their elapsed windows nor partial work counts establish improvement, equivalence or complete-index correctness. Large cold startup remains open.

The independent warm rerun uses one warmup and five measured prose saves plus five metadata saves in the same already-indexed 1,000-note fixture, application 1.14.4 on both builds. Every sample reproduces **14 → 5 scans, 4 → 1 Companion renders, 3 → 1 Navigator renders**. Median cumulative prose rendering is **169.5 → 36.7 ms** (Companion) and **270.4 → 89.5 ms** (Navigator). Metadata medians are **177.5 → 38.3 ms** and **289.9 → 93.6 ms**. Native successful click-to-two-frame medians are **41.8 → 46.8 ms** clean and **223.1 → 48.5 ms** blur-save. These remain renderer proxies, not physical input latency or completion of subsequent reconciliation.

[Review measurements](measurements/265-review.json) retain the complete counts/timings for these representative reruns; the original large warm results were audited but were not remeasured after the correctness fix. No large cold result is treated as a comparison.

## Validation scope

The corrected regression covers target appearance, disappearance, attachment destinations, Trash exclusion, late resolution and unchanged-cache reuse without writes. **998 TypeScript tests + 14 script tests**, both type checks, production analysis/build, release/package/bundle checks, synthetic Codex Press integration and performance/numbering benchmarks pass. The complete automated suite also retains native interaction, scene-specific draft, numbering cancellation/concurrency/protection, Trash, preparation Undo and compiler contracts. Final-head CI and post-merge results are recorded in the PR review and #252 update.

Disposable Linux Obsidian checks reproduce the plain-target cache failure and retained-collection failure before their respective fixes and verify convergence afterward. They also check zero-write repeated numbering, external cross-Book stale status with zero automatic writes, alias preservation, initial/reload context, queued reconciliation cancellation and native stylesheet loading. The reference-cache correction passes the full 35-pointer/25-keyboard blur replay, including original-Scene targeting, external changes and failure/retry. After the collection correction, the final production build passes 30 first-click cases (Companion, Navigator and native controls) and five blur cases in a freshly launched host with no diagnostic wrappers. The native replay cases are correctness checks, not additional timing comparisons. Preparation Undo and protected/cancelled/concurrent numbering remain automated coverage rather than newly claimed live tests.

The bundle gap, large-vault cold startup, expensive remaining Navigator renders, entity-related startup invalidations and wider normal-vault acceptance remain open. Linux synthetic checks do not establish Windows live UI, physical multi-window focus/IME, arbitrary themes/plugins, native Bases or live PDF/EPUB exports. No budget/version change, release or live-vault deployment is part of this review.
