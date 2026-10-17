# Independent review of MWC 0.20.0 — PR #274

Reviewed expected head `b09bf23ed9cb493e779767f6b3414098b4001da5` in a new isolated worktree. Remote head matched; current main remained `d395886c22f53b61993826e9f772ad2f50b5c955`. Read Constitution, architecture and release procedures, complete diff, published 0.19.0 notes, upgrade guidance, both qualification reports and all recorded native assertions. Final repaired head and exact-head CI/archive verification are recorded in PR #274, avoiding a self-referencing commit in this report.

## Findings and repairs

**P1 — Publication could release an unmerged branch.** Original [release.yml:25–32](https://github.com/MurmurationPress/murmuration-writing-companion/blob/b09bf23ed9cb493e779767f6b3414098b4001da5/.github/workflows/release.yml#L25) checked only tag/manifest version equality; [49–58](https://github.com/MurmurationPress/murmuration-writing-companion/blob/b09bf23ed9cb493e779767f6b3414098b4001da5/.github/workflows/release.yml#L49) then published. A `0.20.0` tag on the still-unmerged candidate satisfied that check and would bypass the documented merged-tree/post-merge-CI gate. No tag was created to demonstrate it: the candidate's manifest version and known unequal main/head SHAs establish the counterexample.

Repaired by `scripts/release-source.mjs`, executed immediately before release packaging/publication. It requires a stable version tag without `v` or prerelease suffix, resolves annotated/lightweight tags to their commit, checks checkout/tag/current-main equality, and requires the latest matching **main push** run to be completed and successful of `ci.yml` on that exact SHA. Branch and PR runs, wrong SHA/workflow, incomplete, failed and cancelled CI fail closed; an older success cannot mask a newer pending/failing run. Only read-only `actions: read` was added to existing release permissions. `gh release --verify-tag` and explicit tag checkout/build remain. Human review, reviewed/merged-tree equality and publication authorisation remain deliberate pre-tag requirements; automation does not infer Ted's approval.

**P2 — Published release Help/upgrade links used the wrong base.** Original [RELEASE_NOTES.md:9](https://github.com/MurmurationPress/murmuration-writing-companion/blob/b09bf23ed9cb493e779767f6b3414098b4001da5/RELEASE_NOTES.md#L9), [28](https://github.com/MurmurationPress/murmuration-writing-companion/blob/b09bf23ed9cb493e779767f6b3414098b4001da5/RELEASE_NOTES.md#L28), [32](https://github.com/MurmurationPress/murmuration-writing-companion/blob/b09bf23ed9cb493e779767f6b3414098b4001da5/RELEASE_NOTES.md#L32) and [36](https://github.com/MurmurationPress/murmuration-writing-companion/blob/b09bf23ed9cb493e779767f6b3414098b4001da5/RELEASE_NOTES.md#L36) used relative `Help/`/`docs/` links. The workflow passes this file unchanged as a release body, not as a repository source page. GitHub's Markdown API with repository context renders `[Upgrade guide](docs/installation-and-upgrade.md)` as `<a href="docs/installation-and-upgrade.md">`; resolving that on a release-tag page targets the release route rather than the guide. Replaced all four with explicit `blob/0.20.0/` URLs, following published 0.19.0 practice, and added a regression. Those versioned URLs become available when the authorised stable tag is published; candidate review links in PR #274 remain head-pinned.

No further material release-specific correctness defect was found. The cached Reading repair requires equality of the complete Markdown body before offset translation; it neither searches repeated extracts nor normalises body line endings. The tests now cover CRLF-only headers, unchanged CRLF bodies and rejection when body line endings differ. No runtime repair or bundle growth was needed during this review.

## Inventory, aliases and test counts

Actual published 0.19.0 tag resolves to `00c6ae80c592c695da62fd4b94fa65a4a50c2270`. Exactly #271 (`e2ed914`), #272 (`67c3f8f`) and #273 (`d395886`) were merged after it. Release changes add metadata/docs/packaging, remove only the promised bridge and two command registrations, and repair cached Reading navigation. Package/lock/root-lock/manifest/version map agree on **0.20.0 → Obsidian 1.5.0**. No dependency changed. Dataset labels and full replacement IDs match published Reports 0.1.0. Manuscript-aware commands remain. No hotkey mutation, generated-asset deletion or new source/store migration was introduced. Existing legacy recovery/migration when no portable store exists is explicitly retained in upgrade guidance.

Feature review: **1,030 TypeScript / 15 build-tool tests**. Preparation intentionally removes the bridge's **7** tests, adds **1** transition test and **1** cached-navigation regression: **1,025** TypeScript tests. It adds **1** checksum test: **16** build/tool tests. This review extends the existing navigation test with line-ending cases, adds **1** release-link regression (**1,026** TypeScript tests), and adds **1** publication-source policy test (**17** build/tool tests). No other test file or test command was removed. The removed delegation tests cover an API that no longer exists; manuscript, store, ordering, navigation and shared-card regressions remain.

## Independent validation

- Fresh `npm ci`, full tests/test typecheck, production typecheck/build, `release:check`, bundle analysis/report and `git diff --check` pass. Repaired suite: **1,026 TypeScript + 17 build/tool tests**.
- [Negative checks](qualification/0.20.0-review/negative-assets.json) reject altered JS, altered CSS and CRLF manifest. All originals restored in `finally`; these checks access only this disposable checkout's plugin assets, never manuscript files.
- Downloaded original exact-head CI archives from push run **39045495095**. Ubuntu and Windows `main.js`, `manifest.json`, `styles.css` and `SHA256SUMS` are byte-identical, match fresh local builds and the original native-qualified hashes. Freshly downloaded published 0.19.0 / Reports 0.1.0 assets match their recorded hashes too.
- Reproduced the original actual-0.19.0 upgrade smoke: **33/33** assertions. Then added targeted native cases and reran upgrade: **40/40** assertions, including the two explicit derived-count checks and five review assertions. [Native review evidence](qualification/0.20.0-review/native.json).
- Actual Linux X11 Obsidian **1.13.7**, Electron **43.3.0**. CDP DOM/application commands, Chromium typing and PID-owned X11 focus activation; no physical pointer/keyboard claim. Native checks establish CRLF-only frontmatter navigation to the second duplicate, stale/body-line-ending rejection without a new highlight, edit-mode exact offset **177**, unchanged store/restored manuscript, preserved old notes/history/open/resolved records, counts and Board behaviour, original anchors and restart persistence.
- Reports is genuinely absent initially. After installing its downloaded published assets, both **Generate active report definition** and **Generate all report definitions** execute by their actual registered IDs, display a safe unsupported-definition result and leave the synthetic manuscript/store/generated files unchanged. This checks routing/coexistence, not fresh qualification of valid report generation or exports; unchanged published Reports/feature evidence is reused for those workflows.

## Assets and budget

Node's repository-standard `gzipSync` default compression is used (not a different compressor/level).

| Asset | Raw | Gzip | SHA-256 |
| --- | ---: | ---: | --- |
| main.js | 700,358 | 198,568 | `c29668f7d30c1a7c2cfc2c880b19638fc906b36983468e3ac6f8cb2a01690b94` |
| manifest.json | 277 | 185 | `4596085c1c8278720d19409966d3c9846061d83f62b9b045430601956d752c32` |
| styles.css | 64,472 | 10,381 | `0aed98aac8c86dc4be0cef3542a5f8b752b28fbaea9c834987c46c14ec6dc316` |
| Installed total | 765,107 | 209,134 | Sum of individual assets |

SHA256SUMS is 231 bytes; its own hash is `6e5faa13c833870d034b69fb7092ba0f74619673e07a7cb41894f689287a4a6f`. It is a verification download, not an installed runtime asset. JS raw hard ceiling **720,896**; headroom **20,538**. Warning/target maximum **669,696** remains active; **30,662** bytes reduction is still needed for the existing 50 KiB target. No warning/ceiling policy change. #252 stays open and #241 remains backlog.

## Recommendation and remaining limits

Ready for the final merge/publication instruction **after exact-final-head Ubuntu/Windows CI and archive comparison pass**, with no remaining material release blocker. Those final results are attached to PR #274. Do not merge, enable auto-merge, tag, publish or deploy as part of this review.

Native Windows/macOS/mobile, older/minimum hosts, screen readers/touch, physical multi-window/IME, wider themes/plugins and valid Reports/export workflows are not newly exercised. Prior accepted feature/export/popout evidence remains applicable; CI is not native Windows UI acceptance. The tag/publish workflow was reviewed and its policy tested, not executed. Actual post-merge CI, tag publication, downloaded-release verification and publication smoke remain future gates. Worktrees and unrelated local work are preserved.

Targeted native reproduction (download published assets into empty disposable directories first):

```sh
MWC_RELEASE_SCENARIOS=upgrade MWC_RELEASE_REVIEW=1 node scripts/diagnostics/qualify-020-release.mjs /tmp/published-mwc019 /tmp/published-reports010 /tmp/review274-native.json
```
