import { equal, ok } from "node:assert/strict";
import { test } from "node:test";
import {
  ProseWikilinkEditor,
  ProseWikilinkEditorChangeTracker
} from "../src/companion/ProseWikilinkChanges";

class CountingEditor implements ProseWikilinkEditor {
  readonly lines: string[];
  lineReads = 0;
  offsetReads = 0;

  constructor(text: string) {
    this.lines = text.split("\n");
  }

  getLine(line: number): string {
    this.lineReads += 1;
    return this.lines[line];
  }

  lineCount(): number {
    return this.lines.length;
  }

  posToOffset(position: { line: number; ch: number }): number {
    this.offsetReads += 1;
    let offset = position.ch;
    for (let line = 0; line < position.line; line += 1) offset += this.lines[line].length + 1;
    return offset;
  }
}

function realisticScene(targetBytes: number): string {
  const paragraphs = [
    "Mara crossed the rain-dark platform while [[Tobias Hale|Tobias]] watched the departure board flicker.",
    "The station clock lost another minute. Nobody mentioned [[Events/The Failure|the failure]], although everyone remembered it.",
    "A porter dragged a brass-bound case through the crowd, apologising to passengers in three languages.",
    "Beyond the glass, sodium light pooled over the rails and the last train carried its warm windows north."
  ];
  const lines = ["---", "kind: scene", "pov: '[[Mara Venn]]'", "---", ""];
  let index = 0;
  while (lines.join("\n").length < targetBytes) {
    lines.push(paragraphs[index % paragraphs.length]);
    index += 1;
  }
  return lines.join("\n").slice(0, targetBytes);
}

for (const size of [10_000, 30_000, 100_000]) {
  test(`${Math.round(size / 1000)} KB ordinary keystroke reads and parses only the changed line`, () => {
    const text = realisticScene(size);
    const editor = new CountingEditor(text);
    const tracker = new ProseWikilinkEditorChangeTracker();
    tracker.seed("Scene.md", text);
    const line = Math.floor(editor.lines.length / 2);
    editor.lines[line] += "x";

    equal(tracker.update("Scene.md", editor, { line, ch: editor.lines[line].length }), null);
    equal(editor.lineReads, 1);
    equal(editor.offsetReads, 0);
  });
}

test("one bounded detector immediately recognises a newly completed prose link", () => {
  const text = realisticScene(100_000);
  const editor = new CountingEditor(text);
  const tracker = new ProseWikilinkEditorChangeTracker();
  tracker.seed("Scene.md", text);
  const line = Math.floor(editor.lines.length / 2);
  editor.lines[line] = "Mara finally named [[The Midnight Alarm]]";
  // Seed the incomplete version on this line without constructing a new full scene.
  const incomplete = [...editor.lines];
  incomplete[line] = "Mara finally named [[The Midnight Alarm]";
  tracker.seed("Scene.md", incomplete.join("\n"));

  const occurrence = tracker.update("Scene.md", editor, { line, ch: editor.lines[line].length });
  equal(occurrence?.raw, "[[The Midnight Alarm]]");
  equal(editor.lineReads, 1);
  equal(editor.offsetReads, 2);
  ok((occurrence?.start ?? -1) > 10_000);
});

test("cached cross-line state preserves frontmatter fence and comment exclusions", () => {
  for (const lines of [
    ["---", "kind: scene", "draft: [[Hidden]", "---"],
    ["Before", "```md", "[[Hidden]", "```"],
    ["Before <!--", "[[Hidden]", "--> after"],
    ["Before %%", "[[Hidden]", "%% after"]
  ]) {
    const previous = lines.join("\n");
    const editor = new CountingEditor(previous);
    const tracker = new ProseWikilinkEditorChangeTracker();
    tracker.seed("Scene.md", previous);
    editor.lines[2] += "]";
    equal(tracker.update("Scene.md", editor, { line: 2, ch: editor.lines[2].length }), null);
    equal(editor.lineReads, 1);
  }
});

test("bounded parsing preserves same-line code comment embed and escape exclusions", () => {
  for (const current of [
    "Before `[[Hidden]]`",
    "Before <!-- [[Hidden]] -->",
    "Before %% [[Hidden]] %%",
    "Before ![[Hidden]]",
    "Before \\[[Hidden]]"
  ]) {
    const closing = current.lastIndexOf("]");
    const previous = current.slice(0, closing) + current.slice(closing + 1);
    const editor = new CountingEditor(current);
    const tracker = new ProseWikilinkEditorChangeTracker();
    tracker.seed("Scene.md", previous);
    equal(tracker.update("Scene.md", editor, { line: 0, ch: closing + 1 }), null);
    equal(editor.lineReads, 1);
  }
});
