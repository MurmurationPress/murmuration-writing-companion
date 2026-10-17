# MWC 0.20.0 release qualification

Release preparation only: do not merge, tag or publish until independent review and explicit publication approval. Feature scope is frozen. Ted accepted Reading-view annotations, the notification preference and Annotation Board; #241 remains backlog and #252 remains ongoing maintenance.

## Audit since published 0.19.0

Published `0.19.0` tag commit `00c6ae80c592c695da62fd4b94fa65a4a50c2270` contains the one-release Reports compatibility bridge and assets of 667,724 raw / 188,600 gzip JavaScript bytes. Exactly three commits were merged between that tag and preparation base `d395886c22f53b61993826e9f772ad2f50b5c955`:

| PR | Merged commit | Release effect |
| --- | --- | --- |
| #271 | `e2ed914` | Exact source occurrences and editorial PDF/shared export-anchor evidence. |
| #272 | `67c3f8f` | Reading-view annotations, original-note capture, safe source mapping/navigation and vault-local mismatch-notification preference. |
| #273 | `d395886` | Book-scoped Annotation Board and shared store/card concurrency, identity, retry and popout repairs. |

No other merged changes occur in `0.19.0..d395886`. This preparation removes the promised two aliases and their bridge/tests, updates version metadata/documentation, and strengthens asset packaging. Qualification also found and repaired cached Reading-section navigation after frontmatter-only changes. It adds no feature, dependency or schema migration. Manuscript-aware commands remain; no user hotkey files or generated assets are changed. Constitution Articles I–III, VII and IX govern integrity and qualification.

## Reused reviewed feature evidence

