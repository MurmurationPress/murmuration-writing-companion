## Inspect and propose the continuity observation contract

Work on GitHub issue #129 in the `MurmurationPress/murmuration-writing-companion` repository:

**Define the continuity observation and evidence contract**

Do not change code yet.

Inspect the existing architecture for:

* Story World indexing and validation;
* temporal observations;
* manuscript diagnostics;
* editorial review state;
* entity and note identity;
* date parsing and precision;
* existing diagnostic or warning types;
* tests covering deterministic derived state.

Also inspect the related issues and implementation where relevant:

* #64 — Temporal Reasoning foundations
* #82 — Manuscript structure and scene order
* #101 — calendar-aware relative event intervals
* #107 — Story World navigator and entity inspector
* #111 — deterministic Story World review observations
* #128 — Story World review and continuity

The goal is to define one shared typed contract for deterministic observations produced by Story World maintenance, temporal reasoning, and manuscript continuity checks.

The contract must support:

* a stable observation kind;
* severity: `information`, `review`, or `conflict`;
* the primary affected manuscript or Story World note;
* one or more supporting source notes;
* exact source property paths where evidence originated;
* a concise human-readable explanation;
* structured evidence values;
* navigation targets;
* a deterministic fingerprint for editorial disposition;
* the originating rule identifier and rule version.

It must distinguish clearly between:

* missing optional information;
* incomplete required structure;
* a possible review concern;
* an explicit contradiction;
* stale review state caused by changed evidence.

Important design constraints:

* Markdown remains authoritative.
* Observations are derived and disposable.
* Rules must never edit manuscript or Story World Markdown.
* The same indexed Markdown must reproduce equivalent observations.
* Fingerprints must derive from rule identity and authoritative evidence, not display wording.
* Normal display-text changes should not invalidate editorial dispositions.
* Renaming a note through normal Obsidian link updates should not unnecessarily invalidate an observation.
* Unknown properties and unconventional Story World notes must remain valid.
* Do not introduce prose analysis, probabilistic inference, or automated correction.
* Avoid creating parallel diagnostic models where an existing abstraction can be generalised.

Produce a concise implementation proposal containing:

1. Relevant existing files and types.
2. Any current diagnostic models that should be reused, adapted, or retired.
3. The proposed TypeScript types.
4. The proposed fingerprint strategy.
5. How note identity and property paths should be represented.
6. How evidence values should be normalised deterministically.
7. How malformed or unresolved source values should be represented.
8. A migration path for #111 observations.
9. The tests required.
10. Any architectural risks or unresolved decisions.

Do not implement until the proposal has been reviewed.


