# Prose wikilink to Story World event smoke test

Use a backed-up vault and a disposable or genuinely new event name in a recognised manuscript scene.

## Old-link boundary

1. Open a scene that already contains an unresolved wikilink.
2. Confirm that merely opening the scene does not produce an event-creation offer.
3. Edit ordinary prose elsewhere in the scene.
4. Confirm that the old unresolved link still does not prompt.

## New unresolved prose link

1. Type a new prose link such as `[[The Ware Network Failure]]`.
2. Confirm that the manuscript text remains unchanged and typing can continue.
3. In the Writing Companion, confirm the quiet **Story World authoring** offer appears:
   - **Leave as ordinary link**
   - **Create as event**
4. Choose **Leave as ordinary link** once and confirm no Markdown other than the prose edit changes.
5. Type a second new unresolved link for the creation test.

No offer should be created for links in YAML frontmatter, fenced code, inline code, HTML or `%%` comments, embeds, escaped links, or resolved ordinary notes.

## Creation preview

1. Choose **Create as event**.
2. Confirm the preview shows:
   - event name;
   - exact proposed note path;
   - current chapter source;
   - owning-book scope when known.
3. Confirm no date option is preselected.
4. Test **Cancel** and confirm no event note is written.
5. Reopen the preview and explicitly choose one date mode:
   - the exact chapter date when offered;
   - another exact date;
   - undated.
6. Choose **Create event**.

## Created note

Confirm that:

- the event note is created at the path identified by the prose link;
- the original prose wikilink is unchanged and now resolves to the event note;
- the note contains only `world_entity: event`, `world_name`, available scope, current chapter source, the approved exact date when selected, and an editable placeholder;
- no status, summary, participant, relationship, causality or inferred fact is invented;
- the event becomes discoverable by the Story World index.

For an aliased link such as `[[WNF|Ware Network Failure]]`, the file should remain `WNF.md`, the canonical display name should be `Ware Network Failure`, and the prose link should not be rewritten.

## Separate World Context decision

After event creation, confirm a second offer asks whether to add the event to the chapter's World Context.

- **Not now** must leave chapter frontmatter unchanged.
- **Add to World Context** must append one shortest unambiguous wikilink to `world_context`.
- Existing entries, unresolved entries, ordering and unrelated frontmatter must remain intact.
- Repeating the action must not create a duplicate reference.
- Once added, the event should appear in World Context with its formatted date and relative chapter interval when both dates have day precision.

## Stale and collision safety

- Open the preview, then remove or change the source prose link. Creation must be blocked.
- Create a note or matching Story World event at the proposed destination before confirmation. Creation must be blocked without overwrite.
- A plain unresolved basename that collides with another Markdown filename must not create an event at an unrelated alternative path; edit the prose link to a path-qualified target instead.
- Changing the chapter date while a chapter-date preview is open must require reopening the preview.

## Git boundary

After successful creation and World Context addition, Git should show only:

- the manuscript prose link already typed by the author;
- the new minimal event note;
- the optional `world_context` update.

No editorial-store data should change.
