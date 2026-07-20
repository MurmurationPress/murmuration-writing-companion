# Prose Story World relationship authoring smoke test

Use a backed-up vault, a recognised manuscript scene, a POV that resolves to an indexed Story World character, and a second indexed Story World entity that is not already referenced by a current relationship from this chapter.

## Existing-link boundary

1. Open a chapter that already contains recognised Story World wikilinks.
2. Confirm that merely opening the chapter creates no relationship prompt.
3. Confirm that a link to an ordinary non-Story-World note creates no prompt.
4. Confirm that a chapter without a recognised POV source creates no relationship prompt.

## Newly authored recognised link

In prose, create or materially edit a link to an indexed Story World entity, for example:

```markdown
Tobias did not see [[Crap Bot goes Viral|Crap Bot]] when everyone else did.
```

The Writing Companion should show one quiet **Story World authoring** card:

```text
What does this link mean here?
Tobias Hale → Crap Bot goes Viral
```

The author must be able to continue typing without responding. The card must not alter or replace the prose link.

## Just a reference

1. Choose **Just a reference**.
2. Confirm that no `world_relationships` entry is written.
3. If the target is not already in `world_context`, confirm that a separate World Context offer appears.
4. Choose **Not now** and confirm that chapter metadata is unchanged.

## Approved relationship

Create or edit a second recognised Story World link. In the prompt:

1. Choose one offered relationship phrase; no phrase should be selected automatically.
2. Review the complete sentence preview.
3. Leave status as **Confirmed**, or explicitly choose Planned, Candidate or Unresolved.
4. Choose **Record relationship**.

The recognised POV entity note should gain one entity-owned assertion similar to:

```yaml
world_relationships:
  - predicate: unaware_of
    target: "[[Crap Bot goes Viral]]"
    status: confirmed
    source: "[[Quiet Contact]]"
    as_of: "2029-06-28"
    scope: "[[PLURALITY]]"
    source_line: 12
    source_link: "[[Crap Bot goes Viral|Crap Bot]]"
```

Exact compact links, line number, date and scope depend on the vault. No subject is stored because the containing entity is the authoritative subject. No prose, summary, causality or other fact is inferred.

## Custom relationship

1. Create or edit another recognised Story World link.
2. Choose **Other…**.
3. Enter a readable phrase such as `conceals the event from`.
4. Confirm that the preview uses that phrase.
5. Record it and confirm that Markdown contains a stable `predicate` plus `predicate_label`.

## World Context separation

After recording or declining the relationship, the target may receive a second, separate offer:

```text
Add “Crap Bot goes Viral” to this chapter's World Context?
```

- **Add to World Context** appends one shortest unambiguous wikilink.
- **Not now** changes no chapter metadata.
- Existing entries, unresolved links and ordering remain present.
- An entity already in `world_context` must not be duplicated or offered again.

## Duplicate and stale-state safety

- Reopening the chapter must not prompt for old links.
- A current relationship carrying this chapter and source link as provenance must suppress a duplicate prompt after the link is materially edited.
- Recording the same predicate, target and story date must not append a duplicate assertion.
- Removing or changing the prose link before recording must block the write.
- Changing the POV before recording must block the write.
- Renaming or deleting the source or target note before recording must report the problem and leave Markdown unchanged.

## Exclusion boundary

New recognised links in YAML frontmatter, fenced code, inline code, HTML comments, Obsidian comments, embeds and escaped link syntax must not trigger relationship authoring.
