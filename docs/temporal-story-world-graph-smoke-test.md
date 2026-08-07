# PRIME temporal Story World graph smoke test

Use a disposable copy of representative PRIME material. Record SHA-256 hashes for every fixture Markdown file and the portable editorial-store file before opening the graph. A useful fixture centres `PRIME` and includes `Pip`, `Tobias`, `JANUS`, `Divergent/Skip` and `UK Government`, with authoritative Scenes and Events where world chronology differs from reveal order, a relationship starts and later changes, an explicit contradiction or supersession occurs, the reader learns something before the centred entity, and one evidence item is deliberately undated.

## Cases

1. Open the existing graph with Temporal mode off and confirm its one-hop neighbourhood is unchanged.
2. Enable **Temporal mode**, centre on PRIME and record the labelled date, supporting Scene/Event and change count.
3. Step through every change point with **Previous change**, **Next change** and the manual slider. Confirm positions are evidence points rather than intervening calendar days.
4. Compare **World time**, **Entity knowledge** and **Reader knowledge** at representative points. Confirm world state follows story date, reader state follows distributed Book/Part/Scene order, and entity state includes only explicit participation, knowledge or context evidence.
5. Compare **Evidence at this date**, **Known by this date** and **Changes at this date**. Older current edges must subdue without disappearing; explicitly ended edges must leave later current state.
6. Capture screenshots of an introduction, cumulative older state, explicit ending, contradiction/supersession, an empty centred state and the undated-evidence indicator. Confirm text/line markers remain understandable without colour.
7. Inspect a visible temporal edge. Confirm source note, Scene/Event, effective date, manuscript sequence where available, entity/relationship, change type and explicit-versus-derived time are shown.
8. Centre on another entity, change Compact/Comfortable/Spacious density and traverse Back/Forward. Confirm the centre remains stable where possible, navigation remains one hop, node limits/truncation remain explicit, Event chevrons/entity shapes remain intact and provisional status remains dashed independently.
9. Test zero and one dated point. Confirm irrelevant controls disable with an explanation. Confirm a point selection survives perspective and display changes.
10. Restart Obsidian and rebuild indexes. Repeat representative states and compare all hashes. Temporal activation, movement, perspective/display changes, provenance inspection and rebuild must not write Story World Markdown, manuscript Markdown or editorial storage.

## Capture record

Record each case as **pass**, **partial**, **blocked** or **failed**, with fixture location, MWC commit, Obsidian version, platform, screenshots, before/after hashes and any discrepancy. A failure in date authority, manuscript order, centre/traversal, provenance or no-write behavior blocks review readiness.

The first version deliberately has no autoplay, animation, graph editing, automatic expiry, inferred mental state, Markdown write-back or publication rendering.