- [#271 export/source evidence](https://github.com/MurmurationPress/murmuration-writing-companion/pull/271).
- [#272 final review](https://github.com/MurmurationPress/murmuration-writing-companion/blob/03bd773bdc9374eec07cfc2f44d75944121c29c3/docs/validation/issues-270-259-review.md).
- [#273 final review](validation/issue-254-review.md) and [native evidence](validation/issue-254-review-native.json): repaired races, rollback/retry, identities, reading navigation, 1,000-card refresh costs, Linux popout and separately identified X11 injected pointer/keyboard checks.
- [Published 0.19.0 qualification](release-readiness-0.19.0.md) remains historical evidence; its met headroom target is superseded by this larger annotation release.

Release-specific results, candidate SHA, checksums and exact-head Ubuntu/Windows CI are recorded below and in the release-preparation PR. Do not interpret historical feature runs as checks of changed release code.

## Qualification results

Local qualification passes **1,025 TypeScript tests + 16 build/tool tests**, both typechecks, production build, release checks, bundle analysis/report and whitespace checks. Seven obsolete bridge tests were removed with the bridge; release-transition, checksum and cached-Reading regressions replace the applicable coverage. A deliberately modified disposable `main.js` was rejected as stale by `release:check`, then restored; deterministic production checksums are recorded below. Node 24.19.0 / esbuild 0.23.1 locally; CI uses Node 22.

The checked-in native replay uses only newly allocated synthetic vaults and profiles, installs downloaded 0.19.0/Reports 0.1.0 assets, seeds existing records using 0.19.0 itself, then replaces all three assets with the candidate. Clean install and upgrade are separate scenarios. Native automation is CDP DOM/application commands and Chromium text input, not physical hardware or assistive-technology acceptance.

**62/62 native assertions pass: 29 clean-install and 33 upgrade.** Exact candidate CI links are recorded in the PR; committed replay evidence is [qualification/0.20.0/native.json](qualification/0.20.0/native.json). Passed runs use native Linux X11 Obsidian 1.13.7 / Electron 43.3.0. The replay exercises Reading selection and Chromium typing, one editor activation/body focus, category selection, editing, resolve/reopen, Book isolation/Part filtering, second duplicate navigation retaining the Board, unchanged export-anchor evidence, restart persistence and Reports enable/disable. Reports starts genuinely absent; published Reports assets are installed only before its command-availability test. Report generation/export itself reuses published Reports qualification; this is a command-removal/coexistence check, not a new full Reports export qualification.

Upgrade checks use actual 0.19.0 to create open/resolved annotations, Chapter Notes and pass history. The candidate must load the portable store without byte changes on startup, then preserve records on restart. Every synthetic Markdown/SVG/definition/embed file is compared before/after; only established annotation-count lines are excluded from manuscript comparison. The hotkey file stays byte-identical, no second annotation store/notes appear, and Reports enable/disable causes no store/manuscript/generated-file changes. Obsidian's own workspace/config/cache writes are outside this manuscript comparison.

Diagnostic attempts initially exposed renderer-import and owned-window-focus assumptions; the old published API also generates its own annotation IDs, which the first harness assertion incorrectly assumed it could supply. Those are corrected diagnostic failures, not passing checks. The cached-source navigation failure below was a product defect, reproduced with a five-second read-only observation window, and repaired before final qualification.

## Release blocker repaired

Native clean-install qualification exposed a cached-preview defect: count updates changed frontmatter, but Obsidian reused prose sections registered against the previous full source snapshot. Navigation preserved Reading mode but could not reveal the selected occurrence. The repair translates cached offsets only when the **entire Markdown body is identical**, checks the original section and rendered projection, and retains strict rejection of changed bodies and foreign notes. It never searches for an extract. Comparisons are cached per snapshot within a reveal, rather than repeated per paragraph. A regression covers frontmatter insertion, removal and count changes, second duplicate identity and rejection after prose changes. Stored anchors and manuscript files are unchanged by navigation.

## Bundle policy

| Asset | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| main.js | 700,358 | 198,568 |
| styles.css | 64,472 | 10,381 |
| manifest.json | 277 | 185 |
| Installed total | 765,107 | 209,134 |

Gzip total sums individual assets. Against merged #273, JavaScript saves 507 raw / 178 gzip bytes. Against published 0.19.0, JavaScript grows 32,634 raw / 9,968 gzip bytes; total assets grow 33,551 raw / 10,132 gzip bytes. No code was shifted into another runtime dependency.

Hard ceiling **720,896**, remaining headroom **20,538**. Warning/target maximum **669,696**, target headroom **51,200**, reduction still needed **30,662**. Warning and ceiling are unchanged and enforced. **#252 remains open** for the unmet headroom target and remaining startup/reconciliation/projection/layout/platform work; this warning is not hidden to qualify a release.

### Deterministic SHA-256 inventory

```text
c29668f7d30c1a7c2cfc2c880b19638fc906b36983468e3ac6f8cb2a01690b94  main.js
4596085c1c8278720d19409966d3c9846061d83f62b9b045430601956d752c32  manifest.json
0aed98aac8c86dc4be0cef3542a5f8b752b28fbaea9c834987c46c14ec6dc316  styles.css
```

## Packaging and publication proposal

Build all assets from one exact commit with the committed lockfile. `release:check` verifies version declarations and the versions map, compares JavaScript with a fresh production build and CSS with the source build, enforces the existing budget, and rejects source maps/build analysis artefacts. `release:checksums` emits deterministic SHA-256 lines for the three required assets in fixed order. Both CI platforms upload exact-commit candidate assets and `SHA256SUMS` for independent review.

After independent approval: merge the preparation PR; verify the merge tree equals the candidate tree; require Ubuntu/Windows CI on that merge; tag that exact merge **`0.20.0`** (no `v` prefix). Push the tag only with publication authorisation. The tag workflow checks manifest/tag equality, uses `npm ci`, runs tests/build/release checks, produces SHA256SUMS and publishes the three assets together with RELEASE_NOTES.md. `--verify-tag` prevents implicit tag creation and `--latest` marks the stable release. Download published assets, compare checksums and perform a final disposable-vault smoke before announcing availability. A PR workflow SHA may be GitHub's synthetic merge; candidate branch push CI records the actual head, and source equality is checked independently.

## Remaining limitations and blockers

Independent review and publication authorisation are pending. Do not tag or publish from this branch. No live-vault installation has been performed.

Native coverage is Linux only. Windows CI is not native Windows Obsidian acceptance; macOS/mobile, declared minimum 1.5.0, older hosts, screen readers, touch and broader themes/plugins are not newly qualified. Prior Linux popout coverage uses DOM/commands; physical multi-window/IME is unverified. The Board has no automatic offscreen drag edge scroll. Reading selections in unsupported rendered blocks must be reselected as ordinary prose or annotated in edit mode. Stale ambiguous navigation explains original-position approximation. Obsidian does not offer crash-atomic multi-file transactions. These established limits remain visible; no support expansion is claimed.

## Reproduction

```sh
npm ci
npm test
npx tsc -p tsconfig.tests.json --noEmit --skipLibCheck
npx tsc --noEmit --skipLibCheck
npm run build
npm run release:check
npm run bundle:analyze
npm run bundle:report
npm run --silent release:checksums
# Download actual releases into empty temporary directories first:
node scripts/diagnostics/qualify-020-release.mjs /tmp/published-mwc019 /tmp/published-reports010 /tmp/mwc020-native.json
git diff --check
```
