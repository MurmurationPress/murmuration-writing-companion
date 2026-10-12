# MWC 0.19.0 release readiness

Prepared on 12 October 2026 from reviewed main `eb25238e56a39987444cc5c108b909e5f45919fb`. This is a release-preparation proposal, not a published release. Production functionality and dependencies are unchanged. The original checkout remains clean on its existing branch; preparation and qualification use `release/0.19.0` in an isolated worktree.

## Version and scope

**0.19.0** is appropriate for the accumulated changes since published 0.18.0, including author-facing manuscript preparation, explicit numbering and Story World changes alongside performance/stability fixes. Package, lockfile root metadata, manifest and `versions.json` agree. Obsidian 1.5.0 remains the declared minimum; that minimum is not freshly native-qualified by this pass.

- **#256:** coalesce pending numbering requests and cancel queued/late mutations on unload.
- **#258:** protect original first clicks and keyboard focus through pane activation and blur saves; preserve drafts and explicit failed-save retry.
- **#266:** batch cold Navigator display updates, cache date formatting and reuse display projections; mutation reads retain fresh authority.
- **#267:** extract dataset charts/state tables into standalone Reports and retain two invocation-time command aliases.
- **#268:** audit the extraction boundary, hand off documentation to published Reports 0.1.0 and strengthen bridge regressions.

Manuscript-aware reporting, Companion, Navigator, Git and Codex Press integration remain present. No vault migration, automatic dataset regeneration, hotkey edit, settings cleanup or output deletion is introduced. Both deprecated aliases remain in **0.19.0**; removal is proposed for **0.20.0**, the immediately following release. Release scheduling must honour that sequence. [Release notes](../RELEASE_NOTES.md) contain full hotkey mappings and installation instructions. Reports 0.1.0 is already published, satisfying release ordering.

## Automated qualification

`npm ci`, all **986 TypeScript and 15 script tests**, production/test type checks, production build, `release:check` and whitespace checks pass. Synthetic performance, numbering and chronology benchmarks pass their deterministic count assertions. Codex Press integration confirms identical manuscript assembly with stale/refreshed reporting and exclusion of detached snapshots. Synthetic PDF/EPUB/DOCX exports include saved SVG/table assets with no plugins loaded, cover Unicode/spaces and missing assets, and preserve sources/assets/receipts. This export toolchain check is distinct from native Codex Press UI acceptance.

Exact-head Ubuntu and Windows CI status is recorded on the release PR after pushing. Windows CI is automated build/test/package validation, not Windows native interaction acceptance. No appropriate native Windows environment is available on this Linux host.

`npm audit --omit=dev` reports no production vulnerabilities. Existing moderate entries are esbuild and Moment through the development Obsidian SDK; esbuild's development-server advisory is not a shipped server, and the SDK/Moment packages are external rather than bundled. This does not certify the host's Moment version. The lockfile changes only version metadata; no dependency upgrades are included.

## Native Linux qualification

Only disposable `/tmp` vaults/profiles were opened; no author vault was installed into or modified. Evidence in [qualification/0.19.0](qualification/0.19.0/) identifies user agents, bundle hashes and synthetic paths.

- Linux Obsidian **1.13.7**: reviewed untyped-manuscript root selection, explicit preparation, preservation of prose/aliases/unrelated properties and exact-byte Undo pass.
- Linux Obsidian **1.14.4**: Book-scoped explicit numbering, idempotent repeat, authored alias preservation, external cross-Book move without automatic writes, stale status/reload context, unload cancellation, native stylesheet loading and late plain-target review convergence pass.
- Linux Obsidian **1.13.7**, published Reports bundle: all **15** reporting checks pass, including standalone generation, adoption/cancellation/consent expiry, write-boundary changes, unload/re-enable coordination, either loading order, absent Reports, definition moves/repair, both-disabled saved embeds and disabled restart source/asset preservation.
- Linux Obsidian **1.14.4**: **35/35** blur pointer, **25/25** keyboard (10 summary, 5 Title, 10 compact Enter), **30/30** first-click and **5/5** uninstrumented blur cases pass. Clean/dirty external updates and injected failed-save draft retention/explicit retry pass. The final diagnostic retains the initial 600 ms observation and adds a bounded read-only wait; all **10/10** affected compact Enter cases pass again. Trusted Chromium input is genuine application interaction; it does not establish physical OS focus switching, multi-window or IME behaviour.

### Diagnostic harness corrections

The former assertion queried the first global `.markdown-preview-view` after 700 ms, which could belong to a nested or inactive preview. The corrected diagnostic targets the `Book/Report.md` workspace leaf, uses a bounded 10-second poll, allows lazy preview content to render, and requires saved table text plus a completely loaded SVG image with nonzero natural width. Plugin generation is never invoked by the preview assertion.

Apply [reports-preview-harness.patch](qualification/0.19.0/reports-preview-harness.patch) in a disposable checkout of Reports tag `0.1.0`; it modifies only the manual diagnostic script. Copy the published release assets into that checkout and run `node scripts/verify-live.mjs /path/to/built/MWC`. The original Reports repository and plugin assets are untouched. This patched full run passes both-disabled display and restart; the earlier failure was a selector harness defect.

The compact Enter replay also exposed a fixed 600 ms assumption: the save ran once and the editor subsequently closed with correct focus and metadata. The diagnostic now polls those three semantic outcomes for at most five seconds, records settlement wait time, and retains the original assertions. It never repeats the key, saves again or changes application state to force success. Initial fixture/title mismatch attempts and the fixed-delay failure are diagnostic attempts, not passing qualification. Final replay results are reported separately.

