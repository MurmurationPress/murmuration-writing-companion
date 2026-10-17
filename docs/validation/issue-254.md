# Issue #254: Book-scoped Annotation Board

**Historical implementation evidence for `54fe76f6797900e9921750e66c49af0dc8c4f8ac`.**
The independent review found and repaired additional defects. See the
[current review, final validation and limitations](issue-254-review.md).
Figures and results below describe the original implementation head.

Implemented from main `67c3f8fcc915bca964b98e35c2e515f813bd490e` in an isolated
worktree. No version/dependency changes, release, private manuscript or live-vault
installation. PR remains subject to independent review and Ted's local acceptance.

## Acceptance results

| Criterion | Result |
| --- | --- |
| MWC entry points | **Open Annotation Board** command and **Annotation Board** button in Companion Book Review. Book/Part/Scene and Navigator context resolve the Book; a native searchable picker handles absent context. One board tab is reused. |
| Scope and grouping | Current Book members only, open by default, shared categories plus preserved unknown categories. Cards show chapter, extract, body, stored line and exact source offsets when available. |
| Ordering | Authoritative hierarchy traversal handles mixed direct Scenes and Parts. Within a note: line, offset, creation time, stable annotation ID. No filename sorting or first-extract lookup. |
| Filters | Part, chapter and category; clear filter/Book/open-work empty states. Native labelled controls wrap in narrow panes; columns scroll horizontally. |
| Category changes | Native drag handle/drop columns and accessible category select; resolved annotations can also change category through Edit. |
| Lifecycle and editing | Existing annotation card/editor and store update operation. Resolve hides immediately unless Show resolved is enabled; reopen restores the derived count. Editor cancellation saves nothing. |
| Navigation | Existing #272 navigator and source-anchor validation, including exact second duplicate in Reading view and exact selected extract in edit mode. Board remains open. Reading/edit modes are preserved. |
| Live refresh | Store changes and settled manuscript reconciliation update keyed cards; membership, order, deletion, restoration and rename exercised. Ten direct board refreshes performed zero vault scans. |
| Failures | Failed portable writes roll back annotation fields and offer retry. A saved lifecycle with a subsequent derived-count failure also offers visible retry. Concurrent body/category edits reject stale drafts with feedback. Missing notes/membership/anchors are checked before actions. |
| Integrity and compatibility | Same portable schema, shared categories/operations and original anchor evidence; no second store, synthetic annotation files, Bases or Kanban dependency. All seven synthetic Markdown files match their before snapshots after removing only `mwc_open_annotations` lines. |

## Automated checks

- `npm ci`.
- `npm test`: **1,022 TypeScript tests and 15 build/tool tests pass**, including test typecheck. Nine new regression cases cover isolation, mixed ordering, anchor/tie ordering, filters/resolved visibility, external projection changes, failed/retried/serialized store operations, derived counts, original-note navigation wiring, Reading-view preservation and context resolution.
- `npm run build`: production typecheck and build pass.
- `npm run release:check`: packaging/assets/version consistency pass at unchanged 0.19.0.
- `npm run bundle:analyze`, `npm run bundle:report`, `git diff --check`: pass; warning threshold remains exceeded.
- Ubuntu/Windows CI results are linked in the PR for its exact head.

## Native verification

[Machine-readable evidence](issue-254-native.json) records 41 distinct native
checks, explicit input results, installed-asset SHA-256 hashes, manuscript
comparisons and bundle measurement.

Actual Linux X11 Obsidian **1.13.7**, Electron **43.3.0**, disposable synthetic vault
with two Books, a Part and direct/Part Scenes. Most actions used commands and DOM
control activation in the actual app through CDP. Additional **native pointer
input successfully dragged a card between visible columns**, and **native keyboard
input changed category through the select**. A pointer click activated the editor
exactly once; native inserted text landed in its focused annotation body and was
saved to the original annotation. Before/after manuscript comparisons passed.

The replay covered filters and empty states, unknown categories, Book picker and
Part/Scene context, single activation, editing/save/cancel, an active Book change
during composition, resolve/reopen and counts, external updates and reorder,
Book membership changes, rename, deletion/restoration, scroll/filter focus,
320px pane layout, missing anchors, exact duplicate navigation in Reading mode,
edit-mode navigation, disk-write rollback/retry, concurrent-edit rejection and
saved-status/count-projection failure recovery. Temporary structural fixture
changes were reversed before final manuscript comparisons.

The initial pointer attempt targeted a clipped column in a narrow pane; moving to
visible columns passed. Narrow panes provide horizontal scrolling and the category
select; automatic edge scrolling during a drag is not implemented. The editor
modal replay also required activating the actual test window before using DOM
controls, because Obsidian routes modals to its active window.

Native Windows/macOS/mobile, popout windows, screen readers and touch dragging
remain unverified. Windows CI is automated coverage, not native Windows acceptance.
Existing navigation's explicit approximate-position notice for changed/ambiguous
anchors remains in effect. Notes detached from the current hierarchy are not
attributed to a Book by guessing; their editorial records remain retained.

## Bundle impact

Independently rebuilt baseline main with the same production build options:

| Asset | Main baseline | This implementation | Change |
| --- | ---: | ---: | ---: |
| JavaScript raw | 683,057 B | **696,894 B** | +13,837 B |
| JavaScript gzip | 193,765 B | **197,773 B** | +4,008 B |
| CSS raw | 63,555 B | 64,472 B | +917 B |
| CSS gzip | 10,217 B | 10,381 B | +164 B |

JavaScript hard ceiling **720,896 B**: **24,002 B headroom**. Nonblocking warning
threshold 669,696 B remains exceeded. No runtime dependencies were added; existing
card/editor/navigation/persistence code is shared rather than reimplemented.

## Ted's local acceptance

1. Open the command from a Book, Part and Scene, and from an unrelated tool pane.
2. Review a Book containing direct Scenes and Parts; check filters and Show resolved.
3. Move a card by drag and category select; edit, cancel, save, resolve and reopen.
4. Follow a repeated extract in Reading view and an extract in edit mode; keep the board open.
5. Change annotations/order in another pane, then verify board updates and scroll/focus.
6. Confirm manuscript prose, formatting and unrelated frontmatter remain unchanged.
