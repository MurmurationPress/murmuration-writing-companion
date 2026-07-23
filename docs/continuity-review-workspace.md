# Continuity Review workspace

**Status:** Implemented and real-vault validated

**Issue:** #132

Continuity Review is one reusable centre-pane workspace for the current
manuscript book. It presents current observations derived from authoritative
manuscript and Story World Markdown. It does not store observations or become
canon.

The primary entry point is the labelled **Continuity Review** button directly
below the selected-book control in the Manuscript navigator. It includes the
active finding count when non-zero. Book Review exposes the same workspace
through **Open Continuity Review** beside its book action. Both use the same
book-explicit activation service and reuse one tab. The command-palette command
remains available as an expert shortcut. A missing or structurally unsafe book
leaves the labelled action disabled with an explanatory tooltip.

## Selected-book scope

An observation belongs to the selected book when its primary manuscript note
or a canonical supporting manuscript note belongs to the book's authoritative
manuscript projection. A Story World-primary observation is included only when
that exact Story World path is reached through a structured `world_context`
reference in one of the book's chapters.

The workspace does not infer scope from prose, backlinks, folders, searches,
names or aliases. Global Story World maintenance observations with no direct
book association are excluded.

## Current producers

The collection boundary runs manuscript chronology once for a structurally
safe selected book, chapter-context continuity for every authoritative scene,
and existing Story World relationship and timeline observations only when the
direct selected-book scope rule admits their primary note. No new #111 rules
are introduced.

## Review and filtering

The default Active queue contains unresolved, stale and still-produced resolved
findings. Current intentional and deferred findings are Reviewed. Stale
findings return to Active. Disposition records without a current observation do
not create workspace items.

The first filter set is deliberately small: Queue, Type, one combined Location
filter for parts or chapters, and Entity only when relevant Story World values
exist. Severity remains visible and participates in deterministic ordering.

The list uses a location-first hierarchy: restrained part or entity context,
the readable affected-note title, a specific editorial finding, and a compact
review-state marker. Rows keep enough height for two or three meaningful lines.
Their height is content-driven rather than fixed, so long titles, findings and
state markers remain visible at narrow widths and increased zoom. The selected
row's open action occupies a separate column on wide panes and moves below the
text on narrow panes.
The selected row exposes a small **Open note** action; Enter opens its detail,
Ctrl/Cmd+Enter opens its primary note, and double-click also opens that note.

The detail pane begins with location, finding, explanation and one visually
primary navigation action before the shared disposition controls. Human
evidence is grouped as manuscript order, story dates, Story World source,
relationship validity, or scope and resolution. Deduplicated secondary notes
are quiet links. Rule IDs, fingerprints, property paths, order keys and
property-level navigation are support information rather than ordinary
editorial evidence. They are omitted by default. The plugin setting **Show
diagnostic information** reveals a collapsed **Diagnostic details** disclosure
and a structured **Copy diagnostics** action. Dispositions continue to use
portable schema-v3 editorial storage; the workspace adds no schema fields.

## Navigation and refresh

The Manuscript navigator and Continuity Review share one persisted,
authoritative book selection. Selecting a book in either surface immediately
updates the other. Opening Continuity Review from a different manuscript is
also an explicit selection and reuses the existing centre-pane tab. Opening
evidence uses another Markdown leaf and does not replace the review. Ordinary
note navigation never changes the shared book. **Return to manuscript** reveals
the selected book's most recent explicit manuscript context when that leaf
remains available, or opens that context in another Markdown tab.

Retargeting shows a restrained updating state. Collection requests carry a
generation token, so a late result from the previous book cannot replace the
new book's projection. Queue is preserved, and Type, Location and Entity are
preserved only when their values remain valid. Selection restarts at the first
item in deterministic queue order.

Metadata changes affecting the selected book or its observed evidence are
coalesced after Obsidian's metadata cache settles. Creates, deletes and renames
rebuild the live collection. Disposition changes rematch and rerender
immediately. There is no persisted or second authoritative observation cache.

Story World `world_time` interpretation is shape-aware across continuity,
Timeline and Entity Inspector consumers. A `shape: point` value requires one
valid `from` value and supported precision, not an end boundary. Precision is
expanded into a derived comparison envelope only while comparing evidence;
overlapping envelopes do not create false chronology conflicts. Only
`shape: range` requires both `from` and `to`, and malformed ranges retain
specific review findings. No derived boundary is written back to Markdown.

## Completed real-vault review

Testing against authored EMERGENCE and PLURALITY books confirmed the complete
selected-book, refresh and editorial workflow. Genuine continuity errors were
found in both books while intentional chronology remained reviewable through
the existing #134 dispositions.

The review exposed and corrected these implementation defects:

- the Manuscript navigator and workspace initially held independent book scope;
  `ManuscriptBookSelectionService` is now the sole authority, explicit changes
  synchronise both surfaces, and ordinary Markdown navigation does not retarget
  the review;
- late collection results and rapid retargets could detach the projection from
  the selected book; generation tokens now allow only the final request to
  publish;
- diagnostic-style rows obscured location and action; rows are now
  location-first and title-first, grow to their content, expose an obvious
  primary **Open…** action, and group readable author-facing evidence;
- icon-only discovery was insufficient; labelled entry points now appear in
  the Manuscript navigator and Book Review and reuse the same workspace tab;
- valid point-shaped Story World times were treated as incomplete ranges; the
  shared shape-aware interpretation now preserves point and range semantics;
- a changed Story World `world_scope` could leave an old scope observation in
  place because the first metadata event preceded the settled cache value;
  referenced dependencies now receive a coalesced settled-cache refresh and
  full recollection, so removed or reactivated observations update without a
  vault restart.

The final real-vault pass also confirmed that review selection, filtering,
navigation, observation generation and disposition actions never write
manuscript or Story World Markdown. Dispositions write only the existing
portable editorial store and its established atomic backup files.

## Boundaries

This implementation does not add global historical management, bulk actions,
new disposition states, #133 impact analysis, #135 reporting, durable Markdown
IDs or new #111 observation rules. Path-based rename stability remains
best-effort as defined by the observation and disposition contracts.
