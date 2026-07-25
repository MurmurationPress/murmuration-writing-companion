# Story World Review

Issue #111 adds a read-only **Story World Review** workspace for deterministic maintenance findings derived from explicit Story World Markdown. Open it with the check-mark action in the Story World Navigator or the **Open Story World Review** command.

## Initial rules

The first rule set reports:

- unresolved explicit relationship targets and event participants;
- unresolved or malformed explicit source and scope references;
- canonical-name, alias and canonical-to-alias lookup collisions using the index's case-insensitive normalisation;
- incomplete relationship records, malformed authorial status and malformed explicit validity intervals;
- malformed or contradictory explicit event `world_time` values;
- notes that use `world_*` contract properties without declaring either `world_entity` or `world_model`;
- explicit timeline-order contradictions already supported by the shared temporal producer.

Undated events, omitted optional scope, unknown entity/model types, unknown predicates and unconventional properties remain valid. Ordinary Markdown that has not opted into the Story World contract is ignored. The review reads structured frontmatter only; it does not inspect prose, ordinary backlinks or approximate names.

## Observations and severity

Every finding uses the shared #129 `ContinuityObservation` contract: a namespaced kind, deterministic severity, exact property paths, structured evidence, rule version, lineage key and evidence fingerprint. Malformed required structure and unresolved relationship/event targets are conflicts where authority cannot settle; author-review questions use review severity; optional absence is omitted. Presentation wording does not determine severity or identity.

The workspace groups by severity and kind and filters by severity, kind and current-Book relevance. Global review works without a selected Book. Book-scoped filtering follows exact Scene `world_context` and explicit `world_scope` references; it does not guess relevance from folders or names.

Story World observations relevant to a Book through exact `world_context` references also enter Continuity Review with the same fingerprint and evidence identity. The #134 disposition model is reused there; Story World Review adds no separate dismissal or canon state. Global findings remain visible in Story World Review even when Continuity Review has no Book scope.

## Refresh and authority

The projection is rebuilt from the existing trash-aware Story World index and current metadata cache. Existing metadata, create, rename, deletion, local-trash restoration, index-rebuild and Book-selection refresh paths rerender it. No watcher or persisted diagnostic cache is added.

Story World and manuscript Markdown remain authoritative. Findings are derived and disposable. Viewing, filtering and navigating call no write service and never create, merge, rename, delete or repair a note. Rebuilding unchanged indexes produces materially equivalent findings.

## Deliberate limits

The initial rules remain conservative. They do not require optional provenance globally, infer mutually exclusive states, validate unknown predicate registries, analyse prose, or provide automatic repair. Path-based observation identity makes rename stability best-effort under the existing #129 contract; adopting permanent Story World identities is a separate architectural decision.

The [Story World Graph](story-world-graph.md) consumes current observation fingerprints only for restrained node, edge and incomplete-connection indicators. It does not re-run or reinterpret review rules, and its **Open review** action returns to this workspace's same observation identity.
