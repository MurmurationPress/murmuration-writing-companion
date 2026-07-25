# PRIME Continuity Review report smoke test

Use a selected PRIME Book with observations across multiple Parts and, where available, unresolved, intentional, deferred, resolved and stale states plus Story World and temporal evidence. Record hashes for manuscript, Story World and portable editorial source data before testing.

1. Open Continuity Review and select the test Book.
2. Choose **Generate report** and preview **Entire selected Book**.
3. Confirm the preview identifies the Book, scope, ISO timestamp, MWC version and Markdown-authority boundary.
4. Compare total, severity, kind and disposition counts with the workspace.
5. Confirm disposition sections and findings follow authoritative manuscript order across Parts and Scenes.
6. Confirm intentional and deferred author notes and review timestamps are accurate.
7. Confirm stale dispositions retain the prior decision while requiring renewed review.
8. Confirm manuscript, Story World and derived temporal evidence use distinct headings, and editorial dispositions are separate.
9. Follow representative wikilinks and confirm they open the correct authoritative notes; confirm missing or deleted sources remain readable and marked unavailable.
10. Copy the report and confirm the clipboard matches the preview exactly and no vault file is created.
11. Save to the suggested new filename and confirm the saved UTF-8 content exactly matches the preview.
12. Confirm the saved report opens and is indexed as neither manuscript structure nor a Story World entity.
13. Return to Continuity Review, apply Queue, Type, Location and Entity filters, and preview **Current filtered result set**.
14. Confirm the header records the active filters and the report contains exactly the visible observations.
15. Attempt the existing saved path and confirm saving is disabled with no overwrite; choose an alternate filename and save successfully.
16. Test a Book or filtered set with no observations and confirm the useful empty report.
17. If practical, temporarily make the clipboard unavailable and test an invalid or unwritable destination; confirm restrained failure notices and no partial source changes.
18. Rebuild indexes and regenerate without source or disposition changes; confirm materially equivalent content apart from the report timestamp.
19. Compare recorded hashes and confirm manuscript, Story World and editorial source data—including disposition timestamps—did not change.

## Completed PRIME result — 25 July 2026

The PRIME trilogy real-vault smoke test passed.

- Whole-Book generation included the complete current selected-Book collection regardless of transient workspace filters.
- Filtered generation contained exactly the currently visible findings and recorded the active Queue, Type, Location and Entity filters.
- Summary counts by severity, observation kind and disposition matched both the Continuity Review workspace and the rendered report sections.
- Findings followed authoritative flattened Scene order across multiple Parts within each disposition section.
- Manuscript and Story World wikilinks opened the correct authoritative source notes.
- Unresolved, deferred, intentional, resolved and stale findings were represented accurately, including author notes, first-review timestamps and last-update timestamps.
- Manuscript, Story World, derived temporal and editorial-disposition evidence remained visibly distinct.
- The preview, copied Markdown and saved UTF-8 note content were identical.
- Copy and Cancel created no vault file or persistent report state.
- Explicit save created one new Markdown note and opened it successfully.
- An existing destination was refused without overwrite; choosing an alternative filename succeeded.
- The saved `type: continuity-review-report` note remained absent from Manuscript and Story World indexing after index rebuild, including when tested inside legacy manuscript folder scope.
- Whole-Book and filtered empty states produced clear, useful empty reports.
- Rebuilding indexes and regenerating over unchanged sources produced materially equivalent content apart from the report timestamp.
- Recorded manuscript, Story World and portable editorial source hashes remained unchanged.
- Existing disposition values and `firstReviewedAt`/`updatedAt` timestamps remained unchanged.
- The widened responsive modal remained readable and usable with a realistically long report and destination path.

The workflow retains its deliberate boundaries: historical disposition records without a current observation are omitted; existing reports cannot be replaced; destination parent folders must already exist; report history, comparison and scheduling remain out of scope; and every report remains a non-authoritative snapshot.
