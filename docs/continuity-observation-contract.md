# Continuity observation and evidence contract

**Status:** Foundation implementation

**Issue:** #129

Continuity observations are disposable projections of authoritative manuscript
and Story World Markdown. Rules read indexed Markdown and never edit notes,
store canon, analyse prose or propose automatic corrections.

## Observation shape

Each observation has:

- a stable, namespaced kind;
- severity: `information`, `review` or `conflict`;
- classification: `optional_missing`, `required_incomplete`,
  `review_concern`, `contradiction`, `malformed_evidence` or
  `unresolved_evidence`;
- one primary resolved note;
- structured evidence with a resolved source note and exact property-path
  segments;
- a concise summary and fuller explanatory text;
- a versioned rule identity;
- a lineage key and evidence fingerprint.

Supporting-note and default-navigation collections are derived from evidence.
They are not duplicated in every producer.

Property paths are arrays of string and numeric segments, for example
`["world_relationships", 2, "valid_from"]`. This represents unconventional
property names without treating dots or brackets as syntax.

## Evidence and canonicalisation

Evidence distinguishes missing, ordinary (including explicit null, booleans,
numbers, strings, ordered lists and objects), precision-aware date,
resolved-note, unresolved-link, malformed and unsupported values. Malformed
and unsupported evidence retain a normalised raw value and a stable
machine-readable reason. Human explanation text is not a reason code.

Canonical values preserve scalar types and authoritative array order. Object
keys are sorted, strings use Unicode NFC, negative zero becomes zero, dates use
ISO text, Obsidian `position` metadata is omitted, and non-finite numbers,
cycles, symbol properties, non-plain objects and unsupported runtime values are
rejected. Sparse arrays and object keys that collide after NFC normalisation are
also rejected rather than encoded ambiguously. Collections are sorted and
deduplicated only when a producer declares them set-like. The observation's
supporting evidence collection is such a set, and the builder returns it in
canonical order; ordered lists inside an evidence value are not. Unknown
Markdown properties remain valid and affect an observation only when a rule
explicitly uses them.

## Identity, lineage and fingerprints

The contract uses the repository's current resolved vault path as note
identity. Display labels are presentation only. Rename stability is therefore
best-effort: normal Obsidian link updates keep resolution correct, but a path
change can change a lineage key and fingerprint. Permanent note identifiers are
a separate architectural decision.

Lineage contains rule ID, observation kind, primary note path and a producer's
logical occurrence identity. Producers derive that identity from the owning
property context and the assertion fields that identify the logical subject,
not its current array index. Structurally identical occurrences receive a
zero-based ordinal within their identical group so that genuine duplicates do
not collapse. Inserting a different assertion therefore leaves existing
lineages stable; reordering indistinguishable duplicates cannot give either
copy a stronger identity than its deterministic ordinal. Lineage excludes
evidence and rule version, allowing a later editorial workflow to recognise
changed evidence for the same logical concern.

The fingerprint additionally contains rule version, classification and all
authoritative evidence used by the rule. It excludes summary and explanation
text, display labels, severity and UI state. Presentation wording and
severity-policy changes therefore do not invalidate it; authoritative evidence
and rule-version changes do.

Exact evidence paths still include current array indices for explanation and
navigation. Moving an assertion can therefore change its current fingerprint
even when its lineage remains stable. This records the authoritative source
location without making that location the logical occurrence identity.

Both identifiers use a canonical encoding and a small synchronous dual FNV-1a
hash. The hash provides compact deterministic identity, not a security
boundary.

## Initial producers

- Incomplete `world_relationships` structures produce `review` /
  `required_incomplete` observations for absent required fields and
  `malformed_evidence` observations for invalid shapes, while retaining their
  exact raw assertion and property path.
- Explicit timeline assertions whose ordering contradicts supported point
  `world_time` values produce `conflict` / `contradiction` observations citing
  the model assertion, both resolved events and both precision-aware time
  properties. Different precisions are not treated as directly comparable, so
  the rule does not manufacture a contradiction from overlapping partial dates.

Neither producer writes Markdown or editorial storage. Disposition persistence
and broad parser consolidation remain outside #129.

## Deferred work

The remaining Story World maintenance rules belong to #111. Chapter-context
temporal evaluation belongs to #130, manuscript chronology drift to #131, the
review interface to #132, and persisted editorial dispositions and stale-state
matching to #134. None of those concerns changes Markdown authority or belongs
in this foundation contract.
