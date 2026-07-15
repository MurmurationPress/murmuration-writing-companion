# Editorial Enhancements Release Summary

This branch completes the implementation scope tracked by #78, excluding Story World entity creation.

- Review mode and status are controlled once at book level.
- Scene passes are represented by one ordered progress frontier.
- Existing history is retained and `editorial_pass` remains the Markdown reporting projection.
- POV is compact at rest and suggests indexed Story World characters while remaining permissive.
- Exact annotation navigation receives a transient locator.

Character creation from an unmatched POV remains tracked separately by #76 under Story World Authoring.
