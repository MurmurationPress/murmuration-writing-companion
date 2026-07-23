# Continuity dispositions smoke test

Use a disposable real vault and keep the Writing Companion open. Before and
after the test, inspect the vault diff and
`.murmuration/writing-companion/editorial-data.json`.

1. Produce a deliberate `2026` → `2023` manuscript reversal.
   - Book Review shows one active continuity finding.
   - Scene actions use each chapter's `title`, falling back to its basename.
   - The card shows only the directly involved scene actions, not book or part
     buttons.
   - Activate **Mark intentional** with the keyboard.
   - The active warning count clears and **Reviewed 1** remains visible.
   - **Show reviewed** reveals the finding as Intentional.
2. Use **More → Add note**, enter `Deliberate flashback.`, save, collapse Book
   Review, and reopen or reload the vault.
   - The note and intentional disposition persist.
   - Manual collapse state is not changed by disposition refresh.
3. Change either relevant date or manuscript sequence materially.
   - The finding returns to the active count as changed since review.
   - The prior intentional decision and note remain visible.
4. Re-mark the current finding intentional, then use **Return to unresolved**.
   - The disposition record is removed and the finding returns to active review.
5. Mark the finding resolved without fixing the evidence.
   - It remains active with **Marked resolved — still detected**.
6. Fix the authoritative evidence so the finding disappears, then recreate the
   same reversal.
   - The resolved record was historical while absent.
   - The reappearing observation is active even when its fingerprint matches.
7. Repeat intentional, deferred, stale, note and unresolved actions for an
   active-chapter World Context event/relationship/scope or source-data finding.
8. Rename a relevant note.
   - Descriptive stored paths update where the vault rename event can identify
   them.
   - The UI does not claim durable identity; a path-changed concern may become
   stale or unresolved according to the observation contract.
9. Create a cross-part reversal and, separately, duplicate scene titles.
   - Part names appear only as restrained secondary disambiguation.
   - Parts do not become additional navigation actions.
10. Confirm throughout:
   - controls work with Tab, Enter, Space and Escape in a narrow sidebar;
   - no toast or modal is required for ordinary disposition actions;
   - no manuscript or Story World Markdown is written;
   - only the portable editorial JSON and its atomic backup files change.

## Completed real-vault results

- Genuine chronology mistakes were detected and cleared when their
  authoritative dates were corrected.
- Intentional flashbacks left the active warning count after being marked
  intentional and remained available through **Show reviewed**.
- Sibling date changes, manuscript-order changes and disposition changes
  refreshed the visible findings without reopening the vault.
- Stale findings disappeared when no longer produced and reactivated when the
  changed evidence returned.
- A real scene containing both `story_day: 1017` and
  `story_date: 2028-05-02` exposed an unsafe alias collision. `story_day` is now
  preserved as a distinct property and chronology reads the canonical
  `story_date`.
- Scene actions used readable chapter titles and omitted redundant book and
  part buttons; part context remained secondary where needed.
- Navigation, keyboard controls, note persistence and active/reviewed counts
  worked in the existing World Context and Book Review surfaces.
- Observation and disposition generation produced no manuscript or Story World
  Markdown writes.
