# Post-#263 performance and headroom (#252)

This is a partial delivery of #252, not a closing reference. It preserves #258's native gesture/blur-save implementation and #263's manual numbering writer. No preparation, persistence, numbering, selection or interaction-queue implementation is changed. No private manuscript was read or copied.

## Baseline and build conditions

Baseline: main **46e8c4cb2bf3177711bfb4839370cecbcbb8fc62**. No applicable AGENTS.md was found in the checkout or ancestor directories. The updated issue and comments were read before selecting changes. Work used an isolated branch/worktree; the original checkout remained untouched.

Local sizes use Linux, Node **24.19.0**, esbuild **0.23.1**, `npm ci`, the committed lockfile, `src/entry.ts`, minified CommonJS, ES2018, with `obsidian` and `node:*` external. Historical comparisons include `src`, `tsconfig.json`, `styles.css` and `manifest.json`, not an incomplete source archive. Sizes are byte lengths of deterministic build outputs; gzip is Node's gzip of each individual installed asset. Combined gzip is the sum of those files, not an invented compressed delivery format.

The baseline reproduces **734,545 raw / 205,236 gzip bytes**. Its actual configured ceiling was **737,280** after #261; the reported 2,735-byte headroom was correct only against that ceiling. It exceeded the user's requested 720,896 ceiling by 13,649 bytes. Neither the inferred 718,161 baseline nor the phrase “unchanged 720,896 ceiling” describes the #263 tree.

The complete #201 source snapshot (`6f74f1149c047722ac9375b36134da0fd545cf70`) again reproduces **612,890 raw / 167,592 gzip** with the same toolchain. Growth to #263 is 121,655 raw bytes, incorporating preparation, restoration, first-click reliability, reporting snapshots and other feature work. The earlier #253 investigation explains the 2,279-byte error caused by omitting historical tsconfig.json; it is not a dependency regression.

## Accepted changes and byte accounting

| Cumulative change | main.js raw | main.js gzip | Raw change |
|---|---:|---:|---:|
| Baseline #263 | 734,545 | 205,236 | — |
| Remove obsolete Move-tooltip observer | 733,799 | 204,959 | −746 |
| Reuse settled library for Companion chronology | 733,831 | 204,961 | +32 |
| Retain sorted entity list until index changes | 734,018 | 205,009 | +187 |
| Package static CSS in native stylesheet | 685,795 | 193,821 | −48,223 |

The restored ceiling is **720,896**, with **35,101 bytes headroom**. The original **669,696 target is still missed by 16,099 bytes**. The early warning remains active. No useful feature or safeguard was removed, and no dependency/version/release change was made.

The JavaScript reduction is **48,750 bytes**, but most is static CSS relocation. The new stylesheet is **63,555 raw / 10,217 gzip** bytes, versus 19,731 raw before. Including the unchanged 277-byte manifest, total installed raw assets fall from **754,553 to 749,627**, a genuine **4,926-byte** reduction. No lazy JavaScript chunk, unreported sidecar or runtime network fetch is used. The release asset list already contains main.js, styles.css and manifest.json; build/dev now generate both code and native CSS, and release validation checks stylesheet freshness.

The stylesheet preserves base-then-installation order and every feature selector. Obsidian owns stylesheet loading/removal and popout propagation. User snippets now participate in the native plugin cascade; this is explicitly not a promise about every third-party theme combination.

## Composition and rejected alternatives

No bundled `node_modules`, test, benchmark or diagnostic input was found. Repeated external Obsidian requires are not multiple bundled copies of Obsidian. Esbuild already removes unused exports; the largest remaining contributors are product code, not instrumentation. Main, Navigator, entry coordination, Story World Review/Graph, Companion, entity creation and Continuity Review dominate the report.

The obsolete observer searched every added DOM subtree for Navigator buttons whose `aria-label` began with “Move ”. Navigator movement now uses native Menu items, so those buttons no longer exist. Removing the observer eliminates real DOM work without removing movement or accessibility labels.

