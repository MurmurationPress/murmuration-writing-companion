import { equal, deepEqual } from "node:assert/strict";
import { test } from "node:test";
import { ReadingAnnotationCapture } from "../src/companion/ReadingAnnotationCapture";
import type { MarkdownPostProcessorContext } from "obsidian";

// Minimal DOM boundary fixture; the native replay covers the real host DOM and renderer.
class ElementFixture {
  dataset: Record<string, string> = {};
  parentElement: ElementFixture | null = null;
  constructor(public textContent: string) {}
  contains(node: any): boolean { return node === this || !!node?.parentElement && this.contains(node.parentElement); }
  ownerDocument = { createRange: () => {
    let section: ElementFixture; let end = 0;
    return { selectNodeContents: (element: ElementFixture) => { section = element; }, setEnd: (_node: unknown, offset: number) => { end = offset; }, toString: () => section.textContent.slice(0, end) };
  } };
}

test("host section lines disambiguate duplicates and survive cloned rendered sections", () => {
  const previous = globalThis.HTMLElement;
  (globalThis as any).HTMLElement = ElementFixture;
  try {
    const capture = new ReadingAnnotationCapture();
    const source = "Repeated.\n\nA **formatted** passage.\n\nRepeated.";
    const root = new ElementFixture("");
    const original = new ElementFixture("Repeated.");
    capture.register(original as any, { sourcePath: "Original.md", getSectionInfo: () => ({ text: source, lineStart: 4, lineEnd: 4 }) } as unknown as MarkdownPostProcessorContext);
    const clone = new ElementFixture("Repeated."); clone.dataset = { ...original.dataset }; clone.parentElement = root;
    const node = { parentElement: clone };
    const selection = { isCollapsed: false, rangeCount: 1, getRangeAt: () => ({ startContainer: node, startOffset: 0, endContainer: node, endOffset: 9 }) } as unknown as Selection;
    const result = capture.capture(root as any, "Original.md", selection);
    deepEqual(result, { path: "Original.md", source, from: source.lastIndexOf("Repeated."), to: source.length });
    equal(capture.capture(root as any, "Other.md", selection), null);
    clone.textContent = "Changed render.";
    equal(capture.capture(root as any, "Original.md", selection), null);
    capture.dispose(); clone.textContent = "Repeated.";
    equal(capture.capture(root as any, "Original.md", selection), null);
  } finally { (globalThis as any).HTMLElement = previous; }
});

test("captures paragraph-spanning selections against one source snapshot, rejecting mixed renders", () => {
  const previous = globalThis.HTMLElement;
  (globalThis as any).HTMLElement = ElementFixture;
  try {
    const capture = new ReadingAnnotationCapture();
    const source = "First **paragraph**.\n\nSecond *paragraph*.";
    const root = new ElementFixture("");
    const first = new ElementFixture("First paragraph."); first.parentElement = root;
    const second = new ElementFixture("Second paragraph."); second.parentElement = root;
    const register = (el: ElementFixture, text: string, line: number) => capture.register(el as any, { sourcePath: "Scene.md", getSectionInfo: () => ({ text, lineStart: line, lineEnd: line }) } as unknown as MarkdownPostProcessorContext);
    register(first, source, 0); register(second, source, 2);
    const a = { parentElement: first }, b = { parentElement: second };
    const selection = { isCollapsed: false, rangeCount: 1, getRangeAt: () => ({ startContainer: a, startOffset: 0, endContainer: b, endOffset: 17 }) } as unknown as Selection;
    const result = capture.capture(root as any, "Scene.md", selection)!;
    equal(result.source.slice(result.from, result.to), source);
    register(second, source.replace("First", "Changed"), 2);
    equal(capture.capture(root as any, "Scene.md", selection), null);
  } finally { (globalThis as any).HTMLElement = previous; }
});

test("ordinary paragraphs in a callout use checked source order, including duplicate paragraphs", () => {
  const previous = globalThis.HTMLElement; (globalThis as any).HTMLElement = ElementFixture;
  try {
    const capture = new ReadingAnnotationCapture();
    const source = "> [!note] Heading\n> Repeated.\n>\n> Repeated.";
    const root = new ElementFixture("");
    const callout = new ElementFixture("HeadingRepeated.Repeated."); callout.parentElement = root;
    const paragraphs = [new ElementFixture("Repeated."), new ElementFixture("Repeated.")];
    for (const paragraph of paragraphs) paragraph.parentElement = callout;
    (callout as any).querySelectorAll = () => paragraphs;
    capture.register(callout as any, { sourcePath: "Scene.md", getSectionInfo: () => ({ text: source, lineStart: 0, lineEnd: 3 }) } as unknown as MarkdownPostProcessorContext);
    const node = { parentElement: paragraphs[1] };
    const selection = { isCollapsed: false, rangeCount: 1, getRangeAt: () => ({ startContainer: node, startOffset: 0, endContainer: node, endOffset: 9 }) } as unknown as Selection;
    const result = capture.capture(root as any, "Scene.md", selection)!;
    equal(result.from, source.lastIndexOf("Repeated.")); equal(result.to, source.length);
  } finally { (globalThis as any).HTMLElement = previous; }
});

test("ordinary endpoint paragraphs are scoped separately from unsupported constructs elsewhere in a note", () => {
  const previous = globalThis.HTMLElement; (globalThis as any).HTMLElement = ElementFixture;
  try {
    const capture = new ReadingAnnotationCapture();
    const source = "---\ntitle: Synthetic\n---\n\n```\ncode\n```\n\nOrdinary prose.\n\n![[embed]]\n\n$math$";
    const root = new ElementFixture(""); const paragraph = new ElementFixture("Ordinary prose."); paragraph.parentElement = root;
    capture.register(paragraph as any, { sourcePath: "Scene.md", getSectionInfo: () => ({ text: source, lineStart: 8, lineEnd: 8 }) } as unknown as MarkdownPostProcessorContext);
    const node = { parentElement: paragraph };
    const selection = { isCollapsed: false, rangeCount: 1, getRangeAt: () => ({ startContainer: node, startOffset: 0, endContainer: node, endOffset: 15 }) } as unknown as Selection;
    const result = capture.capture(root as any, "Scene.md", selection)!;
    equal(result.source.slice(result.from, result.to), "Ordinary prose.");
  } finally { (globalThis as any).HTMLElement = previous; }
});
