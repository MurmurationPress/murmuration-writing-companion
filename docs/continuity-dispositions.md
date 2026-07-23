# Continuity dispositions

**Status:** Initial implementation
**Issue:** #134

Continuity dispositions are portable editorial workflow state. They are stored
in `.murmuration/writing-companion/editorial-data.json`; they never change
manuscript or Story World Markdown and never become continuity authority.

## Decisions and matching

Authors may mark a current observation **intentional**, **deferred** or
**resolved**, add a brief note, or return it to unresolved review. `unresolved`
means that no disposition record exists. `stale` is a derived match state and
is never stored.

Matching uses only the observation contract's identities:

- no stored lineage is unresolved;
- the same lineage and fingerprint keeps the decision current;
- the same lineage with a changed fingerprint is stale and returns to active
  review while retaining the prior decision and note for context;
- a stored lineage with no current observation is historical editorial state
  and does not fabricate an observation.

Rule version participates in the fingerprint, so a rule-version change returns
the observation for review. Descriptive paths and the review-summary snapshot
support historical explanation only and are never fallback identity.

## Queue behaviour

Current intentional and deferred findings are kept out of the default active
count and remain available through **Show reviewed**. A stale finding returns
to the active count. Marking a finding resolved records the author's belief
that it has been addressed, but the finding stays active while its producer
still emits it. Once it disappears the record is historical; if it later
reappears it is active again even when its fingerprint is unchanged.

The Writing Companion exposes these controls in the active chapter's World
Context Continuity block and in Book Review Continuity. This ticket does not
add the global Continuity Review workspace, broad filters, bulk actions or
historical-record management planned for #132.

## Portable storage and time

Schema version 3 adds one root-level record per lineage. Notes are NFC
normalised, use `\n` line endings, trim outside whitespace, store blank text as
`null`, and are limited to 500 Unicode code points. `firstReviewedAt` remains
fixed; `updatedAt` changes when the disposition, reviewed fingerprint or note
changes. Both use UTC ISO timestamps and never affect observation identity.

The existing atomic temporary-file publication, backup and recovery process
protects disposition records together with chapter notes, annotations, pass
history and book-review state. Removing disposition data makes unchanged
observations unresolved again.

## Rename limitation

Observation identity remains path-based. Rename handling updates descriptive
paths in stored editorial context on a best-effort basis, but does not rewrite
or guess hashed lineage and fingerprint identity. A source rename may therefore
make a surviving lineage stale, while a primary, book, part, scene or Story
World rename may create a new unresolved lineage and leave the old record as
history. Durable Markdown IDs are outside #134.

## Real-vault findings

Testing against an authored manuscript confirmed that the continuity rules find
genuine chronology errors and that deliberate flashbacks can be marked
intentional without changing manuscript Markdown. Reviewed findings remain
discoverable while leaving the active warning count.

The same testing exposed and corrected four integration defects:

- `story_day` is an independent manuscript property and no longer aliases
  `story_date`; canonical and legacy story-date aliases now use one shared,
  deterministic lookup;
- a sibling scene date change refreshes Book Review chronology after Obsidian's
  metadata cache settles;
- manuscript sequence and part-order changes refresh the same live projection;
- disposition changes refresh the Companion immediately, and stale findings
  disappear or reactivate without restarting Obsidian.

Compact cards now prefer the authoritative chapter `title`, show only directly
relevant scene or Story World actions, and reserve part names for restrained
cross-part or duplicate-title context. Full evidence and navigation targets
remain available to the future #132 workspace.
