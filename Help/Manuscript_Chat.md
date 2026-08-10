# Manuscript Chat

MWC renders first-party chat blocks natively. Chat View is not required.

````markdown
```chat
{{Pip|Did you hear that?|quietly}}
{{|Again.}}
{{> Divergent|I heard it.}}
{{^ System, centre|Connection restored.}}
...
# private channel note
{{Pip|Two lines
in one message|status}}
{{Pip|A literal \| separator}}
{{Pip|![[Images/example.png|400]]}}
```
````

Each message uses `{{header|body|subtext}}`.

- The header is the speaker. An empty header inherits the preceding speaker.
- `> Speaker` aligns right and `^ Speaker` aligns centre.
- Comma-separated header declarations can combine speaker/alignment information.
- Body and subtext may span lines.
- Escape a literal separator as `\|`.
- `...` creates a divider.
- A line beginning `#` is a channel comment.
- Local Obsidian embeds such as `![[image.png]]`, `![[Images/example.png]]`, and `![[image.png|400]]` are supported.

Historical `chat-old` and `chat-old-old` fences are not canonical authoring formats.
