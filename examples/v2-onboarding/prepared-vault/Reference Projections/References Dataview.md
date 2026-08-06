# References — Dataview

These native Dataview queries are read-only authoring and review projections. This support note deliberately lives outside both Story World and Manuscript authority.

## All References

```dataview
TABLE WITHOUT ID
  file.link AS Title,
  join(reference_authors, "; ") AS Author,
  reference_date AS Year,
  reference_publication AS "Journal / Publication",
  reference_volume AS Volume,
  reference_issue AS Issue,
  reference_pages AS Pages,
  choice(reference_doi, "https://doi.org/" + reference_doi, reference_link) AS "DOI / Link",
  join(world_sources, "; ") AS "Used in"
FROM "Story World"
WHERE lower(string(world_entity)) = "reference"
SORT choice(reference_authors, lower(join(reference_authors, "; ")), "￿") ASC, choice(reference_date, string(reference_date), "￿") ASC, lower(default(reference_title, default(world_name, file.name))) ASC, file.path ASC
```

## References used by The Greywater Signal

This example enumerates the Book's current authoritative Book, Part and Scene paths. Refresh the path set when Book membership changes.

```dataview
TABLE WITHOUT ID
  file.link AS Title,
  join(reference_authors, "; ") AS Author,
  reference_date AS Year,
  reference_publication AS "Journal / Publication",
  reference_volume AS Volume,
  reference_issue AS Issue,
  reference_pages AS Pages,
  choice(reference_doi, "https://doi.org/" + reference_doi, reference_link) AS "DOI / Link",
  join(world_sources, "; ") AS "Used in"
FROM "Story World"
WHERE lower(string(world_entity)) = "reference"
  AND (contains(file.inlinks, link("Manuscript/The Greywater Signal.md"))
    OR contains(file.inlinks, link("Manuscript/The Greywater Signal/Opening at Greywater.md"))
    OR contains(file.inlinks, link("Manuscript/The Greywater Signal/Listening.md"))
    OR contains(file.inlinks, link("Manuscript/The Greywater Signal/Listening/First Survey.md"))
    OR contains(file.inlinks, link("Manuscript/The Greywater Signal/Listening/Signal at Low Tide.md"))
    OR contains(file.inlinks, link("Manuscript/The Greywater Signal/Returning.md"))
    OR contains(file.inlinks, link("Manuscript/The Greywater Signal/Returning/Return to the Observatory.md"))
    OR contains(file.inlinks, link("Manuscript/The Greywater Signal/Returning/The Recorded Pattern.md"))
    OR contains(world_sources, link("Manuscript/The Greywater Signal.md"))
    OR contains(world_sources, link("Manuscript/The Greywater Signal/Opening at Greywater.md"))
    OR contains(world_sources, link("Manuscript/The Greywater Signal/Listening.md"))
    OR contains(world_sources, link("Manuscript/The Greywater Signal/Listening/First Survey.md"))
    OR contains(world_sources, link("Manuscript/The Greywater Signal/Listening/Signal at Low Tide.md"))
    OR contains(world_sources, link("Manuscript/The Greywater Signal/Returning.md"))
    OR contains(world_sources, link("Manuscript/The Greywater Signal/Returning/Return to the Observatory.md"))
    OR contains(world_sources, link("Manuscript/The Greywater Signal/Returning/The Recorded Pattern.md")))
SORT choice(reference_authors, lower(join(reference_authors, "; ")), "￿") ASC, choice(reference_date, string(reference_date), "￿") ASC, lower(default(reference_title, default(world_name, file.name))) ASC, file.path ASC
```
