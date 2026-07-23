# Continuity Review real-vault smoke test

**Result:** Completed successfully against authored EMERGENCE and PLURALITY
books. Genuine continuity errors were discovered in both books. All defects
recorded below were corrected and retested without restarting Obsidian.

Use a disposable copy of an authored vault. Confirm the plugin is built from
`feature/132-continuity-review-workspace` and reload Obsidian after installing
the build.

1. Open a scene in a manuscript book and run **Open Continuity Review**.
   - One centre-pane Continuity Review tab opens.
   - The active scene's authoritative book is selected.
   - Re-running the command reuses the same tab.
   - The Manuscript navigator and workspace book selectors show the same book.
   - The Manuscript navigator shows a labelled **Continuity Review** action
     below the book selector; a non-zero active count appears in its label.
   - Book Review shows **Open Continuity Review** beside its book action.
   - Both buttons and the command-palette command reveal the same existing tab.
2. Confirm genuine book chronology and chapter-context findings appear.
   - Scene labels prefer the chapter `title` and never use a raw path as their
     primary label.
   - Part names appear only where they clarify duplicate titles or cross-part
     findings.
   - Each row reads as part/entity context, affected title, specific finding,
     then review state; generic Story World messages identify their entity.
   - Rows remain readable without truncating the location or finding.
   - Selected and unselected rows grow automatically for one-, three- and
     four-line content; the final state line is fully visible.
3. Inspect a finding.
   - The detail pane starts with location, specific finding, concise explanation
     and one prominent **Open …** action.
   - Evidence is grouped into readable sections without raw property paths.
   - Related notes are deduplicated quiet links rather than a button cloud.
   - Diagnostic information is absent by default. Enabling **Show diagnostic
     information** in plugin settings reveals collapsed **Diagnostic details**
     with rule identity, fingerprints, raw property paths, property navigation
     and **Copy diagnostics**.
   - Primary and related actions open the correct manuscript or Story World
     notes without replacing Continuity Review.
   - **Return to manuscript** restores the originating reading leaf.
4. Exercise Queue, Type and Location filters. Exercise Entity when Story World
   evidence exists.
   - Active, reviewed and displayed counts remain accurate.
   - No separate severity filter is present.
5. Mark a finding intentional, then deferred, resolved and unresolved.
   - Intentional and deferred move to Reviewed.
   - A still-produced resolved finding remains Active.
   - Returning to unresolved removes only its disposition record.
6. Change authoritative evidence for a reviewed finding.
   - It immediately returns Active as stale and retains the prior decision and
     note for context.
7. Change a sibling scene date and manuscript order.
   - Chronology findings update after the short metadata-cache settling delay,
     without closing the workspace or restarting Obsidian.
8. Change a directly referenced Story World event, relationship boundary or
   `world_context` value.
   - Chapter and entity-linked findings update without importing unrelated
     vault-wide Story World maintenance observations.
9. Open a scene in another book and run **Open Continuity Review** again.
   - The existing tab retargets explicitly.
   - Merely navigating between notes does not retarget it.
10. Change the authoritative book using the Manuscript navigator.
    - The existing Continuity Review tab immediately shows the updating state,
      then the new book label, observations, counts and filter options.
    - No second Continuity Review tab opens.
    - Queue and a still-valid Type filter survive; invalid Location or Entity
      values clear.
    - **Return to manuscript** opens or restores the new book's context.
11. Select the original book using Continuity Review's book selector.
    - The Manuscript navigator updates to the same book without navigating a
      Markdown leaf.
    - Rapidly switch books several times and confirm the final selection wins;
      no late findings from an earlier book replace it.
12. Narrow the centre pane and use the keyboard.
    - The view changes to list/detail flow.
    - Arrow keys, Home and End move through findings; Enter opens detail;
      Ctrl/Cmd+Enter and double-click open the primary note; Back or Escape
      returns to the list; focus remains visible.
    - The selected-row open action moves below the text and does not narrow or
      obscure the state line. Repeat at increased Obsidian zoom with long part,
      title and finding text.
13. Reload Obsidian.
    - The navigator and Continuity Review restore one coherent selected book.
14. Inspect vault changes.
    - Observation generation, filtering and navigation write no manuscript or
      Story World Markdown.
    - Disposition actions change only portable editorial storage and its normal
     atomic backup files.
15. Select an unsafe or missing manuscript book projection.
    - The labelled review entry point is disabled or absent and its tooltip
      explains that safe authoritative order is required.
16. Verify shape-aware Story World time.
    - **The Article**, authored as a `point` with an hour-precision `from` and
      no `to`, has no incomplete-range warning and displays **19 April 2029,
      09:00**.
    - A day-precision point remains quiet. A genuine range with `from` and `to`
      remains a range.
    - Removing `to` from a range produces one specific **Event range is missing
      an end date** finding; restoring it removes that finding.
    - A chapter comparison against a point produces a chronology finding only
      when the precision envelopes prove the order. Counts refresh without an
      Obsidian restart, and evaluation writes no Markdown.

## Defects corrected during the completed pass

- Shared selection: changing PLURALITY to EMERGENCE in the Manuscript
  navigator now retargets the existing workspace; changing it in the workspace
  updates the navigator. Ordinary note navigation leaves scope unchanged.
- Retarget safety: rapid book changes settle on the final book, and late
  results from a previous book cannot replace its projection.
- Presentation: location-first, title-first rows expose genuine findings in
  EMERGENCE and PLURALITY; variable-height rows keep their state line visible,
  and the primary note action is immediately obvious.
- Evidence: author-facing evidence is grouped and readable, related notes are
  deduplicated, and diagnostic identifiers are hidden by default.
- Discovery: labelled actions in the Manuscript navigator and Book Review open
  the same reusable workspace and display active counts.
- Temporal shape: valid year, month, day, hour and minute point values no
  longer produce incomplete-range warnings; malformed ranges remain visible.
- Scope refresh: adding the current authoritative book to a referenced Story
  World entity's `world_scope` removes the old warning after the coalesced
  metadata refresh, without reopening the vault.
- Authority: all review and navigation actions were checked for vault changes.
  No manuscript or Story World Markdown writes occurred; disposition changes
  affected only portable editorial workflow storage.
