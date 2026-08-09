# Native manuscript chat rendering

MWC owns Obsidian presentation of the Murmuration Press manuscript chat contract. Markdown remains authoritative: only fenced `chat` blocks are registered, and the plugin never rewrites their source.

The grammar deliberately matches the first-party Codex Press contract:

- `{{header|body|subtext}}`, with optional subtext;
- the final unescaped pipe separates subtext and intermediate pipes remain in the body;
- `\|` represents a literal pipe;
- a blank header inherits the preceding message header;
- `> Name` and `^ Name` declare right and centre alignment, including comma-separated names;
- `...` is a divider and `#` introduces a rendered channel comment;
- message bodies may span lines;
- legacy `< **Speaker:**`, `> **Speaker:**` and `^ **Speaker:**` messages remain readable. Historical `chat-old` and `chat-old-old` fence names found in PRIME are registered as compatibility aliases as well as canonical `chat`.

MWC uses Obsidian's supported `registerMarkdownCodeBlockProcessor` API. Obsidian applies fenced-code processors in Reading View and its rendered Live Preview code-block surface, retaining its native source-reveal behaviour when the author edits the block. MWC adds no document-wide keystroke listener, private editor API or DOM interception.

## Restricted body Markdown

Speaker/header and subtext/status are always inserted as text. The message body alone is passed to Obsidian's public `MarkdownRenderer`, with the containing note's `sourcePath` and a managed `MarkdownRenderChild`. This preserves Obsidian's vault-relative attachment resolution, wikilinks, theme behaviour and renderer lifecycle without creating another image resolver.

The supported body contract is ordinary text, paragraphs and line breaks, emphasis/strong, ordinary wikilinks, and local Obsidian image embeds for common web image formats. Image paths and Obsidian sizing aliases such as `![[Images/example.png|400]]` remain authored Markdown and are resolved from the source note through the metadata cache. Missing images remain visibly represented alongside the rest of the message.

Arbitrary note transclusion, PDFs, audio/video, Bases, Dataview, raw media HTML, network-image Markdown and recursively rendered fenced blocks are not part of #167. Their embed source is presented visibly instead of being executed or silently discarded. MWC neither fetches network media nor rewrites manuscript source.

## Deliberate failure-mode difference

Codex Press and MWC produce equivalent normalized messages for recognised house grammar. Codex Press currently leaves wholly unrecognised legacy blocks unchanged, but can omit malformed trailing control/brace text from a partially recognised v2 transform. In Obsidian, #167 requires malformed authored content to remain visible, so MWC emits a visibly marked `malformed` token for that text. This is a conservative presentation difference, not a source-format change; Codex Press is unchanged.

The PRIME vault audit also found historical `chat-old` and `chat-old-old` fence names. Codex Press's current first-party transform matches canonical fenced `chat` blocks, while MWC accepts those historical aliases so existing Obsidian manuscripts remain readable without migration. Publishing treatment of the alias fence names should be confirmed separately before dependency-removal documentation is finalized.

## Dependency audit

Before this implementation, MWC contained no Chat View package dependency, runtime check, bundled asset, plugin recommendation, onboarding instruction or example-vault configuration. References to Chat View remain in Codex Press documentation as historical syntax/validation terminology. Removing or renaming those publishing references is deferred until PRIME parity validation is approved and does not require a runtime dependency.