An ES2020 build experiment measured 711,865 raw / 196,982 gzip before the accepted changes, saving 22,680 raw bytes. It was **not adopted**: the plugin advertises mobile support and Obsidian 1.5.0; this session did not establish the oldest supported iOS/WebView syntax floor. The ES2018 target and manifest minimum are preserved. Broad View/Review rewrites or folding superficially similar metadata parsers together could change distinct ambiguity/authoring contracts; no evidence justified taking those risks to recover the remaining 16,099 bytes. A higher ceiling or lower target is not proposed.

## Runtime methodology

Synthetic fixtures contain exactly 100, 1,000 and 10,000 Markdown files; three Books, three Parts, respectively 72/792/7,992 Scenes, and 20/200/2,000 Story World entities, plus two control notes. Direct Scenes and Part children are interleaved in authoring; authoritative root/sibling order remains explicit. Entities include Characters, Locations and Events, aliases, explicit relationships and supported point/range times. Scene dates exercise chronology. No private names or prose are included.

`profile-runtime.mjs` runs the real compiled plugin in disposable Linux Obsidian/Electron, not a DOM mock. It refuses an unmarked/different vault, additional community plugins or duplicate startup. A warm plugin reload is measured separately from cold application launch. Each remaining stage uses one warmup and five repetitions; manual renumbering also retains the initial writing run. Tool panes are open for saved prose, metadata, entity changes and view refresh stages. They are closed for manual renumbering so the writer's verification and host indexing are separately observable. The editor/status remain available. Prose is changed through the real vault API, not a claim of key-to-paint latency.

Counters wrap actual methods and are restored after each sample. They distinguish scans, cache reads, library/index rebuilds, actual view renders, refresh requests, freshness and explicit writes. Method times are synchronous and nested; they must not be summed into end-to-end latency. Settled wall time includes deliberate quiet-window waits. Host scheduling can vary event batches, especially at 10,000 notes; the evidence retains each sample and reports ranges rather than hiding variance.

The isolated Node benchmarks additionally compare actual index sorts (not merely getAll calls), Story World startup/settlement, graph/timeline projections and ten chronology consumers against archived baseline source. These are cached synthetic adapters without DOM or disk; their timings are not Obsidian editor latency. One warmup and five measured runs use the same process configuration per revision. Builds/tests are not run concurrently with measurements.

## Reproduce

```sh
npm ci
npm test
npm run bundle:analyze
npm run bundle:report
npm run release:check
npm run benchmark:performance
node scripts/benchmark-chronology.mjs
node scripts/benchmark-numbering.mjs
node scripts/validate-manual-numbering-compiler.mjs ../codex-press
```

For historical comparison, archive src, tsconfig.json, styles.css and manifest.json from the desired commit. Pass that root to `scripts/report-bundle.mjs`, `scripts/benchmark-performance.mjs` and `scripts/benchmark-chronology.mjs`. The current build toolchain is deliberately used for both sources.

Create a **new** disposable directory with `node scripts/diagnostics/create-performance-fixture.mjs /absolute/new/path 100` (or 1000/10000). Copy the three compiled assets only into that vault, enable MWC alone, and launch a separate Obsidian profile with local debugging port 19347. Run `node scripts/diagnostics/profile-runtime.mjs /absolute/disposable/vault`. Restore identical fixture Markdown and the same pane/settings state before switching builds. Do not use these mutating scripts on an author vault.

## Remaining umbrella work

The headroom target remains unmet. Cold application startup, normal-vault acceptance, Windows live UI/application-focus, physical multi-window/IME workflows and third-party plugin/theme combinations remain separate from Linux synthetic checks and Windows CI. Repeated Companion/Navigator renders and expensive large-vault projections are measured, not claimed solved. Native CSS packaging reduces main.js size more than total installed size. Keep #252 open.
