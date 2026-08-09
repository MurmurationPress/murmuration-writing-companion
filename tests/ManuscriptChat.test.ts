import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { parseManuscriptChat } from "../src/chat/ManuscriptChat";

test("parses the canonical three-field message and default left alignment", () => {
  const parsed = parseManuscriptChat("{{PRIME|Observation retained.|internal}}");
  equal(parsed.syntax, "v2");
  deepEqual(parsed.tokens, [{ type: "message", header: "PRIME", body: "Observation retained.", subtext: "internal", alignment: "left" }]);
});

test("supports omitted subtext and blank-header speaker inheritance", () => {
  const parsed = parseManuscriptChat("{{Tobias|First message.}}\n{{|Acknowledged.|}}");
  deepEqual(parsed.tokens, [
    { type: "message", header: "Tobias", body: "First message.", subtext: "", alignment: "left" },
    { type: "message", header: "Tobias", body: "Acknowledged.", subtext: "", alignment: "left" }
  ]);
});

test("matches Codex Press escaped-pipe, multiline and final-separator semantics", () => {
  const parsed = parseManuscriptChat("{{JANUS|Expected A \\| B.\nReceived A | B | C.|09:12 · read}}");
  deepEqual(parsed.tokens, [{
    type: "message", header: "JANUS", body: "Expected A | B.\nReceived A | B | C.", subtext: "09:12 · read", alignment: "left"
  }]);
});

test("resolves right, centre and comma-separated alignment declarations", () => {
  const parsed = parseManuscriptChat("> [[Tobias Hale|Tobias]], **Pip**\n^ `System`\n{{Tobias|Right.|sent}}\n{{Pip|Also right.|read}}\n{{System|Centred.|restricted}}");
  deepEqual(parsed.alignments, { Tobias: "right", Pip: "right", System: "center" });
  deepEqual(parsed.tokens.map((token) => token.type === "message" ? token.alignment : token.type), ["right", "right", "center"]);
});

test("preserves comments, dividers and consecutive messages in authored order", () => {
  const parsed = parseManuscriptChat("# Restricted channel\n{{PRIME|Path retained.|internal}}\n...\n{{JANUS|Proceed.|authorised}}");
  deepEqual(parsed.tokens, [
    { type: "comment", text: "Restricted channel" },
    { type: "message", header: "PRIME", body: "Path retained.", subtext: "internal", alignment: "left" },
    { type: "divider" },
    { type: "message", header: "JANUS", body: "Proceed.", subtext: "authorised", alignment: "left" }
  ]);
});

test("keeps malformed and unclosed source visible", () => {
  const parsed = parseManuscriptChat("{{Tobias|Complete.|sent}}\n{{JANUS|unfinished message");
  equal(parsed.syntax, "v2");
  deepEqual(parsed.tokens[1], { type: "malformed", source: "{{JANUS|unfinished message" });
});

test("retains legacy left, right and centre chat syntax", () => {
  const parsed = parseManuscriptChat("< **PRIME:** Observation retained.\n> **Tobias:** Are you there?\n^ **System:** Restricted\n^ channel.");
  equal(parsed.syntax, "legacy");
  deepEqual(parsed.tokens, [
    { type: "message", header: "PRIME", body: "Observation retained.", subtext: "", alignment: "left" },
    { type: "message", header: "Tobias", body: "Are you there?", subtext: "", alignment: "right" },
    { type: "message", header: "System", body: "Restricted\nchannel.", subtext: "", alignment: "center" }
  ]);
});

test("unrecognised chat content remains intact instead of being discarded", () => {
  const source = "ordinary text inside a chat fence";
  const parsed = parseManuscriptChat(source);
  equal(parsed.syntax, "unrecognised");
  equal(parsed.source, source);
  deepEqual(parsed.tokens, []);
});

test("parser contract does not claim ordinary prose or unrelated fenced code", () => {
  const prose = "Ordinary prose with {single braces} and a | character.";
  const unrelatedFence = "```javascript\nconst value = '{{not chat|still code}}';\n```";
  equal(parseManuscriptChat(prose).syntax, "unrecognised");
  equal(unrelatedFence, "```javascript\nconst value = '{{not chat|still code}}';\n```");
});

test("parses a bounded long PRIME interface message without losing content", () => {
  const body = Array.from({ length: 400 }, (_, index) => `status ${index}`).join("\n");
  const parsed = parseManuscriptChat(`{{PRIME|${body}|complete}}`);
  const message = parsed.tokens[0];
  equal(message.type, "message");
  if (message.type === "message") { equal(message.body, body); equal(message.subtext, "complete"); }
});

test("preserves image-only, path-qualified and sized embeds exactly in message bodies", () => {
  for (const body of ["![[image.png]]", "![[Images/example.png]]", "![[image.png|400]]"]) {
    const parsed = parseManuscriptChat(`{{Pip|${body}|}}`);
    const message = parsed.tokens[0];
    equal(message.type, "message");
    if (message.type === "message") equal(message.body, body);
  }
});

test("preserves multiline body Markdown, subtext and inherited speaker", () => {
  const body = "Look at *this*.\n\n![[Images/example.png|400]]\n\nThat is what I mean; see [[Evidence]].";
  const parsed = parseManuscriptChat(`{{Pip|First.|sent}}\n{{|${body}|09:12}}`);
  const message = parsed.tokens[1];
  equal(message.type, "message");
  if (message.type === "message") {
    equal(message.header, "Pip");
    equal(message.body, body);
    equal(message.subtext, "09:12");
  }
});
