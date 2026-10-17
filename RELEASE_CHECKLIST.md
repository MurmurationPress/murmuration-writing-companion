# 0.20.0 Stable Release Checklist

## Candidate qualification

- [ ] Read the [readiness report](docs/release-readiness-0.20.0.md), current release notes and upgrade guide; audit all changes since published 0.19.0.
- [ ] Confirm all current version declarations are 0.20.0 and minAppVersion remains 1.5.0.
- [ ] `npm ci`, `npm test`, both test and production typechecks.
- [ ] `npm run build`, `npm run release:check`, `npm run bundle:analyze`, `npm run bundle:report`, `git diff --check`.
- [ ] Record JS/CSS/manifest raw, gzip, total, checksums and budget warning; retain #252 and its unmet headroom target.
- [ ] Ubuntu and Windows CI pass on the exact final candidate; inspect both candidate asset archives/checksums.
- [ ] Clean installation and upgrade from downloaded published 0.19.0 in disposable synthetic vaults, with intact editorial records, Reading annotations/Board and restart persistence.
- [ ] Both old dataset aliases absent; Reports replacements available when enabled; MWC independent when absent. Existing hotkeys/generated files untouched.
- [ ] Compare manuscript/store before and after startup/upgrade. Explicit annotation work may change only editorial data and derived mwc_open_annotations metadata.
- [ ] Record actual native platform/input coverage and remaining limitations; reuse reviewed feature evidence without claiming new platform acceptance.
- [ ] Independent review and explicit approval; resolve material blockers. #241 stays backlog; #252 stays open.

## Publication — requires separate authorisation

- [ ] Merge approved PR, verify reviewed/merged tree equality, and require post-merge Ubuntu/Windows CI.
- [ ] Create and push **0.20.0** (no v prefix) at that exact merge commit.
- [ ] Publish workflow succeeds, uses RELEASE_NOTES.md and creates a stable latest release.
- [ ] main.js, manifest.json, styles.css and SHA256SUMS attached; three plugin assets are non-empty and from the same build.
- [ ] Download release assets; compare SHA256SUMS and candidate hashes; clean manual install and upgrade smoke using [the guide](docs/installation-and-upgrade.md).
- [ ] Announce stable release only after verification. Do not install into a live vault without authorisation.
