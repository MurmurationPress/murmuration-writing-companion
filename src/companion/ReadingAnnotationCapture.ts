import type { MarkdownPostProcessorContext } from "obsidian";
import { mapReadingBoundary, projectReadingSource, normalizeProjection } from "./ReadingAnnotationSelection";

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
  private readonly snapshots = new Map<string, { path: string; source: string }>();

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
    const lines = info.text.split("\n");
    const from = lines.slice(0, info.lineStart).reduce((n, line) => n + line.length + 1, 0);
    const to = from + lines.slice(info.lineStart, info.lineEnd + 1).join("\n").length;
    let id = [...this.snapshots].find(([, snapshot]) => snapshot.path === context.sourcePath && snapshot.source === info.text)?.[0];
    if (!id) {
      id = crypto.randomUUID();
      this.snapshots.set(id, { path: context.sourcePath, source: info.text });
      if (this.snapshots.size > 64) this.snapshots.delete(this.snapshots.keys().next().value!);
    }
    element.dataset.mwcReadingSection = `${id}:${from}:${to}`;
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
    let element = node instanceof HTMLElement ? node : node.parentElement;
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
    for (const element of Array.from(root.querySelectorAll<HTMLElement>("[data-mwc-reading-section]"))) {
      const section = this.section(element);
      if (section?.path !== path || section.source !== source || offset < section.from || offset > section.to) continue;
      const projection = projectReadingSource(source.slice(section.from, section.to));
      const rendered = normalizeProjection(element.textContent ?? "");
      if (projection && projection.text === rendered.text) {
        const first = projection.starts.findIndex(start => section.from + start >= offset);
        let last = projection.ends.length - 1;
        while (last >= 0 && section.from + projection.ends[last] > toOffset) last--;
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
