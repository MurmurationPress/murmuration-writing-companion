import type { MarkdownPostProcessorContext } from "obsidian";
import { mapReadingBoundary, matchingReadingProjection, normalizeProjection, markdownBody } from "./ReadingAnnotationSelection";

export interface ReadingSelection {
  path: string;
  source: string;
  from: number;
  to: number;
}
interface ReadingSection { path: string; source: string; from: number; to: number }

/** Only host-provided section positions establish the occurrence; text search never does. */
export class ReadingAnnotationCapture {
  // Obsidian may clone cached rendered sections. Transfer only opaque snapshot IDs
  // and offsets with the DOM; keep a bounded set of source snapshots in memory.
  private readonly snapshots = new Map<string, { path: string; source: string; lines: number[] }>();

  private section(element: HTMLElement): ReadingSection | null {
    const [id, start, end] = (element.dataset.mwcReadingSection ?? "").split(":");
    const snapshot = this.snapshots.get(id);
    const from = Number(start), to = Number(end);
    return snapshot && Number.isSafeInteger(from) && Number.isSafeInteger(to) && from >= 0 && to >= from && to <= snapshot.source.length
      ? { ...snapshot, from, to } : null;
  }

  dispose(): void { this.snapshots.clear(); }

  register(element: HTMLElement, context: MarkdownPostProcessorContext): void {
    const info = context.getSectionInfo(element);
    if (!info) return;
    let id = [...this.snapshots].find(([, snapshot]) => snapshot.path === context.sourcePath && snapshot.source === info.text)?.[0];
    if (!id) {
      id = crypto.randomUUID();
      const lines = [0];
      for (let i = 0; i < info.text.length; i++) if (info.text[i] === "\n") lines.push(i + 1);
      this.snapshots.set(id, { path: context.sourcePath, source: info.text, lines });
      if (this.snapshots.size > 64) this.snapshots.delete(this.snapshots.keys().next().value!);
    }
    const lines = this.snapshots.get(id)!.lines;
    const from = lines[info.lineStart];
    const to = lines[info.lineEnd + 1] === undefined ? info.text.length : lines[info.lineEnd + 1] - 1;
    if (from === undefined || to < from) return;
    element.dataset.mwcReadingSection = `${id}:${from}:${to}`;
    const sectionSource = info.text.slice(from, to);
    if (/^>\s*\[!/.test(sectionSource)) {
      const paragraphs = Array.from(element.querySelectorAll<HTMLElement>(".callout-content > p"));
      const blocks: { from: number; to: number }[] = [];
      let offset = from, blockStart: number | null = null;
      for (const [index, line] of sectionSource.split("\n").entries()) {
        if (index > 0 && /^>\s*\S/.test(line)) { blockStart ??= offset; }
        else if (blockStart !== null) { blocks.push({ from: blockStart, to: offset - 1 }); blockStart = null; }
        offset += line.length + 1;
      }
      if (blockStart !== null) blocks.push({ from: blockStart, to });
      if (blocks.length === paragraphs.length && blocks.every((block, index) =>
        matchingReadingProjection(info.text.slice(block.from, block.to), normalizeProjection(paragraphs[index].textContent ?? "").text))) {
        blocks.forEach((block, index) => { paragraphs[index].dataset.mwcReadingSection = `${id}:${block.from}:${block.to}`; });
      }
    }
  }

  capture(root: HTMLElement, path: string, selection: Selection | null): ReadingSelection | null {
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    const start = this.boundary(root, path, range.startContainer, range.startOffset, false);
    const end = this.boundary(root, path, range.endContainer, range.endOffset, true);
    if (!start || !end || start.section.source !== end.section.source || end.offset <= start.offset) return null;
    return { path, source: start.section.source, from: start.offset, to: end.offset };
  }

  private boundary(root: HTMLElement, path: string, node: Node, offset: number, end: boolean) {
    let element = node.nodeType === 1 ? node as HTMLElement : node.parentElement;
    while (element && root.contains(element)) {
      const section = this.section(element);
      if (section && section.path === path) {
        const prefix = element.ownerDocument.createRange();
        prefix.selectNodeContents(element); prefix.setEnd(node, offset);
        const mapped = mapReadingBoundary(section.source.slice(section.from, section.to), element.textContent ?? "", prefix.toString().length, end);
        return mapped === null ? null : { section, offset: section.from + mapped };
      }
      element = element.parentElement;
    }
    return null;
  }

  reveal(root: HTMLElement, path: string, source: string, offset: number, toOffset: number): boolean {
    const body = markdownBody(source);
    const bodyStart = source.length - body.length;
    const shifts = new Map<string, number | null>();
    for (const element of Array.from(root.querySelectorAll<HTMLElement>("[data-mwc-reading-section]")).reverse()) {
      const section = this.section(element);
      if (section?.path !== path) continue;
      let shift = 0;
      if (section.source !== source) {
        // Native preview caches prose blocks across frontmatter-only changes.
        // Translate positions only when the entire body is byte-for-byte equal.
        // Cache by snapshot so long notes do not compare the body per paragraph.
        if (!shifts.has(section.source)) {
          const previousBody = markdownBody(section.source);
          shifts.set(section.source, previousBody === body
            ? section.source.length - previousBody.length - bodyStart : null);
        }
        const translated = shifts.get(section.source);
        if (translated == null || section.from < bodyStart + translated) continue;
        shift = translated;
      }
      const from = offset + shift, to = toOffset + shift;
      if (from < section.from || from >= section.to) continue;
      const rendered = normalizeProjection(element.textContent ?? "");
      const projection = matchingReadingProjection(section.source.slice(section.from, section.to), rendered.text);
      if (projection) {
        const first = projection.starts.findIndex(start => section.from + start >= from);
        let last = projection.ends.length - 1;
        while (last >= 0 && section.from + projection.ends[last] > to) last--;
        if (first >= 0 && last >= first) {
          const locate = (position: number): { node: Node; offset: number } | null => {
            const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let node: Node | null;
            while ((node = walker.nextNode())) {
              if (position <= (node.textContent?.length ?? 0)) return { node, offset: position };
              position -= node.textContent?.length ?? 0;
            }
            return null;
          };
          const start = locate(rendered.starts[first]);
          const end = locate(rendered.ends[last]);
          if (start && end) {
            const range = element.ownerDocument.createRange();
            range.setStart(start.node, start.offset); range.setEnd(end.node, end.offset);
            const selection = element.ownerDocument.getSelection();
            selection?.removeAllRanges(); selection?.addRange(range);
          }
        }
      }
      const rect = element.getBoundingClientRect();
      const viewport = root.getBoundingClientRect();
      if (rect.top < viewport.top || rect.bottom > viewport.bottom) element.scrollIntoView({ block: "center" });
      return true;
    }
    return false;
  }
}
