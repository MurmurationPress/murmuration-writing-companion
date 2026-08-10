# Author-Facing Glossary

This plain-language glossary replaces the former implementation-led property audit as the author entry point. The audit's canonical schema is retained in the [Property Reference](Property_Reference.md), and its aliases, precedence, qualifiers, and preservation findings are retained in the [Developer and Legacy Appendix](Developer_and_Legacy_Appendix.md).

| Term | Meaning |
|---|---|
| Authoritative Markdown | Manuscript or Story World source that remains the final authored record. |
| Book | The top-level manuscript work recognised by `type: book`. |
| Chapter Context | The Scene editor for title, POV, Location, story date, status, editorial progress, and change summary. |
| Continuity Review | A derived Book-scoped queue of manuscript and relevant Story World observations. |
| Derived view | Rebuildable presentation such as World Context, Navigator, Graph, Timeline, review, impact, or a report. |
| Entity | A Markdown note opted into Story World with a non-empty scalar `world_entity`. |
| Entity Index | A generated, disposable report of explicit entity occurrences. |
| Location | A Story World entity whose `world_entity` is `location`; a selected Scene Location is stored in canonical `location`. |
| Part | An optional manuscript subdivision whose `parent` is a Book. |
| POV | The Scene viewpoint; a resolved indexed POV is also shown in derived World Context. |
| Provenance | Explicit evidence explaining why an entity or assertion exists, usually `world_sources` or assertion `source`. |
| Reference | An indexed entity containing optional canonical `reference_*` citation fields. |
| Relationship | A directional assertion stored in `world_relationships` or a supporting model. |
| Scene | A manuscript writing unit under a Book or Part. |
| `story_date` | Manuscript chronology: when a Scene occurs or reveals material. |
| Story World | The optional set of explicitly indexed entities and supporting models. |
| Story World Review | A read-only derived check of explicit structured Story World evidence. |
| Supporting model | A note opted in with `world_model`; vocabulary is open and specialised behaviour varies by model kind. |
| `world_context` | Broader explicit Story World relevance for a manuscript note, beyond semantic POV and Location. |
| `world_time` | Intrinsic fictional-world timing, principally for Events. |

Start with [Getting Started](Getting_Started.md), not the property tables.
