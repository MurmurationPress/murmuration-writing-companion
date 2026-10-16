# Read-only PDF export anchors

New editor selections retain `anchor.text` and the 1-based `anchor.line` and add
`anchor.range = { from, to, sourceSha256, basis: "markdown-body-v1" }`.
Offsets are UTF-16 code units, half-open, relative to the source after its opening
YAML frontmatter (including the closing delimiter's newline). No whitespace or
line ending normalization occurs. The SHA-256 is lowercase hexadecimal over the
UTF-8 encoding of that exact body. Selections are trimmed and offsets adjusted to
the trimmed selection. YAML selections retain legacy anchors without a body export range.

Body-relative snapshots tolerate MWC's derived `mwc_open_annotations` YAML write.
Any body change invalidates strict export evidence. No existing annotation is
migrated, reanchored, or rewritten. Navigation retains its existing behavior.
Portable schema 3 already preserves extra anchor properties through load/save,
backup and export. Plugins remain independently usable; no runtime dependency or
new settings are introduced.

Consumer: MurmurationPress/codex-press#154. Codex Press reads the portable schema 3
file at `.murmuration/writing-companion/editorial-data.json` without calling MWC.
It must validate hash, offsets and selected text, and report stale anchors rather
than reanchor them. Legacy text/line anchors remain available but cannot identify
two identical selections on the same line. This change supplies that missing
evidence for future selections. It does not implement PDF import or read-mode
selection capture; that work is tracked separately in MWC #259 and should reuse
this contract when reliable source offsets are available.

Annotation model: one body/category/status per annotation; open/resolved statuses,
created/updated ISO timestamps, no defined author field or reply thread. Export
must not invent an author from manuscript metadata.
