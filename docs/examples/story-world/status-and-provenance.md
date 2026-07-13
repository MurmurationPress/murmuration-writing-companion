# Canon status and provenance examples

These fragments illustrate the canonical status vocabulary. They are schema examples only and do not independently establish PRIME Trilogy canon.

## Confirmed

```yaml
world_entity: character
world_name: Tobias Hale
world_status: confirmed
world_sources:
  - "[[Quiet Load]]"
world_first_appearance: "[[Quiet Load]]"
```

Confirmed means the author currently treats the entity and its core identity as settled.

## Planned

```yaml
world_entity: event
world_name: Later institutional review
world_status: planned
world_status_note: Intended for a later volume; outcome remains revisable.
```

Planned material represents a current direction but must not be presented as confirmed.

## Candidate

```yaml
world_entity: location
world_name: Candidate meeting site
world_status: candidate
world_status_note: One of several possible settings for the scene.
```

Several candidates may coexist without any folder order or filename implying preference.

## Unresolved

```yaml
world_entity: concept
world_name: Meaning of apparent inhibition
world_status: unresolved
world_scope: "[[JANUS Monitoring]]"
world_sources:
  - "[[JANUS Monitoring]]"
world_status_note: Reduced visibility may indicate containment, displacement, latency or measurement loss.
```

Unresolved records deliberate ambiguity. It is not the same as an omitted status.

## Superseded

```yaml
world_entity: concept
world_name: PRIME as controlling agent
world_status: superseded
world_replaced_by: "[[PRIME as distributed preference]]"
world_sources:
  - "[[JANUS Monitoring]]"
world_status_note: Replaced by the distributed, pressure-sensitive interpretation.
```

Superseded material remains discoverable but is no longer presented as current.

## Confirmed uncertainty

```yaml
world_relationships:
  - predicate: believes
    value: containment remains unconfirmed
    asserted_by: "[[JANUS]]"
    status: confirmed
    confidence: low-moderate
    source: "[[JANUS Monitoring]]"
    as_of: "2029-01-20"
```

This means the author confirms that JANUS holds an uncertain assessment. It does not convert JANUS’s belief into objective world truth.

## Replacement history

Current item:

```yaml
world_status: confirmed
world_replaces:
  - "[[Earlier PRIME model]]"
```

Historical item:

```yaml
world_status: superseded
world_replaced_by: "[[Current PRIME model]]"
```

Either direction may exist independently. MWC must tolerate unresolved or one-sided replacement links without altering either note.
