# Runtime responsiveness and first-click investigation (#252)

Base: current main `ac0c39b00b85b1d698a1c1dd38ce4218b6370065` (merged #253), verified against GitHub on 11 September 2026. Read #252, its partial-delivery comment, #253 and its changes, CONSTITUTION.md and ARCHITECTURE.md before implementation. The original checkout and its read-only Git directory were preserved; work uses an isolated clone and `fix/252-interaction-responsiveness`.

## Interaction finding: unresolved, not a claimed fix

**No live two-click reproduction was possible.** Chrome is installed, but sandbox process/socket restrictions prevent it from starting (including headless operation). No running Obsidian session was accessible. No private vault or manuscript was read, copied, deployed to or modified. Neither native Obsidian comparison nor isolated-MWC live comparison has been completed. The automated capture tests simulate events and test instrumentation only; they do not establish browser click dispatch or fix the reported defect.

The strongest code-supported hypothesis is target replacement during pane activation. The source confirms synchronous rebuild paths, but does **not** establish when Obsidian delivers `active-leaf-change` relative to pointer-down/up/click on either OS. Actual first actions could be lost, delayed, or successful without prompt feedback. Exactly-once behaviour after a second click remains unverified.

| Path examined | Confirmed code behaviour | What still needs capture |
| --- | --- | --- |
| First press in inactive Companion/Inspector or Manuscript | `src/main.ts` active-leaf handler unconditionally invokes `refreshView()` and `refreshManuscriptNavigator()`. Companion `render()` and Inspector rendering empty their container and recreate controls. | Does activation occur inside a press, removing the original target before click? Check disclosure buttons, context fields, annotation controls, Inspector Open graph and Navigator Create book/scene. |
| Timeline, Graph, Story World Navigator/Review, Continuity Review | Production `src/entry.ts` refresh overrides fan out into these renderers. Its second active-leaf listener refreshes Navigator/Review and Graph. Renderers rebuild their containers. | Which already-open active/inactive views rebuild per activation? Does a first click get dropped even on a small vault? |
| First click after context editing | `EditorialWritingCompanionView` saves multiline fields on blur, and other inputs on change. `updateChapterContextProperty` awaits frontmatter processing; metadata changed can invoke the same refresh fan-out. | Does save/cache settlement replace the next control between press and click? Is focus moved while a field still contains unsaved text? |
| Chapter Notes and annotation/editorial saving | Chapter Note input updates the store and blur flushes pending writes. `flushChapterNote` itself does not call `onChange`. Other store actions await saving and then call `onChange`, wired to refreshes. | Separate note flushing from other save-triggered rebuilds. Measure actual disk settlement and feedback; a synchronous method timer does not time an async save. |
| Relationship editor | Each input/change/focusin recreates datalist options, resolves current candidates and updates Save's disabled state; Save resolves again. Candidate freshness from #251 is intentional. | Focus-update work can delay feedback. Check whether live settlement changes validity on first focus, and whether an in-flight save can be invoked again. Do not remove fresh validation. |
| Selection/propagation | Navigator controls use targeted click/keyboard propagation guards. Timeline map focusin changes emphasis classes without rebuilding the map. Annotation focus retries and POV focus restoration are local paths. | Tab/Enter/Space, pane transitions and return from another app need native comparison. No general MWC first-click interception or blanket overlay was established. |
| Overlays/disabled/stale closures | Tooltips inspected use `pointer-events: none`; dialogs disable relevant controls during writes. Render closures retain the current file/snapshot until replaced. | Inspect the actual hit target, disabled flag and snapshot freshness in a failing sequence; third-party overlays and OS activation cannot be excluded here. |

A disconnected down-target plus no intended action invocation is evidence for loss. A delivered click followed by a long task/event-processing delay and eventual single state transition supports delay. A delivered click with completed action and no expected visual state supports feedback failure. Missing `click` alone is insufficient (disabled controls, cancellation and focus-only window activation also matter). Two `click` records are not two completed actions: verify action counts and final authoritative state. The capture's method counts cover only selected boundaries, not every handler.

## Measurements and accepted optimisation

Node 22.23.1, esbuild 0.23.1; one warmup and five sequential repetitions per size. Durations are informational medians/maxima in ms, not CI thresholds. Both revisions use the same final harness and synthetic metadata. Before measurements were recorded before the source optimisation. Final comparisons reran both the archived baseline and changed source sequentially after validation completed, with no concurrent test/build work. Run-to-run variation remains material.

`benchmark:performance` retains #253's 100/1,000/10,000-note fixture (20% Story World entities). `benchmark:views` adds an actual recognised distributed manuscript: one Book, one Part and 78/798/7,998 Scenes, with valid `manuscript_order_key` values and explicit context links. It executes real manuscript, continuity, Inspector-impact and Graph adapters through a synthetic Obsidian boundary. `TFile`/`TFolder` are minimal host classes; no actual host filesystem or DOM is present. All vault write methods throw. The fixture verifies recognition and absence of manuscript-order diagnostics. This is a deliberately concentrated single-manuscript workload, not a claim about a typical author's vault.

The expanded valid-fixture CPU profile contained 15,189 samples: 2,347 (15.5%) in `normalizePropertyName`, 1,615 in `findAliasedProperty`, 1,096 in GC and 919 in `normalizeBookPropertyName`. This supports removing avoidable canonical-key normalization work. The accepted production change is three added lines in `ChapterContext.ts`: names containing only ASCII `[a-z0-9_]` return unchanged; all others retain the original trim/lowercase/whitespace-and-hyphen conversion. No metadata cache, retained frontmatter, skipped refresh, retry, timeout or event behaviour is introduced. Alias precedence, last matching property spelling, Unicode handling and in-place metadata edits remain covered.

All before/after operation counts match. This change reduces computation per lookup, not authoritative reads or reconciliation. In the large expanded fixture, sampled medians improve 13.8% for settled manuscript rebuilding, 39.4% for Inspector impact and 23.4% for Graph adaptation. Some smaller-fixture stages are slower. The unchanged timeline code also varies, so these samples must not be interpreted as universal speedups or input-to-paint measurements.

### Expanded view-projection measurements

Counts: Markdown enumerations / cache reads / upserts / changed upserts / entity sorts. Counts are identical before/after. Warm projections stay read-free. There are no measured DOM renders or refresh requests in this adapter-only harness.

| Notes | Stage | Counts | Before median / max ms | After median / max ms |
| ---: | --- | --- | ---: | ---: |
| 100 | manuscript-cold | 1/100/0/0/0 | 4.08 / 4.235 | 3.835 / 6.737 |
| 100 | manuscript-warm-10 | 0/0/0/0/0 | 0.005 / 0.015 | 0.006 / 0.026 |
| 100 | manuscript-settled-rebuild | 1/100/0/0/0 | 3.641 / 5.574 | 4.327 / 6.842 |
| 100 | review-cold-with-manuscript | 2/300/0/0/1 | 3.718 / 7.736 | 5.791 / 7.805 |
| 100 | continuity-collection | 0/1250/78/0/0 | 8.963 / 9.765 | 9.134 / 11.276 |
| 100 | inspector-impact | 0/1328/78/0/1 | 11.841 / 14.278 | 10.529 / 11.79 |
| 100 | graph-adapter | 1/1506/78/0/2 | 8.779 / 13.657 | 8.42 / 15.167 |
| 100 | timeline-projection | 0/0/0/0/1 | 0.054 / 0.127 | 0.052 / 0.104 |
| 1000 | manuscript-cold | 1/1000/0/0/0 | 36.409 / 49.482 | 30.984 / 36.903 |
| 1000 | manuscript-warm-10 | 0/0/0/0/0 | 0.007 / 0.01 | 0.007 / 0.011 |
| 1000 | manuscript-settled-rebuild | 1/1000/0/0/0 | 28.795 / 37.928 | 24.314 / 42.262 |
| 1000 | review-cold-with-manuscript | 2/3000/0/0/1 | 23.736 / 34.915 | 23.24 / 49.029 |
| 1000 | continuity-collection | 0/12770/798/0/0 | 43.188 / 46.209 | 32.363 / 60.292 |
| 1000 | inspector-impact | 0/13568/798/0/1 | 55.479 / 59.747 | 45.852 / 56.221 |
| 1000 | graph-adapter | 1/15366/798/0/2 | 62.063 / 69.251 | 50.527 / 56.319 |
| 1000 | timeline-projection | 0/0/0/0/1 | 0.23 / 0.357 | 0.18 / 0.373 |
| 10000 | manuscript-cold | 1/10000/0/0/0 | 264.782 / 401.683 | 222.797 / 280.432 |
| 10000 | manuscript-warm-10 | 0/0/0/0/0 | 0.007 / 0.008 | 0.006 / 0.011 |
| 10000 | manuscript-settled-rebuild | 1/10000/0/0/0 | 251.801 / 408.835 | 216.957 / 221.062 |
| 10000 | review-cold-with-manuscript | 2/30000/0/0/1 | 204.142 / 330.221 | 158.446 / 217.754 |
| 10000 | continuity-collection | 0/127970/7998/0/0 | 392.217 / 530.678 | 316.31 / 371.691 |
| 10000 | inspector-impact | 0/135968/7998/0/1 | 704.719 / 835.546 | 427.312 / 494.207 |
| 10000 | graph-adapter | 1/153966/7998/0/2 | 636.117 / 968.753 | 487.389 / 512.822 |
| 10000 | timeline-projection | 0/0/0/0/1 | 1.232 / 3.637 | 0.551 / 3.275 |

### Existing #253 benchmark comparison

Counts additionally include requested refresh callbacks as the last column component. These are harness callbacks, not measured view render frequency. Startup rows time index lifecycle stages only, not complete plugin startup. The ordinary metadata burst is not an editor or disk-save benchmark.

| Notes | Stage | Before / after counts | Before median / max ms | After median / max ms |
| ---: | --- | --- | ---: | ---: |
| 100 | startup-initial | 1/100/100/20/0/0 | 0.451 / 0.66 | 0.429 / 0.488 |
| 100 | startup-layout | 1/100/100/0/0/1 | 0.245 / 0.825 | 0.236 / 0.407 |
| 100 | metadata-resolved | 1/100/100/0/0/1 | 0.358 / 0.59 | 0.223 / 0.31 |
| 100 | review-cold | 2/300/0/0/1/0 | 3.076 / 4.144 | 2.771 / 3.693 |
| 100 | review-warm-10-consumers | 0/0/0/0/0/0 | 0.006 / 0.01 | 0.006 / 0.009 |
| 100 | unchanged-resolved | 1/100/100/0/0/1 | 0.219 / 0.413 | 0.252 / 0.556 |
| 100 | ordinary-metadata-burst-20 | 0/42/21/0/0/0 | 0.141 / 0.33 | 0.113 / 0.176 |
| 100 | delayed-import | 1/103/102/1/0/2 | 0.262 / 0.464 | 0.256 / 0.327 |
| 100 | relationship-candidates-10 | 0/0/0/0/20/0 | 2.288 / 2.686 | 2.286 / 2.42 |
| 100 | graph-projection | 0/0/0/0/1/0 | 0.383 / 0.5 | 0.414 / 0.527 |
| 100 | timeline-projection | 0/0/0/0/1/0 | 0.041 / 0.055 | 0.044 / 0.066 |
| 1000 | startup-initial | 1/1000/1000/200/0/0 | 3.191 / 3.832 | 2.583 / 5.185 |
| 1000 | startup-layout | 1/1000/1000/0/0/1 | 1.136 / 1.763 | 1.455 / 1.942 |
| 1000 | metadata-resolved | 1/1000/1000/0/0/1 | 1.121 / 2.763 | 1.868 / 3.642 |
| 1000 | review-cold | 2/3000/0/0/1/0 | 20.212 / 27.127 | 19.389 / 23.627 |
| 1000 | review-warm-10-consumers | 0/0/0/0/0/0 | 0.007 / 0.009 | 0.007 / 0.011 |
| 1000 | unchanged-resolved | 1/1000/1000/0/0/1 | 0.983 / 1.395 | 1.01 / 1.807 |
| 1000 | ordinary-metadata-burst-20 | 0/42/21/0/0/0 | 0.105 / 0.196 | 0.089 / 0.194 |
| 1000 | delayed-import | 1/1003/1002/1/0/2 | 0.925 / 1.93 | 1.197 / 2.084 |
| 1000 | relationship-candidates-10 | 0/0/0/0/20/0 | 14.072 / 20.652 | 15.046 / 19.777 |
| 1000 | graph-projection | 0/0/0/0/1/0 | 1.703 / 2.135 | 1.47 / 1.734 |
| 1000 | timeline-projection | 0/0/0/0/1/0 | 0.171 / 0.203 | 0.175 / 0.213 |
| 10000 | startup-initial | 1/10000/10000/2000/0/0 | 26.16 / 40.43 | 21.034 / 25.04 |
| 10000 | startup-layout | 1/10000/10000/0/0/1 | 15.688 / 20.974 | 9.694 / 16.335 |
| 10000 | metadata-resolved | 1/10000/10000/0/0/1 | 9.996 / 20.32 | 11.442 / 13.717 |
| 10000 | review-cold | 2/30000/0/0/1/0 | 147.812 / 172.094 | 100.97 / 110.332 |
| 10000 | review-warm-10-consumers | 0/0/0/0/0/0 | 0.011 / 0.021 | 0.007 / 0.009 |
| 10000 | unchanged-resolved | 1/10000/10000/0/0/1 | 11.104 / 15.269 | 8.686 / 10.053 |
| 10000 | ordinary-metadata-burst-20 | 0/42/21/0/0/0 | 0.113 / 0.184 | 0.108 / 0.146 |
| 10000 | delayed-import | 1/10003/10002/1/0/2 | 9.792 / 17.221 | 9.571 / 9.906 |
| 10000 | relationship-candidates-10 | 0/0/0/0/20/0 | 149.721 / 167.509 | 130.981 / 137.241 |
| 10000 | graph-projection | 0/0/0/0/1/0 | 13.84 / 14.144 | 10.289 / 12.265 |
| 10000 | timeline-projection | 0/0/0/0/1/0 | 1.242 / 3.314 | 1.015 / 1.797 |

### Bundle is a separate result

The before snapshot reproduces #253's **704,913 raw / 195,534 gzip bytes**. After: **704,935 raw / 195,560 gzip** (+22 raw, +26 gzip), leaving **15,961 bytes** below the unchanged **720,896-byte** ceiling. The **669,696-byte** early warning remains intentional. No runtime speed claim relies on bundle size. The headroom target is still missed by 35,239 bytes. Diagnostics, tests and benchmarks are outside the production entry point; version remains 0.18.0.

## Reproduce and capture the missing live evidence

For adapter benchmarks: `npm run benchmark:performance` and `npm run benchmark:views`. To compare the before source, archive `src` **and** `tsconfig.json` at `ac0c39b` into a temporary directory, then run `node scripts/benchmark-performance.mjs --views /path/to/snapshot`. Omit `--views` for the earlier harness. Run stages sequentially with other CPU-intensive work stopped. For CPU attribution use Node's `--cpu-prof` with an output directory outside the repository. `npm run bundle:analyze` measures installed bytes separately.

For an interaction capture (Ubuntu and Windows):

1. Use a disposable synthetic vault or disposable copy. First test MWC alone with Obsidian's default theme, then repeat with the normal plugin/theme combination. Open the views before starting. Note Obsidian/OS/MWC versions and which panes are active; do not include manuscript text.
2. Open developer tools (Ctrl+Shift+I), paste **all** of `scripts/diagnostics/capture-interactions.js`, then run `const capture = startMwcInteractionCapture();`. It installs nothing persistently and does not activate controls or change their event propagation.
3. In each of Companion/Inspector, Manuscript, Timeline, Graph and Review, click one reversible control once after (a) editing a context field and leaving it, (b) switching panes, (c) opening the view, and (d) returning from another application. Include active and inactive panes. Wait two seconds without a second click and note whether the intended result appeared. Then click again and check whether the action happens once or twice. Repeat using Tab plus Enter/Space. Check saved values after settlement/reopening.
4. Repeat the same focus transitions with native File Explorer disclosures or a native Settings checkbox. Keep one capture short (one sequence, ideally under 15 seconds); repeat with only one MWC pane and with multiple panes open.
5. Run `copy(JSON.stringify(capture.stop()))` and retain the anonymous JSON plus a short expected/observed description. Check `dropped === 0`. `stop()` removes listeners, observers, wrappers and pending frame callbacks. Re-paste/start for a new capture. If controls still fail after stop, record that too.
6. For a repeatable failing sequence, also record the DevTools Performance timeline with screenshots **disabled**. Inspect event dispatch, scripting, rendering and paint around the first press, and use a click event-listener breakpoint to verify the intended handler is reached. Inspect that control's state or the authoritative result to establish action completion, then repeat uninstrumented. Share anonymous capture data first; raw profiles can contain file paths and must be reviewed locally before sharing.

The capture records anonymous node/pane IDs, active-pane state, input/change/focus/pointer events, DOM child-change counts, selected method counts/synchronous durations, workspace/metadata events, long tasks and Event Timing where supported. It reads no text, input values, labels, paths, event key values, method arguments or return values. Calls nested inside another call must **not** be summed as disjoint work. Vault enumeration counts include native and other-plugin calls. Methods returning promises retain their original identity and rejection behaviour: their recorded time is synchronous execution only, not async settlement. Opening a new view after capture begins can miss its initial render; attach before the sequence and use DevTools for complete startup.

`next-frame-opportunity` is a scheduling bound after dispatch, **not** measured input-to-visible-response latency or proof of paint. Event Timing is quantized and omits events below its threshold; absent entries do not prove zero latency. Mutation observation covers child-list changes, not every CSS/canvas update. The tool is opt-in, bounded to 5,000 trace records, aggregates high-frequency method calls and has no production overhead while absent. Its own runtime overhead and real Obsidian compatibility remain to be measured; timings with it enabled need an uninstrumented comparison.

## Remaining work ranked by user impact

1. **Potential first-action loss on pane activation/save settlement**: high impact, not confirmed. Obtain the press/blur/refresh/click sequence above; fix target lifetime/focus behaviour with a real interaction regression and exactly-once checks. Native/application/third-party interaction remains possible.
2. **Large-manuscript synchronous projections and rebuild fan-out**: confirmed synthetic cost, still hundreds of ms for Inspector/Graph and manuscript rebuilding. Profile actual DOM, major-view combinations and the number of duplicate projections per metadata batch before changing invalidation. Preserve index convergence and fresh relationship validation.
3. **Cold review/metadata settlement**: full settled reconciliation and cold reviews still scan; warm reads and unchanged per-file bursts are bounded. Measure complete startup, real save completion and settled batch total work.
4. **Relationship-form focus work and remaining DOM work**: repeated suggestions/resolution and Graph centre scans are visible in code. Pure timeline projection timings omit assertions, maps and DOM and should not be used to dismiss view costs.
5. **Bundle headroom**: a separate maintenance constraint; the 50 KiB target remains outstanding.

## Validation and scope

Local full tests, both TypeScript checks, production build, bundle analysis, `release:check` and `git diff --check` passed. Test TypeScript configuration now includes benchmark sources. Added coverage checks canonical/noncanonical normalization, alias precedence and fresh in-place edits; diagnostics preserve method `this`, arguments, return/promise identity, errors and exactly-one forwarding, anonymization, bounded storage and cleanup; a synthetic adapter test verifies manuscript recognition and operation counts. These are **not** browser regression tests for the user's two-click sequence.

Ubuntu/Windows CI results are recorded on the PR. Live Obsidian acceptance, input-to-visible-response latency, view refresh frequency/duration, full startup/editor/storage timings and the bundle headroom target remain outstanding. **Keep #252 open.** No merge, version change or release is part of this work. The implementation preserves Constitution Articles I–III, VI–IX: Markdown/YAML and the editorial store retain authority, derived data remains disposable, and event, keyboard, save and convergence paths are unchanged.
