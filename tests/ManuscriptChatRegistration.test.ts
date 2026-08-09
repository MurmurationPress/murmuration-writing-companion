import { equal, match } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("registers canonical and historical chat fence names through Obsidian's supported processor", () => {
  const plugin = readFileSync("src/chat/ManuscriptChatPlugin.ts", "utf8");
  match(plugin, /\["chat", "chat-old", "chat-old-old"\]/);
  match(plugin, /registerMarkdownCodeBlockProcessor\(language/);
  equal(plugin.includes("registerEditorExtension"), false);
  equal(plugin.includes("querySelector"), false);
});

test("loads native chat rendering without a Chat View dependency", () => {
  const entry = readFileSync("src/entry.ts", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  match(entry, /installManuscriptChatRendering\(this\)/);
  equal(/chat.?view/i.test(packageJson), false);
});

test("renders only message bodies as Markdown with source-note context", () => {
  const plugin = readFileSync("src/chat/ManuscriptChatPlugin.ts", "utf8");
  const rendering = readFileSync("src/chat/ManuscriptChatRendering.ts", "utf8");
  match(plugin, /context\.sourcePath/);
  match(plugin, /context\.addChild\(child\)/);
  match(rendering, /MarkdownRenderer\.render\(app, markdown, body, sourcePath, component\)/);
  match(rendering, /mwc-manuscript-chat-speaker", text: token\.header/);
  match(rendering, /mwc-manuscript-chat-subtext", text: token\.subtext/);
  equal(/MarkdownRenderer\.render\([^\n]*token\.(?:header|subtext)/.test(rendering), false);
});

test("constrains images responsively inside the semantic message body", () => {
  const css = readFileSync("styles.css", "utf8");
  match(css, /\.mwc-manuscript-chat-body img[\s\S]*max-width:\s*100%/);
  match(css, /\.mwc-manuscript-chat-body img[\s\S]*height:\s*auto/);
});
