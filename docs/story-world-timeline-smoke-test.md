# Story World timeline real-vault smoke test

Use a disposable copy of the PRIME vault. Record the working-tree state of manuscript prose, editorial-store files, and Story World Markdown before starting.

1. Run **Open Story World timeline** from the command palette, then use the restrained timeline button in the Story World navigator. Confirm both reveal the same timeline tab rather than creating duplicates.
2. Confirm **Robin is Born** and **The Article** appear in oldest-first chronology based only on their explicit `world_time`. Add or identify a PRIME event with an exact date-time and offset; confirm its wall-clock time and precision display without timezone conversion.
3. Confirm a ranged event appears in **Ranges**, an approximate or otherwise unsupported structured event appears in **Approximate or unsupported times**, and an event without `world_time` appears in **Undated events**. Every event must remain discoverable.
4. Filter scope between two explicit PRIME book scopes. Exercise status and precision filters, including any custom values, and confirm clearing filters restores all events without changing Markdown.
5. Click an event and confirm its authoritative Markdown opens in a centre editor with focus. Click each explicit source beneath an event; confirm resolved sources open their authoritative note and broken links remain visibly marked unresolved.
6. Choose **Edit event time** on an event. Confirm the authoritative event note opens, the existing phase-one guided editor appears in the single Writing Companion inspector, and the timeline itself provides no direct write controls. Save a change and confirm the timeline refreshes immediately into the correct chronological position or group.
7. Compare the vault with the initial record. Confirm no manuscript prose, relationships, editorial-store data, filter state, or layout authority was written. Only an explicitly confirmed event-time edit may have changed Story World Markdown.
8. At a normal centre-pane width, confirm cards fill the available timeline column, event titles have their own prominent line, and a day-precision date remains on one line where practical. Confirm scope wikilinks display as readable names without brackets or paths.
9. Resize the timeline into a narrow split pane. Confirm the fixed spine remains narrow while cards stay usable, metadata wraps by complete precision/status/scope fields rather than single-word columns, and event titles, source buttons, and **Edit event time** remain accessible.

## Final event–scene map checks

Use representative events across PRIME Books 1 and 2: **Robin is Born**, **First Routing Intervention**, **Pip withdraws from PRIME**, one ranged or unsupported event, one undated event, an event with several `world_sources`, two events sharing a source scene, and one deliberately broken source link.

10. Switch **Presentation** between **Chronology** and **Event–scene map**, close and reopen the view, and confirm the choice is remembered only in this vault. Confirm scope, status, and precision filters select the same events in both presentations.
11. In the map, confirm exact events follow deterministic chronological order; ranges, year/month precision, unsupported values, and undated events remain visually distinct without invented coordinates.
12. Confirm every visual connection corresponds to an explicit `world_sources` entry. Verify several sources remain individually accessible, two events may connect to the same readable scene, and the broken source remains visibly attached as unresolved.
13. Click an event node and confirm its authoritative Markdown opens with centre-editor focus and the existing Writing Companion leaf refreshes to that entity inspector. Click a scene node and confirm its manuscript Markdown opens with centre-editor focus and the Companion returns to chapter context. Repeat both selections and confirm no duplicate Markdown tabs or Companion leaves appear and no stale inspector remains. Use Tab and Shift-Tab through graph nodes; confirm visible focus and connection emphasis work without requiring hover.
14. Hover and focus **First Routing Intervention** and its scenes, then a shared scene. Confirm only its derived event/source connections are emphasised and essential titles and links remain visible when nothing is hovered.
15. Confirm scene nodes use readable scene/chapter titles with restrained book or part context rather than filenames or raw wikilinks. Collapse and expand an event with a large source set and confirm every explicit link remains accessible.
16. Edit an event time through **Edit event time** and its existing preview/confirmation flow. Confirm chronology and map refresh together. Attempt no dragging: the map offers no gesture that changes dates, sources, graph positions, relationships, or manuscript order.
17. Add or inspect an explicit timeline-model assertion such as `precedes`, including an assertion that conflicts with dated order and one with an unknown predicate or qualifier. Confirm assertions appear separately, conflicts remain explained, and unknown details survive unchanged.
18. Repeat at wide and narrow centre-pane widths. Confirm the spatial lanes become a readable stacked connection layout without overlapping labels or one-word columns.
19. Recheck the vault diff and editorial storage. Confirm the presentation choice, filtering, highlighting, layout, graph routes, and derived chronology wrote no Markdown, manuscript prose, or editorial-store data.
