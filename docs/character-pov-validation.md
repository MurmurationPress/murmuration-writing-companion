# #276 — Character-first POV workflow validation

## Root cause and design

Character creation already allowed a missing profile. The creation modal exposed
an optional profile link, but the Entity Inspector only displayed nonempty typed
properties: authors who created the character first had no guided association
control. This was a missing authoring path, not a schema dependency.

The Inspector now offers optional selection, explicit association, change/removal,
profile navigation and contextual profile creation. The existing entity creation
modal accepts initial typed properties/template, locks the requested kind for this
entry point, and retains its normal preview, collision checks and explicit Create.
A separate confirmation retains the original character even after navigation.
Directly associated scoped profiles are labelled explicitly: their established
behaviour is to apply directly, independently of automatic Book matching.
Book development is disclosed separately, with an authoritative manuscript Book
picker and base-first guidance preview. Editing opens the exact layer’s Markdown
note. Profile connections expose parent, extensions and directly associated
characters; inherited character connections are reachable through the parent.

Authority remains the character’s `pov_profile`, profile `pov_extends`, and
`world_scope`. No schema, migration, second store, generated association or Scene
rewrite. Existing index/link resolution, templates, manuscript projection,
`resolvePovProfileChain`, Obsidian frontmatter processing and Inspector refresh
mechanisms are reused. Property writes reject changed associations and changed
owner types. Missing targets and persistence failures give feedback without
optimistically changing authoritative state. Unrelated properties and character
prose are retained; only explicit association changes touch a character note.
This follows Constitution Articles I, II, IV, VII and IX.

MWC-009/026/027/028 were read from the Murmuration Docs feature catalogue. #52 is
supporting-model foundation history, not a new dependency for this implementation.
The worked author guide is prepared in [character-first-pov.md](character-first-pov.md)
for incorporation into Murmuration Docs, including the published-0.20.0 workaround.
The sibling Docs repository is not modified by this PR.

## Automated qualification

- `npm ci`; `npm test`: **1,032 TypeScript tests + 17 tooling tests**, all pass.
- Test and production TypeScript checks pass (test/build scripts respectively).
- `npm run build`, `npm run release:check`, `npm run bundle:analyze`,
  `npm run bundle:report`, `git diff --check`: pass.
- Six new focused tests cover independent character creation, optional profile
  creation before confirmation, retrospective association/change/removal,
  optimistic stale guards and invalid targets, preserved unrelated properties,
  existing/deleted/renamed legacy links, existing Book-extension templates and
  cross-Book Chapter Context resolution. Existing POV inheritance, scoped-profile,
  ambiguity/cycle, creation and World Context coverage remains intact.
- No dependencies, version changes or publication/deployment steps.

## Bundle

| Asset | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| main.js | 706,815 | 200,591 |
| styles.css | 64,687 | 10,424 |
| manifest.json | 277 | 185 |
| Total | 771,779 | 211,200 |

JavaScript adds 6,457 raw / 2,023 gzip bytes over merged 0.20.0. CSS adds 215 raw / 43 gzip bytes for narrow-pane wrapping and readable guidance.
The 720,896-byte hard ceiling and 669,696-byte warning remain unchanged; raw JS
headroom is 14,081 bytes. The existing 50-KiB headroom target remains unmet (#252).

## Native evidence and limits

The replay script is `scripts/diagnostics/verify-character-pov.mjs`. It creates a
new disposable synthetic vault/profile, installs the candidate’s three built
assets together, guards the vault identity, and terminates only its own Obsidian
process. The [checked-in JSON](character-pov-native-evidence.json) records the actual native environment and completed
checks. This is native Linux Obsidian DOM/application activation through CDP,
including the actual Obsidian editor API; it is not physical pointer/keyboard,
screen-reader, Windows/macOS/mobile or popout acceptance.

No live vault or private manuscript was used. Feature acceptance remains subject
to independent review and Ted’s local interaction testing. Guidance is authored
Markdown with additive precedence, not automatic prose analysis or field merging.
Ordinary Obsidian link-update settings govern rename repair. A missing link can
be replaced with the renamed profile through the selector.

## Local acceptance

1. Create a character without a profile. Associate an existing profile, change it,
   remove it, and check that no profile is deleted.
2. Create a profile from the character; cancel once, then create and confirm.
   Switch Scene focus before confirming and verify the original character changes.
3. Select two Books. Create/edit an extension for one; check inherited guidance,
   parent/extension/character navigation and unchanged base guidance.
4. Select the character as Scene POV in each Book. Check Chapter Context differs
   appropriately and prose is unchanged. Rename/delete a profile and repair its
   visible association. Try the controls with keyboard navigation in a narrow pane.