## Implementation proposal for #129

  The repository has several deterministic projections and diagnostic shapes, but no shared observation contract
  yet. The proposal is to introduce one domain-level observation model, adapt existing diagnostics into it at
  subsystem boundaries, and use it directly for all new #111/#128 rules.

  No code was changed.

  ### 1. Relevant existing files and types

  - src/story-world/StoryWorldIndex.ts
      - StoryWorldDocument
      - StoryWorldEntityRecord
      - StoryWorldIndex
      - parseWikilink
      - Retains the complete cloned frontmatter in properties.
      - Index identity is currently vault path; names and aliases are lookup keys, not unique identities.

  - src/story-world/ObsidianStoryWorldIndex.ts
      - Resolves wikilinks through Obsidian before falling back to unique indexed names/aliases.
      - Handles create, metadata change, deletion, and rename deterministically.

  - src/story-world/WorldTime.ts
      - Parses point/range world_time.
      - Supports declared and inferred precision.
      - Currently returns null for most malformed or unusable values, losing the reason and exact property
        location.

  - src/story-world/WorldRelativeTime.ts
      - Implements deterministic Gregorian civil-date arithmetic.
      - Correctly avoids timezone-based date shifting and refuses to manufacture day precision.

  - src/story-world/StoryWorldEventSceneGraph.ts
      - TimelineAssertionProjection already exposes explicit chronology conflicts.
      - Its IDs are path/index/display-oriented and are not suitable as disposition fingerprints.

  - src/story-world/EntityRelationships.ts
      - EntityRelationshipProjection distinguishes valid and incomplete assertions.
      - Preserves unknown qualifiers and raw values.
      - issue: string | null should eventually be produced from or accompanied by shared observations.

  - src/story-world/WorldContext.ts
      - WorldContextResult separately reports unresolved references and an invalid-reference count.
      - It currently loses per-value property paths and structured malformed evidence.

  - src/manuscript/ManuscriptOrder.ts
      - ManuscriptOrderDiagnosticKind
      - ManuscriptOrderDiagnostic
      - The closest existing diagnostic abstraction, but too narrow: optional fields, evidence, severity, rule
        version, navigation, and fingerprints are absent.

  - src/manuscript/ManuscriptMetadata.ts
      - Recognises property aliases for manuscript metadata.
      - Alias lookup currently returns values without retaining the actual source key, which continuity evidence
        will require.

  - src/editorial/EditorialNote.ts, src/editorial/EditorialPass.ts, and src/editorial/PortableEditorialStorage.ts
      - Editorial state is separate, portable, schema-versioned, and migrated defensively.
      - Page records move on Obsidian rename.
      - This is the appropriate storage boundary for future dispositions, but observations themselves must not be
        stored there.

  - Existing deterministic test foundations:
      - tests/StoryWorldIndex.test.ts
      - tests/WorldTime.test.ts
      - tests/WorldRelativeTime.test.ts
      - tests/ManuscriptOrder.test.ts
      - tests/EditorialPass.test.ts
      - tests/PortableEditorialStorage.test.ts

  This matches the direction of #64 (https://github.com/MurmurationPress/murmuration-writing-companion/issues/64),
  #101 (https://github.com/MurmurationPress/murmuration-writing-companion/issues/101), #107
  (https://github.com/MurmurationPress/murmuration-writing-companion/issues/107), #111
  (https://github.com/MurmurationPress/murmuration-writing-companion/issues/111), and the parent milestone #128
  (https://github.com/MurmurationPress/murmuration-writing-companion/issues/128).

  ### 2. Existing models to reuse, adapt, or retire

  Reuse:

  - Story World indexed records as authoritative read-only inputs.
  - Obsidian wikilink resolution.
  - Existing temporal parsing and civil-date arithmetic.
  - Portable editorial storage and its migration approach.
  - Actual frontmatter property aliases discovered during parsing.

  Adapt:

  - ManuscriptOrderDiagnostic should become a compatibility projection of ContinuityObservation, or manuscript
    order should emit the shared contract directly.

  - EntityRelationshipProjection.issue, WorldContextResult.unresolvedReferences, and
    TimelineAssertionProjection.conflict should eventually be backed by shared observations.

  - Date parsing should return a structured parse result, including malformed/unsupported states, instead of only
    value | null.

  Retire over time:

  - Ad hoc path/index IDs used as persistent diagnostic identity.
  - Bare message, issue, or unresolved-string arrays as the only representation of a finding.
  - Boolean/count-only malformed state when exact source evidence is available.

  UI presentation types can remain local; they should consume the shared domain observation rather than become
  persistence contracts.

  ### 3. Proposed TypeScript types

  Place these in a neutral domain module such as src/observations/ContinuityObservation.ts.

```typescript
 export type ObservationSeverity =
    | "information"
    | "review"
    | "conflict";

  export type ObservationClassification =
    | "optional_missing"
    | "required_incomplete"
    | "review_concern"
    | "contradiction";

  export type NoteRole = "manuscript" | "story_world";

  export interface NoteIdentity {
    readonly role: NoteRole;
    readonly path: string;             // Current navigation locator
    readonly stableKey: string;        // Fingerprint identity
    readonly displayName?: string;     // Presentation only
  }

  export type PropertyPathSegment = string | number;

  export interface SourcePropertyPath {
    readonly note: NoteIdentity;
    readonly segments: readonly PropertyPathSegment[];
  }

  export type ObservationEvidenceValue =
    | { readonly kind: "missing" }
    | { readonly kind: "null" }
    | { readonly kind: "boolean"; readonly value: boolean }
    | { readonly kind: "number"; readonly value: string }
    | { readonly kind: "string"; readonly value: string }
    | { readonly kind: "date"; readonly value: string; readonly precision: string }
    | {
        readonly kind: "resolved_note";
        readonly note: NoteIdentity;
        readonly authoredReference?: string;
      }
    | {
        readonly kind: "unresolved_reference";
        readonly authoredReference: string;
        readonly reason: "missing" | "ambiguous" | "not_indexed";
      }
    | {
        readonly kind: "malformed";
        readonly raw: DeterministicValue;
        readonly reason: string;
      }
    | {
        readonly kind: "list";
        readonly values: readonly ObservationEvidenceValue[];
      }
    | {
        readonly kind: "object";
        readonly entries: Readonly<Record<string, ObservationEvidenceValue>>;
      };

  export type DeterministicValue =
    | null
    | boolean
    | string
    | readonly DeterministicValue[]
    | Readonly<Record<string, DeterministicValue>>;

  export interface ObservationEvidence {
    readonly role: string;
    readonly source: SourcePropertyPath;
    readonly value: ObservationEvidenceValue;
  }

  export type NavigationTarget =
    | {
        readonly kind: "note";
        readonly note: NoteIdentity;
      }
    | {
        readonly kind: "property";
        readonly source: SourcePropertyPath;
      };

  export interface ContinuityObservation {
    readonly kind: string;
    readonly severity: ObservationSeverity;
    readonly classification: ObservationClassification;

    readonly primary: NoteIdentity;
    readonly sources: readonly NoteIdentity[];
    readonly evidence: readonly ObservationEvidence[];

    readonly explanation: string;
    readonly navigation: readonly NavigationTarget[];

    readonly rule: {
      readonly id: string;
      readonly version: number;
    };

    readonly lineageKey: string;
    readonly fingerprint: string;
  }

```

  kind and rule.id should use namespaced stable identifiers, for example:

  kind: "story-world.event.missing-time"
  rule.id: "mwc.story-world.event-time-required"
  rule.version: 1

  kind describes the observation category. rule.id identifies the producing algorithm. They may coincide initially
  but should not be assumed interchangeable.

  lineageKey associates successive versions of the same logical concern. It excludes evidence values. This is what
  permits a prior disposition to be reported as stale when current evidence produces a different fingerprint.

  Staleness should not be an observation severity. It is a comparison state:

```typescript
  export type ObservationDispositionMatch =
    | { readonly state: "current"; readonly observation: ContinuityObservation }
    | {
        readonly state: "stale";
        readonly observation: ContinuityObservation;
        readonly previousFingerprint: string;
      }
    | { readonly state: "undisposed"; readonly observation: ContinuityObservation };
```
  ### 4. Fingerprint strategy

  Build a canonical fingerprint payload containing only:

  - fingerprint schema version;
  - rule ID and rule version;
  - stable observation kind;
  - classification;
  - primary stableKey;
  - canonical structured evidence, including source roles and property paths.

  Exclude:

  - explanation text;
  - display names and labels;
  - severity, if severity is treated as presentation/policy rather than changed evidence;
  - navigation paths where a stable note key is available;
  - UI grouping, ordering, and disposition state.

  Example:
```typescript
  {
    schema: 1,
    rule: ["mwc.temporal.event-after-scene", 1],
    kind: "temporal.event.after-scene",
    classification: "contradiction",
    primary: "manuscript:book-key/scene-key",
    evidence: [...]
  }
```
  Canonicalisation rules:

  - object keys sorted by Unicode code point;
  - arrays preserved when order is authoritative;
  - set-like inputs deduplicated and sorted by their canonical encoding;
  - no undefined, NaN, infinities, locale formatting, or platform paths;
  - strings normalised to NFC, with interpretation-specific trimming performed before evidence construction;
  - hash the canonical UTF-8 representation and prefix its schema, e.g. obs-v1:<sha256-base64url>.

  Because Web Crypto SHA-256 is asynchronous, either observation production becomes asynchronous at the final
  fingerprinting boundary or a small audited synchronous SHA-256 implementation is introduced. Do not use
  JSON.stringify alone or a weak path-based slug as a persisted fingerprint.

  ### 5. Note identity and property paths

  Separate current location from fingerprint identity:

  - path is the current vault-relative Markdown path and is used only for navigation.
  - stableKey is used in lineage keys and fingerprints.
  - Display names are never identity.

  Recommended stable-key hierarchy:

  1. An explicit durable Markdown identity property, if the project accepts one.
  2. For Story World notes, a deterministic semantic key from normalised world_entity plus explicit world_name.
  3. For manuscript notes, owning-book identity plus explicit note identity/title and structural role.
  4. Fall back to canonical vault path only when no unambiguous semantic identity exists.

  If semantic candidates collide, they must not be guessed. Fall back to path-qualified identity and expose the
  duplicate as its own review observation.

  Property paths should be segment arrays, not dotted strings:

  ["world_relationships", 2, "valid_from"]
  ["world_time", "precision"]
  ["world_context", 1]

  This safely represents keys containing dots, brackets, or unconventional names. A JSON Pointer can be derived for
  display/export, but the segment array is the contract.

  Evidence must record the actual property spelling found in Markdown, not merely the canonical alias name.

  ### 6. Deterministic evidence normalisation

  - Preserve scalar types; do not coerce "1" into 1.
  - Encode finite numbers using a single canonical decimal representation.
  - Convert Obsidian/YAML Date objects to ISO text without locale formatting.
  - Parse temporal values into explicit date components and precision; never hash a human-readable date.
  - Resolved wikilinks hash the destination stableKey, not link display text or current target path.
  - Preserve authored link text separately only when it materially explains malformed or unresolved evidence.
  - Normalise strings to NFC and apply only the trimming/case rules defined by the relevant property contract.
  - Preserve list order where YAML order is meaningful, such as manuscript sequence and assertion indices.
  - Sort only collections explicitly defined as set-like, such as supporting-note sets.
  - Sort object keys, including unknown qualifier/property keys.
  - Exclude Obsidian cache artefacts such as position.
  - Never include rendered explanation strings.

  Unknown properties remain valid. They enter evidence only when a rule explicitly uses them.

  ### 7. Malformed and unresolved values

  Malformed and unresolved values must remain distinguishable:

  - missing: the property or required list member does not exist.
  - malformed: a value exists but has the wrong structure or invalid syntax.
  - unresolved_reference: a syntactically valid reference cannot be resolved.
  - null: explicitly present YAML null.
  - Unsupported but well-formed values should use a specific rule-level reason rather than being silently labelled
    malformed.

  Each carries:

  - the owning note;
  - exact property path;
  - deterministically normalised raw value where available;
  - a stable machine-readable reason;
  - optional authored reference text.

  This will require parsing APIs to expose result unions such as:
```typescript
  type ParsedSource<T> =
    | { readonly state: "valid"; readonly value: T }
    | { readonly state: "missing" }
    | { readonly state: "malformed"; readonly raw: DeterministicValue; readonly reason: string }
    | { readonly state: "unsupported"; readonly raw: DeterministicValue; readonly reason: string };
```
  ### 8. Migration path for #111

  #111 (https://github.com/MurmurationPress/murmuration-writing-companion/issues/111) is still open and has no
  persisted observation implementation to migrate.

  Recommended sequence:

  1. Add the shared contract, canonical evidence encoder, fingerprint builder, and disposition matcher.
  2. Convert one existing Story World maintenance condition:
      - preferably incomplete relationship assertion or unresolved Story World link;
      - this exercises nested property paths and malformed evidence.

  3. Convert one temporal condition:
      - preferably explicit chronology assertion versus world_time;
      - this exercises multiple notes, precision-aware dates, and contradictions.

  4. Implement every #111 rule directly as ContinuityObservation.
  5. Keep temporary adapters for existing UI shapes:
      - ManuscriptOrderDiagnostic
      - relationship issue
      - world-context unresolved summaries
      - timeline conflict strings.

  6. Once all consumers use observations, narrow or remove the parallel diagnostic fields.
  7. Add disposition storage only under #134, keyed by fingerprint and retaining lineageKey for stale-state
     detection.

  Existing editorial JSON must not begin storing derived observations.

  ### 9. Required tests

  Contract and fingerprint tests:

  - identical indexed Markdown produces deeply equivalent observations and fingerprints across rebuilds;
  - input iteration order does not affect output ordering or set-like evidence;
  - changed explanation/display text leaves fingerprints unchanged;
  - changed severity policy alone leaves fingerprints unchanged;
  - changed authoritative evidence changes the fingerprint;
  - rule-version changes change the fingerprint;
  - property-path changes change the fingerprint;
  - multiple supporting notes and properties are encoded deterministically;
  - equivalent resolved wikilinks with different display aliases produce the same fingerprint;
  - ordinary note rename plus normal link updates preserves the fingerprint when stable identity is available;
  - ambiguous identity falls back safely without merging observations;
  - duplicate observations do not collide.

  Classification tests:

  - missing optional information → information / optional_missing;
  - missing required structure → review / required_incomplete;
  - possible concern → review / review_concern;
  - explicit contradiction → conflict / contradiction;
  - prior disposition plus changed fingerprint and matching lineage → stale.

  Evidence tests:

  - malformed scalar, list, mapping, date, and precision values;
  - unresolved, ambiguous, and non-indexed wikilinks;
  - exact nested array/property paths;
  - YAML Date versus string normalisation;
  - unknown properties remain indexed and do not create observations unless a rule consumes them;
  - cyclic or non-serialisable cache objects are rejected before fingerprinting.

  Integration tests:

  - one Story World maintenance rule;
  - one temporal conflict rule;
  - manuscript-order diagnostic adapter;
  - rebuilding after delete/recreate;
  - editorial disposition survives display-text changes and eligible renames;
  - changed evidence does not silently inherit the old disposition.

  ### 10. Architectural risks and unresolved decisions

  The main unresolved decision is durable note identity.

  The current architecture has only vault paths plus non-unique names/aliases. It is impossible to guarantee both
  collision-free rebuilt fingerprints and rename stability for every existing note without some durable
  authoritative identifier.

  My recommendation is an optional, generic Markdown identity such as mwc_note_id, with these constraints:

  - it is not required for a note to remain valid;
  - observation rules never add or change it;
  - new authoring workflows may create it when creating a note;
  - existing notes use semantic identity where unambiguous and path fallback otherwise;
  - duplicate IDs become explicit conflict observations.

  This should be reviewed carefully because it extends the Markdown convention. If no explicit ID is accepted,
  rename stability must be documented as best-effort rather than guaranteed.

  Other risks:

  - Temporal parsing is currently duplicated between WorldTime, WorldRelativeTime, and event-time editing. Shared
    observations could expose inconsistent malformed-value classifications unless parsing is consolidated first.

  - Array indices provide exact YAML paths but dispositions can become stale after unrelated insertion/reordering.
    Longer term, structured assertions may need explicit assertion IDs; until then, lineage construction should use
    canonical assertion content where possible, with index retained only for navigation.

  - StoryWorldIndex currently indexes only world_entity, while #111 also mentions supporting models. A shared
    document projection may need to cover both world_entity and world_model without weakening either opt-in
    contract.

  - Severity policy may evolve independently from evidence. Excluding severity from fingerprints preserves
    dispositions across ordinary policy changes; including it would create avoidable staleness.

  - Fingerprinting must not become UI-specific or depend on Obsidian cache order.
  - Observations need a single deterministic final sort, preferably by severity rank, kind, primary stable key,
    then fingerprint, so every review and report surface agrees.
