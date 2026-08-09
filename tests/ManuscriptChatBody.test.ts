import { equal } from "node:assert/strict";
import { test } from "node:test";
import { manuscriptChatBodyMarkdown } from "../src/chat/ManuscriptChatBody";

test("allows supported Obsidian image embeds and preserves sizing syntax", () => {
  const source = "![[image.png]]\n![[Images/example.png]]\n![[image.png|400]]";
  equal(manuscriptChatBodyMarkdown(source, () => true), source);
});

test("preserves ordinary body Markdown including wikilinks", () => {
  const source = "Look at **this**.\n\nSee [[Evidence|the evidence]].";
  equal(manuscriptChatBodyMarkdown(source), source);
});

test("missing images remain visibly represented without losing surrounding text", () => {
  const source = "Before\n\n![[missing.png]]\n\nAfter";
  equal(manuscriptChatBodyMarkdown(source, () => false), "Before\n\n`![[missing.png]]`\n\nAfter");
});

test("unsupported transclusions and network image syntax are made visible", () => {
  equal(manuscriptChatBodyMarkdown("![[Other note]]"), "`![[Other note]]`");
  equal(manuscriptChatBodyMarkdown("![[document.pdf]]"), "`![[document.pdf]]`");
  equal(manuscriptChatBodyMarkdown("![remote](https://example.com/image.png)"), "`![remote](https://example.com/image.png)`");
});

test("nested fenced blocks remain visible code and cannot recursively render chat", () => {
  const source = "```chat\n{{Pip|nested|}}\n```";
  equal(manuscriptChatBodyMarkdown(source), "    ```chat\n    {{Pip|nested|}}\n    ```");
});
