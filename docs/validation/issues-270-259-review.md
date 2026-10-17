# Independent review of PR #272

The remote head matched the requested `56f33e0d93ddedecff606068cc0d8b008cfa6be4` before review. Both current issues had no comments. Repository instructions, the complete implementation diff and linked evidence were inspected. The original tests, production build, release/budget check and native replay were independently rerun before repairs. The original checkout remains untouched.

## Material findings, repaired

| Severity | Finding at the original head | Repair and coverage |
| --- | --- | --- |
| P1 | `src/main.ts:370–401` scanned every Markdown pane while subscribing only to the main document. With retained main/popout selections, native invocation in the popout could open the main window's extract; popout context menus had no listener. Root-only navigation also missed popout context. | `ReadingAnnotationSession` observes each document once, takes only the originating document's events, and retains its file identity. Navigation includes floating leaves and prefers the originating document. Native main/popout selections, menu/command, focus, Save/Cancel, navigation and close cleanup pass. |
| P2 | `src/main.ts:370–378` ignored collapsed selections without invalidating its cache. Native Annotate after explicit deselection reopened the old passage. | Explicit manuscript deselection/caret movement clears the cache; palette and Companion focus transfers preserve the captured note. Detached surfaces and closed windows cannot retain actionable selections. Focused state tests and native deselection/Companion checks pass. |
| P2 | `ReadingAnnotationSelection.ts:22` excluded all `$`, `<`, pipes and backticks in an endpoint section. Ordinary currency/inequality prose, prose beside inline code and callout bodies were rejected. Piped labels were also excluded despite reliable positions. | Literal text is accepted only when the complete rendered section agrees. Checked inline-code and link-label projections and one-to-one callout paragraph mapping preserve source offsets and duplicate occurrence order. Unsupported blocks elsewhere in a note do not invalidate ordinary paragraphs. Unit and native complex-note fixtures pass. |
| P2 | `AnnotationNavigation.ts:119` fell back to nearest-line text matching after a modern anchor's hash changed. Same-line duplicates could silently select the first occurrence and label it exact. | An unchanged hash preserves exact offsets; a changed hash relocates only a unique body extract. Ambiguous text gets a reported approximate body-position fallback, adjusted for derived frontmatter. Legacy navigation is retained. Unit and native changed-duplicate checks pass. |
| P2 | `ReadingAnnotationComposer.ts:24–33` disabled only the Cancel button during Save, leaving Escape/header dismissal active. `main.ts:948` left an open draft alive across unload. | Busy Save blocks dismissal, unload disposes the draft and subscriptions, and pending capture/validation checks plugin lifetime. Native delayed validation/Escape, unload/reload and document close checks pass. |
| P2 | The pre-existing `EditorialStore.ts:295–307` appended before persistence and generated a new ID for every attempt. The new retryable dialog exposed cancelled in-memory records and duplicate retries on errors. | Failed authoritative saves roll back their addition; Reading drafts supply a stable UUID so retry after a derived-count failure reuses the record. Store-level injected persistence/count failures and native persistence-failure/retry pass. |

No additional material defects remained after reviewing the repaired diff. #270's default, stable path identity, restart persistence, re-enable and both mismatch presentation gates were confirmed. No new notification filter, manuscript rewrite, preparation/export mutation, dependency, inline marker or second editorial store was introduced. Original-note association, portable records, annotation ordering and edit-mode creation remain covered by existing and new tests.

## Final validation

- `npm test`: **1,013 TypeScript tests + 15 build/tool tests**, all pass, including test typecheck.
- Production typecheck/build, `release:check`, `bundle:report` and `git diff --check` pass.
- [Final native evidence](issues-270-259-review-native.json) matches the exact built bundle SHA-256. The shared disposable-vault replay now includes adversarial review cases rather than duplicating its application launcher or CDP harness.
- Native **Linux X11 / Obsidian 1.13.7 / Electron 43.3.0**, including actual popout windows: the primary replay uses CDP pointer/keyboard/text input; popout menu/control activation uses native-window DOM events/commands and scripted DOM clicks. Popout-specific physical shortcuts, Windows/macOS/mobile and older supported hosts remain unverified.
- Manuscript comparisons pass with only established derived count metadata allowed. New fixtures are synthetic; no private manuscript was used.

Production JavaScript: **683,057 raw / 193,765 gzip bytes**. Relative to the original PR head: **+3,799 raw / +1,039 gzip**. Relative to current main `e2ed914`: **+14,628 raw / +4,859 gzip**. CSS/manifest unchanged. Hard ceiling **720,896**, headroom **37,839**; warning threshold exceeded, enforced gate passes. Repeated full-note line splitting per rendered section was replaced by one line-offset table per bounded source snapshot. There is no additional renderer, store or dependency.

## Remaining supported boundaries

Embeds, fenced code, HTML/math/table/footnote renderings, callout headings and complex nested callouts may fail the conservative source check. A paragraph sharing an unsupported renderer (such as an embed) may also require another prose selection. These are paragraph/section restrictions, not whole-note exclusions; ordinary prose, literal punctuation, checked inline code/link labels and plain callout paragraphs remain usable in complex notes. Every mismatch produces feedback and saves no annotation. A body change during composition requires reselection. Changed, ambiguous saved extracts navigate approximately with an explicit notice instead of claiming an exact match.

## Ted's local acceptance

1. Turn the mismatch preference off, edit/navigate intentional filename/title differences, restart, then re-enable it.
2. In Reading view, annotate the second duplicate, formatted text and a multi-paragraph passage through context menu, command and your shortcut. Confirm the body receives typing; Save and Cancel retain Reading view and scroll.
3. Move focus to Companion or another scene before saving; verify the original note. Repeat with your usual split/popout arrangement, then navigate, edit, resolve and reopen.
4. Change source while composing and confirm safe rejection; compare manuscript files, allowing only derived annotation counts.

Leave PR #272 unmerged, auto-merge disabled, and both issues open until local acceptance.
