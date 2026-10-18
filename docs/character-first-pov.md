# Characters first, POV guidance when useful

Prepared author guide for Murmuration Docs (MWC-009, MWC-026, MWC-027 and MWC-028).
This describes the #276 candidate, not the published 0.20.0 interface.

A character records who someone is. A POV Profile records authorial decisions about
how the reader experiences that character: attention, interpretation, voice and
what to avoid. Profiles are optional. You can create characters and select them as
Scene POVs before writing any guidance.

## Develop a character, then associate guidance

Create a Character using Story World’s existing creation command. Leave the optional
POV details empty. Open the character and its Entity Inspector. The **POV Profile**
section offers an existing-profile selector and **Associate selected profile**.
You can change the selection later or **Remove association** without deleting the
profile note. **Open associated profile** takes you to the authored guidance.

Alternatively, choose **Create a profile for this character**. The normal creation
preview retains the character’s name. Create the profile, then explicitly confirm
the association and return to the character. Returning without confirmation leaves
both notes intact and unassociated. A cancelled creation makes no profile.

Profile guidance is ordinary Markdown. Open its note to develop the prose; the
Inspector’s **Edit this profile’s guidance** opens that exact profile rather than
editing a different layer of the inheritance chain.

## A perspective over two Books

Mira is a navigator. Her birthplace, work and relationships belong in her character
note. Her reusable **Mira POV** profile says: “Notice distances before faces; use
precise spatial language.” These are presentation choices, not new character facts.

In Book One, Mira avoids emotional interpretation. In Book Two, she has learned to
trust a crew. Keep her reusable profile associated with her character. Expand
**Develop POV for a Book**, select Book Two and choose **Create extension for this
Book**. The existing scoped-profile template preselects the inherited profile and
Book. In its “Changes in this book” section, write: “Notice who is missing from a
room before estimating its dimensions.” Do not copy the base guidance.

Select Book One in the character Inspector to see the base; select Book Two to see
base-first inherited guidance followed by the Book-specific addition. Open the
Book-specific profile to edit that addition without changing the base. Profile
connections link back to directly associated characters, inherited parents and
extensions. Follow a parent link to reach characters associated with that parent.

Chapter Context uses the Scene’s authoritative owning Book, not the Book selected
in the Inspector preview. A unique matching extension is appended after the base.
Guidance is additive authored Markdown, not a field-by-field override or automatic
voice analysis. Duplicate matching extensions are reported and not chosen
arbitrarily. Existing multi-level inheritance and directly associated extension
profiles keep their established behaviour: a directly linked profile applies
wherever the character is selected, regardless of its scope. The Inspector explains
this when a scoped profile is linked directly; choose its reusable parent for
automatic Book-specific selection.

## Safety and older vaults

No schema change or migration is needed: the existing character `pov_profile`,
profile `pov_extends` and `world_scope` links remain authoritative. The workflow
writes only the explicit character association or a newly requested profile note.
It does not change Scene POVs, manuscript prose, editorial records or profile
contents when an association changes.

Missing/deleted/unrecognised profile links remain visible and can be replaced or
removed. A changed association is rejected rather than overwritten from an old
Inspector. Reopen the character and retry. Note renames use ordinary Obsidian link
updates; with automatic link updates disabled, repair the visible missing link by
selecting the renamed note. No profile is generated automatically.

Until this enhancement ships, 0.20.0 users can create a POV Profile separately and
set the character’s `pov_profile` wikilink through Obsidian Properties. Book
extensions use `pov_extends` and a Book wikilink in `world_scope`.
