# Relationships

Use Entity Inspector or MWC's relationship offer to add an assertion. The containing entity is the subject; the assertion records a predicate and either a linked target or literal value.

```yaml
world_relationships:
  - predicate: works_for
    target: "[[Pelagic Field Unit]]"
    status: confirmed
    source: "[[First Survey]]"
```

- **Predicate** describes the direction, such as `works_for`, `located_in`, or `knows_about`. The registry is open, so custom predicates are valid; add `predicate_label` when a readable label helps.
- **Target** is one complete wikilink. Use `value` instead for a string, number, or boolean fact.
- **Status** is assertion-level authorial status. Guided editing offers `confirmed`, `planned`, `candidate`, and `unresolved`; superseding writes `superseded`.
- **Source** is assertion-specific provenance and is distinct from the containing note's `world_sources`.

Entity-level `world_status` classifies the note's core identity. Relationship `status` classifies one assertion. `confidence` describes in-world confidence, not authorial canon status.

Use **Supersede** when an assertion should remain as history but no longer be current. MWC preserves qualifiers such as validity, knowledge boundaries, perspective, confidence, visibility, scope, and replacement history. The complete compatibility matrix is in the [Developer and Legacy Appendix](Developer_and_Legacy_Appendix.md); normal authoring does not require every qualifier.
