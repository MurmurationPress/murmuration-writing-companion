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
