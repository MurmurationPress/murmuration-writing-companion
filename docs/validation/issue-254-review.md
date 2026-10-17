# PR #273 review against #254

The remote head matched expected `54fe76f6797900e9921750e66c49af0dc8c4f8ac`.
Read the current issue/comments, repository Constitution/architecture/release
instructions, complete implementation diff and both linked evidence files.
Original automated checks and exact bundle sizes reproduced successfully; the
following adversarial cases exposed gaps not covered by those passing checks.

## Findings and repairs

References identify the **original reviewed head**, before repairs. All findings
below are repaired; none remain blocking in the final implementation.

| Severity | Original location | Concrete failure and repair |
| --- | --- | --- |
| P1 | [AnnotationBoardView.ts:89](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/companion/AnnotationBoardView.ts#L89), [267](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/companion/AnnotationBoardView.ts#L267), [280](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/companion/AnnotationBoardView.ts#L280) | Category retry overwrote a newer category; modal validation ran before queueing, so a queued newer body was overwritten. Drag payloads carried no revision. Immutable snapshots now validate identity, membership, revision and view availability at the actual serialized write boundary. Stale drags/retries reject with feedback. |
| P1 | [EditorialStore.ts:330](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/editorial/EditorialStore.ts#L330) | An uncommitted candidate was visible in the shared store and captured by another save even when its own save failed. Annotation creation/update now stages candidates, serializes save preparation/publication, and publishes only on successful persistence. Subsequent unrelated saves read committed annotation state. |
| P1 | [EditorialStore.ts:325](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/editorial/EditorialStore.ts#L325), [AnnotationBoardProjection.ts:64](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/companion/AnnotationBoardProjection.ts#L64) | Duplicate legacy IDs collapsed two cards into one; updating the second record from the shared chapter path changed the first. Shared updates now use record reference identity. The board retains distinct cards for missing/duplicate IDs, explains the identity problem and disables unsafe mutations without rewriting stored history. |
| P2 | [AnnotationBoardView.ts:273](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/companion/AnnotationBoardView.ts#L273) | A derived-count retry re-applied Resolve after another operation had reopened the annotation. Saved-state/count failures are now distinguished; retry repairs only the current authoritative count and preserves the newer status/body/category. |
| P2 | [AnnotationBoardView.ts:97](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/companion/AnnotationBoardView.ts#L97) | A board in a real popout navigated into its remembered main-window pane despite an available Reading pane in the popout. Navigation hints now respect the board document; window close releases the hint. Queued editor writes also reject after view closure/unload. |
| P2 | [AnnotationBoardView.ts:228](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/companion/AnnotationBoardView.ts#L228) | Category changes dismantled the focused control and moved replacement nodes after focusing them. Focus jumped to the Part filter, so a second ArrowDown acted on the wrong control. Busy state no longer redraws cards; focus restores to the matching control after all column moves. Two consecutive OS-level keyboard category changes pass. |
| P2 | [AnnotationBoardProjection.ts:44](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/companion/AnnotationBoardProjection.ts#L44), [AnnotationBoardView.ts:165](https://github.com/MurmurationPress/murmuration-writing-companion/blob/54fe76f6797900e9921750e66c49af0dc8c4f8ac/src/companion/AnnotationBoardView.ts#L165) | A stored empty category appeared as Uncategorised but its filter value collided with All categories. Encoded option values now distinguish them without changing stored categories. |

The board continues to consume the authoritative settled Book tree, including
mixed direct Scenes/Parts. Order remains hierarchy, line/offset, creation time and
ID; repeated text is not used to order or identify cards. Existing #272 navigation
and export-anchor resolution were not replaced. Shared card category definitions
and the draft editor remain reused. Column grouping and Part membership checks now
avoid repeated scans of the cards during one render; no dependencies or unrelated
performance changes were added.

## Automated verification

- Baseline: `npm test`, production typecheck/build and release checks reproduced
  the original 1,022 TypeScript + 15 build/tool passes and 696,894/197,773 JS bytes.
- Repaired implementation: **1,030 TypeScript tests + 15 build/tool tests pass**,
  including test typecheck. Eight added regression cases cover duplicate/missing
  identities, empty categories, queued revisions, candidate isolation, shared
  record identity, count-only retry, stale/foreign drag snapshots, popout ownership
  and close/unload guards. Existing creation failure/retry tests now exercise the
  real staged persistence boundary.
- Production typecheck/build, `release:check`, `bundle:analyze`, `bundle:report`
  and `git diff --check` pass. Version remains 0.19.0; budget policy is unchanged.
- Exact-final-head Ubuntu and Windows CI links/results are recorded in the PR.

## Native verification and integrity

[Machine-readable review evidence](issue-254-review-native.json) includes the
original counterexamples and repaired results, exact original/final installed
asset hashes, **63 distinct checks**, separate OS input results and seven-file
manuscript comparisons. All tests used a new disposable synthetic vault, not a
live/private manuscript. Original installed assets match the linked original
report; final installed assets match the final production build.

Actual Linux X11 Obsidian 1.13.7 / Electron 43.3.0. Most replay controls used CDP
DOM activation or application commands. Separately, **OS-level X11/XTest input**
dragged a card to Canon, then changed it through Continuity and Style with two
ArrowDown key presses while retaining Annotation category focus. An OS-level
pointer click opened the editor once; XTest keyboard text landed in its focused
body and saved to the original annotation. This is injected desktop input, not a
claim of physical hardware or assistive-technology testing.

Reading navigation selected the exact second duplicate and retained the board;
edit-mode selection remained exact. Book/Part/Scene/picker scope, filters and empty
states, resolved visibility, editing/cancellation, external annotation/order and
membership changes, rename/deletion/restoration, Book rename and source evidence
were exercised. Queued body edits rejected a note moved to another Book.
Shared chapter cards retained unknown categories, editable failed-save drafts,
body/category retry, resolve/reopen counts and unchanged anchors.

A real native popout passed document-local Reading navigation, editor ownership
and body focus, close while an editor write was queued (no stored-body change),
hint cleanup, reopen, and plugin unload/reload without duplicate controls or
window-close subscriptions. Popout controls used DOM/commands; OS-level input was
performed in the main window.

With 1,000 additional synthetic annotations, initial card reconciliation took
226.3 ms in this run. Ten unchanged refreshes took 42.2 ms total, redrew **zero**
cards and performed **zero** vault scans. Draft input events did not render the
board. These are local observations, not cross-platform performance guarantees.
An isolated unrelated update retained horizontal scroll 300 and filter focus.

The replay needed a settled, isolated starting state: stale intentional error
rows from earlier negative tests could select the wrong generic Retry button in
the harness, and immediate scroll assertions before native pane restoration had
settled were timing-sensitive. After resetting those fixtures and allowing pane
restoration to settle, the full board replay and targeted cases passed.

All seven final Markdown files equal their original snapshots after removing only
`mwc_open_annotations` property lines. Temporary hierarchy/move/rename changes were
reversed. No prose, formatting, unrelated frontmatter, schema or anchor evidence
was changed by board operations.

## Bundle and remaining limitations

| Shipped asset | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| main.js | **700,865** | **198,746** |
| styles.css | 64,472 | 10,381 |
| manifest.json | 277 | 185 |
| **Total shipped** | **765,614** | **209,312** |

Repair impact from expected head: **+3,971 raw / +973 gzip**, entirely JavaScript.
From main `67c3f8f`: JS +17,808/+4,981; total shipped +18,725/+5,145.
The JS hard ceiling remains 720,896 bytes with **20,031 bytes headroom**.
The existing 669,696-byte nonblocking warning remains exceeded. No dependency,
version, release or live-vault installation changes.

Native Windows/macOS/mobile, older hosts, screen readers and touch dragging remain
unverified. Offscreen drag edge scrolling is still unsupported; horizontal scroll
and category controls remain available. Missing/duplicate IDs are a narrowly
identified malformed-record condition: the board retains them read-only instead
of guessing an identity. Ordinary valid legacy records and unknown categories,
including blank categories, remain usable. Changed/ambiguous anchors keep #272's
explicit approximate-position feedback.

## Ted's local acceptance

1. Open from Book, Part and Scene, then choose a Book from a tool pane. Check mixed ordering, filters and Show resolved.
2. Drag a card; use two consecutive keyboard category changes. Confirm focus follows that card and scroll stays usable.
3. Edit/save/cancel and resolve/reopen from both board and chapter cards. Change an annotation elsewhere before retrying a failed operation; newer work must survive.
4. Navigate a repeated passage in Reading and edit modes; keep the board open. Try a board and manuscript pane together in a popout, then close/reopen it.
5. Check manuscript prose/formatting/unrelated properties and original anchor evidence. Only derived annotation counts may change.

Keep PR #273 unmerged, auto-merge disabled and #254 open pending Ted's acceptance.
