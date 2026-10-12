# Dataset reporting extraction completion

## Scope and baseline

Freshly fetched MWC main: `a9d1b56ad10267224ae88869479bb5065340512b`. The original checkout is clean on `docs/numbering-simplification`; implementation/validation use an isolated `feature/complete-reports-extraction` worktree. [Murmuration Reports 0.1.0](https://github.com/MurmurationPress/murmuration-reports/releases/tag/0.1.0) is published at `262f11630da4fd5848ce6e82013c9ad1a0b25b23`.

PR #267 already removed dataset generation. This follow-up audits that boundary, removes duplicated MWC schema/generation instructions, directs users to the released manager and expands transition regressions. The user explicitly confirmed that both aliases must remain for the promised transition release. No additional production code or dependency removal is needed or justified.

## Inventory and extraction boundary

| Area | Dataset reporting disposition | Infrastructure retained |
| --- | --- | --- |
| Commands | Old dataset command registrations were replaced by `src/reports/ReportsCommandBridge.ts`; only `generate-derived-artefact` and `generate-all-derived-artefacts` remain as deprecated aliases registered in `src/main.ts`. | All Companion/Navigator, manuscript preparation/reconciliation, Git and manuscript-aware report commands. |
| UI/views | Dataset generation never had a separate MWC workspace manager. There is no dataset view, modal, preview or form left; Reports owns those workflows. | `src/companion/ContinuityReviewReportModal.ts`, `src/reports/EntityIndexReportModal.ts`, Companion, Navigator, Story World Graph/Timeline/Review. |
| Services and data models | All eight `src/derived-artefacts/` modules were deleted by #267: commands, definitions/parser, pure service, Obsidian service, line-chart normaliser/SVG renderer and state-table normaliser/Markdown renderer. The published Reports plugin owns discovery, generation, receipts, adoption and output writes. | `src/manuscript/ManuscriptSequenceProperty.ts` and projection, `src/editorial/OpenAnnotationProperty.ts`, continuity/entity-index services and stores. These require manuscript/editorial context and are outside Reports' dataset scope. |
| Settings | Dataset parameters were always authoritative Markdown definition properties; there is no dataset settings model, tab or migration to delete. | `src/companion/ContinuitySettingsTab.ts`, existing diagnostic/Git preferences, editorial state and unrelated settings. |
| Styles/dependencies | No dataset-specific MWC CSS or exclusively used chart dependency remains. SVG appearance is persistent renderer output. The bridge imports no Reports package. | MWC native styles, continuity-report modal styles, shared Obsidian/filesystem/Git infrastructure. Reports' bundled YAML dependency is not added to MWC. |
| Classification and compiler compatibility | Dataset schemas/ownership are no longer interpreted by MWC. | `src/reports/GeneratedReportClassification.ts` and continuity classification remain used by `src/manuscript/ObsidianManuscript.ts` and `src/story-world/StoryWorldIndex.ts` to keep generated manuscript reports out of source authority. Portable Markdown, links, embeds, frontmatter and manuscript order remain compatible with Codex Press. |
| Tests | `tests/DerivedArtefacts.test.ts` and its 21 regressions already moved to Reports. No obsolete dataset parser/renderer tests remain. `tests/ReportsCommandBridge.test.ts` now has seven focused compatibility tests instead of two. | Complete manuscript, annotation, entity-index, continuity, preparation/undo, Git and build/script suites. |
| Documentation | `Help/Derived_Artefacts.md` is now a concise handoff to Reports' released manager and versioned schema; README, Property Reference, Reviews and Reports and transition documentation point to the standalone plugin. | Manuscript-reporting/continuity documentation and historical performance/bundle measurements remain accurate historical evidence; references to old modules in those archived measurements are not live imports. |

## Upgrade and coexistence

The first MWC release containing the bridge is the transition release. At the time of this audit, the latest published MWC release (0.18.0) predated it; the 0.19.0 transition honours the promised hotkey period. Remove the aliases, registration and bridge tests in the **immediately following MWC release**, with **0.19.0** as the prepared transition release and **0.20.0** proposed for removal in the immediately following release.

Neither this PR nor the bridge migrates/deletes files, regenerates on startup/events, prunes unrelated settings or edits hotkeys. Existing definitions, charts, tables, receipts, backups, destinations and links remain untouched. Rebind shortcuts through Obsidian before the removal release, using the [old-to-new IDs](murmuration-reports-transition.md).

The bridge is a 39-line structural adapter resolving capability version 1 on each invocation and capturing the active Markdown path synchronously. It delegates batch coordination once and forwards structured results unchanged. It has no parser, renderer, fallback writer or hard Reports dependency. Missing/incompatible Reports gives an enable-Reports notice. Either loading order and disable/re-enable work without cached references. Both plugins can coexist; saved assets display and compile with both disabled. Older MWC builds with their original dataset writer should not overwrite assets now managed by Reports.

## Validation

Local: `npm ci`, complete `npm test` (**986 TypeScript tests and 15 script tests**), production type checking/build, `npm run release:check`, and `node scripts/report-bundle.mjs` pass. Expanded bridge tests cover IDs, absence, incompatible version, either loading order, re-enable, Unicode/spaced path capture, null/non-Markdown context, rich failure/batch result forwarding, rejection handling and forbidden access to vault/settings/hotkey services. No source, settings, style, manifest or dependency file is changed; the built JS is byte-identical to current main. Ubuntu/Windows exact-head CI is recorded on the review PR.

Published-plugin native checks ran in a disposable Linux Obsidian 1.13.7 vault. The downloaded Reports assets were compared byte-for-byte with those installed; Reports JS SHA-256 is `3b427af82300c08de03eb115684b81f80f76c51269f7311206cf13b25effedb2`, MWC JS is `c9075b64c8072ceece140ceb482ee765a9fee2c376c471c799cc7e5159d22604` (identical before/after this PR).

The run recorded **13 completed native checks**, including Reports-first/MWC-second delegation, the MWC-only unavailable-capability notice, MWC-first/Reports-re-enable batch delegation, native generation/result presentation, adoption, cancellation, definition moves and explicit ownership repair. Evidence is `/tmp/murmuration-reports-live-PQnlyp/failure.json`; it records completed checks rather than a blanket successful-run claim. The full harness stopped later at its both-disabled preview assertion. Startup result-dialog timing was also intermittent across diagnostic attempts. Full both-disabled display/restart requalification did not complete in this run and is not marked passed; published Reports' existing acceptance/export qualification remains the prior evidence, and this PR changes no production code. No live author vault, Reports code or Codex Press code was modified.

Reproduction: check out Reports tag `0.1.0` in an isolated source checkout, install its development dependencies, copy the three published release assets into that checkout, verify their release hashes, then run `node scripts/verify-live.mjs /path/to/built/MWC-checkout`. The diagnostic attempt enabled exception observation without altering either plugin bundle. The harness is a manual Linux check; Windows CI does not qualify Windows live interaction. Native timing/preview failures remain a test limitation to resolve independently of this documentation/test-only PR.

## Production measurements and residual cost

Node 24.19.0 / esbuild 0.23.1; committed lockfile, ES2018 minification and existing bundle policy unchanged.

| Installed asset | Before raw / gzip bytes | After raw / gzip bytes |
| --- | ---: | ---: |
| JavaScript | 667,724 / 188,600 | 667,724 / 188,600 |
| Styles | 63,555 / 10,217 | 63,555 / 10,217 |
| Manifest | 277 / 185 | 277 / 185 |
| Installed total | 731,556 / 199,002 | 731,556 / 199,002 |

This follow-up saves **0 bytes**: the implementation was already extracted, and the user confirmed retention of the bridge. Existing extraction savings versus `d7c2e6e625e98fade7004a064ab081670e607d4e` remain **14,580 raw JS / 4,778 gzip bytes**. Headroom remains **53,172 bytes** below the 720,896 hard ceiling and 1,972 below the 669,696 warning threshold.

An isolated disposable worktree at the same baseline removed only the bridge import and registration for measurement, without committing the experiment. The hypothetical bundle is **666,978 raw / 188,312 gzip**, so the residual transition cost is **746 raw / 288 gzip bytes**. Esbuild attributes 712 minified bytes to the bridge module; the whole-bundle delta includes registration and minifier interactions. Gzip cost is an experimental whole-bundle difference, not independently compressed module size. The experimental removal is not part of this PR.

Reproduce the retained bundle with `npm ci && npm run build && node scripts/report-bundle.mjs`. For the counterfactual, use a disposable checkout of the same commit, delete only the `ReportsCommandBridge` import and `installReportsCommandBridge(...)` registration in `src/main.ts`, and run `scripts/report-bundle.mjs` against that source root. Never remove manuscript-aware reporting to manufacture a larger saving.
