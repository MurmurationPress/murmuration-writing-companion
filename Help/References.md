# References

A Reference is an ordinary indexed Story World entity:

```yaml
world_entity: Reference
world_name: Greywater Hydrophone Log
reference_authors:
  - Venn, Mara
reference_title: Greywater hydrophone field log
reference_date: 2026
reference_publication: Pelagic Field Unit records
reference_publisher: Pelagic Field Unit
reference_volume: 7
reference_issue: 2
reference_pages: 14–19
reference_doi: 10.1177/example
reference_link: https://example.org/greywater-log
```

Type matching is case-insensitive. All citation fields are optional. Use the Reference creation/import workflow to parse a citation or DOI into an editable proposal, then confirm before writing.

The canonical container field is `reference_publication`, not `reference_journal` or `published_in`. The canonical URL field is `reference_link`, not `reference_url`. MWC still reads genuine older aliases such as `journal`, `publication`, `url`, and `link`, but new writing should use only the `reference_*` names in the example.

Use `world_sources` to connect a Reference or another entity to manuscript evidence. Reference tables and projections are derived views and do not become citation authority.
