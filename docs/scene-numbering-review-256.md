# Review of pending numbering reconciliation

> Historical measurements of the former automatic writer. The current [manual Book reporting contract](manuscript-reporting-sequence.md) supersedes that lifecycle and series numbering.

Review follows draft #256 at `545eb79` against main `ac0c39b`. #252 remains open and #255 remains an unmerged draft. The coalescing change is sound for complete library snapshots, but the first head lacked cancellation on plugin unload. That lifecycle defect is corrected before merge.

## Queue invariants

- A request represents the complete current library, not a per-file delta. Replacing an unstarted snapshot therefore preserves all work required by the latest request, including cleanup for removed members. This would not be safe for deltas; the API still accepts only a complete library.
- `pending` refers only to a pass that has not started. The promise callback clears it before starting the serial pass. Requests during active I/O form a new pending batch; all callers of that batch receive the same completion promise. A request arriving during the second active pass can form a third batch.
- The active pass may finish an older snapshot. The latest pending pass then converges to the newest requested state. This is eventual convergence, not cancellation of already-started writes or proof that Obsidian supplied a current metadata snapshot.
- A failed pass rejects its callers, including all coalesced callers. The chain catches that rejection only to allow a later requested pass to run; it does not turn the failed callers' promises into success. A later complete snapshot repairs partially written reporting values. There is no new automatic retry: the coordinator logs real failures, and a later event, explicit rebuild or next startup retries. Latest-state failures are not silently treated as success.

## Lifecycle correction

The service now has terminal `dispose()`. It rejects new requests, rejects queued batches before scanning, and checks cancellation before each file, before starting host frontmatter processing, and inside the synchronous mutation callback. It also checks completion, so disposal after the final committed mutation is not reported as successful completion.

An already-committed host mutation cannot be revoked. An already-running host promise is allowed to settle; the service neither races another pass against it nor attempts rollback during unload. If disposal happens while host I/O waits but before its mutation callback, the callback throws the distinct cancellation error without changing properties. The following files and pending snapshots never run. Cancellation promises settle when the uninterruptible host operation settles; this is not a claim that hung host I/O can be forcibly aborted.

The integrity coordinator disposes its reporting service, clears pending paths/timers, and ignores late initialise/queue callbacks. The explicit reporting command owns a separate service for the command installation lifetime and registers its disposal with the plugin. It suppresses success notices and refreshes after disposal. Only the distinct lifecycle-cancellation error is suppressed; ordinary write failures remain reported. No metadata-change event suppression, click handling, field removal or structural migration is part of this PR.

## Evidence and validation

Regression tests exercise coalesced latest state, arrivals during first and later active passes, shared completion, partial failure/recovery, stale-field cleanup, unrelated metadata, legacy deferral, exact Undo, disposal before a pass, disposal inside delayed host I/O, and disposal after a committed mutation. An integrated test bundles the real coordinator with host class stubs and verifies that disposal cancels queued reporting and that late layout/metadata callbacks do not scan, publish or reschedule. Capture tests verify forwarding and restoration separately; none of these tests establishes live click behaviour.

The existing benchmark was rerun after lifecycle changes: the adversarial 1,000-scene schedule still performs two passes and 2,000 writes instead of 11/11,000, and ordinary-operation counts are unchanged. Original before/after measurements remain in `docs/measurements`; they describe the original coalescing head, not timings of the lifecycle amendment. New review measurements are recorded alongside this note.

Final validation and exact reviewed head are recorded in PR #256. Merge is conditional on passing Ubuntu and Windows CI for that same head, using a SHA-guarded merge. No release or deployment to the author vault is authorised or performed. A separately isolated disposable Obsidian instance is used only for the subsequent interaction investigation.

Local final validation: 925 TypeScript tests plus 8 build-tool tests pass; production/test TypeScript checks, build, bundle analysis/report, benchmark count assertions, release:check and diff checks pass. Reviewed lifecycle build is 705,732 raw / 195,751 gzip bytes, leaving 15,164 bytes below the unchanged hard ceiling. The early headroom warning remains. Review benchmark counts match the previous head exactly; the 1,000-scene backlog median is 4.017 ms (5.208 maximum), still synthetic rather than host disk latency.