## Performance evidence and boundaries

The current numbering benchmark covers three Books at 30/300/1,000 Scenes per Book, five repeats after warmup. All ordinary-operation stages perform **zero automatic regeneration passes, write attempts and metadata writes**. Explicit native Book0 numbering writes **26 files** once and **zero** on repeat in the 100-note fixture. The historical #256 adversarial 1,000-scene backlog fell from **11 passes/11,000 writes to 2 passes/2,000 writes**; it predates the switch to explicit numbering and is not a current automatic-edit count. These synthetic counts are not disk/DOM timing measurements.

Verified archived #266 warmed 10,000-note results retain **1 Companion/1 Navigator render**, with Markdown scans **5 → 2**. Comparable prose render medians are **348.0 → 148.2 ms** (Companion) and **957.5 → 319.6 ms** (Navigator). Earlier #258 reduced enumerations **202 → 19**; its 23.4 → 21.2 ms continuation does not establish a meaningful speedup. See [the original report](performance-252-cold-render.md) and its full recorded samples. Since that extraction baseline, production source changes are limited to dataset removal and the command bridge/main registration; the profiling implementations remain unchanged.

Verified archived fresh-profile 10,000-note cold trials complete in **94.808/97.922 seconds**, asserting 3 Books, 7,992 Scenes, 2,000 entities, preserved context, zero unresolved structure and zero frontmatter writes. Baselines remained incomplete at five minutes; no speedup ratio is valid. Host-only controls take 24.7/24.8 seconds; material startup overhead remains. A fresh 100-note candidate run settles in **4.858 seconds**, with complete indexes and zero writes. Different scales/profiles are not a speedup comparison. OS caches are not flushed; diagnostics disable GPU and use 200 ms polling.

## Production assets

Node 24.19.0 / esbuild 0.23.1, committed lockfile, unchanged ES2018/minification policy. Both aliases are included. Built JS SHA-256 remains `c9075b64c8072ceece140ceb482ee765a9fee2c376c471c799cc7e5159d22604`, byte-identical to reviewed main.

| Asset | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| JavaScript | 667,724 | 188,600 |
| Styles | 63,555 | 10,217 |
| Manifest | 277 | 185 |
| Installed total | 731,556 | 199,002 |

Hard ceiling **720,896**; headroom **53,172**. Warning/target **669,696**; margin **1,972**. Extraction saves **14,580 raw/4,778 gzip JS bytes** against #266; release metadata/docs save zero JS bytes. Residual bridge cost is the previously measured **746 raw/288 gzip bytes** in a disposable counterfactual, not new removal in this PR. Reports' separate bundle is not a combined installation-size saving.

## Publication decision and outstanding work

Available automated, export and documented Linux synthetic qualification supports review of this release candidate. **Publication should await native Windows acceptance and wider Linux acceptance sign-off**; CI cannot replace them. No material product defect was found in these checks. The release preparation does not close #252 or claim every performance/interaction case qualified.

Keep **#252 open** for large cold-start overhead, partial reconciliation, full-book review projections (~241 ms across two calls in archived profiling), large DOM/layout cost, broader Graph/Timeline/Review workloads and scale/theme/plugin acceptance. The bundle-headroom subtarget is met. Remaining native acceptance includes ordinary Linux/Windows plugin/theme combinations, application switching, first-click persistence, keyboard, multi-window/IME and native Bases/compiler workflows. The declared minimum Obsidian version and mobile compatibility are not newly qualified here; no support expansion is made.

Windows follow-up: build this exact candidate, install all three assets only into a disposable synthetic vault, exercise preparation/Undo, Companion/Navigator pointer and keyboard controls, clean/dirty external refresh and failed-save retry, application switching, plugin disable/re-enable, both reporting aliases with Reports present/absent, and native Codex Press exports where configured. Record OS/Obsidian versions, bundle hash, first-action counts, original-scene persistence and preserved source/asset hashes. Linux ordinary-theme/plugin and physical-input acceptance uses the same matrix.

The existing SDK limitation remains: Obsidian provides no crash-atomic multi-file transaction guarantee. Conditional mutation checks, write verification and recoverable compensation protect ordinary failures but cannot revoke committed host writes or guarantee atomic output/receipt persistence. Neither this release nor CI changes that contract.

## Reproduction

```sh
npm ci
npm test
npm run build
npm run release:check
npm run bundle:report
node scripts/benchmark-performance.mjs
node scripts/benchmark-numbering.mjs
node scripts/benchmark-chronology.mjs
node scripts/validate-manual-numbering-compiler.mjs /path/to/codex-press
MWC_PROFILE_SIZES=100 MWC_PROFILE_REPEATS=1 node scripts/diagnostics/profile-cold-complete.mjs "$PWD" /tmp/cold.json
```

The cold report supplies a new marked fixture root. `verify-performance-safety.mjs` accepts only that disposable root. Native interaction replay uses the separately documented first-click fixture: restore its titles and select Book0 before replay, then reload MWC to settle initial projections. See [blur reproduction](blur-save-follow-up.md) and [cold/render methodology](performance-252-cold-render.md). Do not run build/tests concurrently with timings. Archived comparisons are explicitly labelled; complete native Windows qualification is pending.
