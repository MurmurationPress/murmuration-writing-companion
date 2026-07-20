import type { TFile } from "obsidian";
import {
  findProseWikilinks,
  ProseWikilinkChangeTracker,
  ProseWikilinkOccurrence
} from "./ProseWikilinkChanges";

export interface PendingProseEventCreation {
  readonly kind: "create-event";
  readonly chapterPath: string;
  readonly key: string;
  readonly name: string;
  readonly occurrence: ProseWikilinkOccurrence;
}

export interface PendingWorldContextAddition {
  readonly kind: "add-world-context";
  readonly chapterPath: string;
  readonly eventName: string;
  readonly eventPath: string;
  readonly reference: string;
  readonly sourceRawLink: string;
}

export type PendingStoryWorldEventAuthoring =
  | PendingProseEventCreation
  | PendingWorldContextAddition;

export interface StoryWorldEventAuthoringHost {
  getPendingStoryWorldEventAuthoring(
    chapter: TFile
  ): PendingStoryWorldEventAuthoring | null;
  dismissPendingStoryWorldEventAuthoring(chapter: TFile): void;
  markPendingStoryWorldEventCreated(
    chapter: TFile,
    pending: PendingProseEventCreation,
    followUp: Omit<PendingWorldContextAddition, "kind" | "chapterPath">
  ): void;
  completePendingStoryWorldEventAuthoring(chapter: TFile): void;
}

export function storyWorldEventAuthoringHost(
  value: unknown
): StoryWorldEventAuthoringHost | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<StoryWorldEventAuthoringHost>;
  return typeof candidate.getPendingStoryWorldEventAuthoring === "function"
    && typeof candidate.dismissPendingStoryWorldEventAuthoring === "function"
    && typeof candidate.markPendingStoryWorldEventCreated === "function"
    && typeof candidate.completePendingStoryWorldEventAuthoring === "function"
    ? candidate as StoryWorldEventAuthoringHost
    : null;
}

function normalizedLinkKey(path: string, occurrence: ProseWikilinkOccurrence): string {
  return [
    path.toLowerCase(),
    occurrence.linkpath.trim().toLowerCase(),
    (occurrence.displayText ?? "").trim().toLowerCase()
  ].join("\u0000");
}

export class StoryWorldEventAuthoringSession {
  private readonly tracker = new ProseWikilinkChangeTracker();
  private readonly queues = new Map<string, PendingStoryWorldEventAuthoring[]>();
  private readonly dismissed = new Set<string>();

  seed(path: string, text: string): void {
    this.tracker.seed(path, text);
  }

  updateText(
    path: string,
    text: string,
    cursorOffset: number
  ): ProseWikilinkOccurrence | null {
    const changed = this.tracker.update(path, text, cursorOffset);
    this.pruneRemovedLinks(path, text);
    return changed;
  }

  enqueueCandidate(
    chapterPath: string,
    occurrence: ProseWikilinkOccurrence,
    name: string
  ): boolean {
    const key = normalizedLinkKey(chapterPath, occurrence);
    if (this.dismissed.has(key)) return false;

    const queue = this.queues.get(chapterPath) ?? [];
    if (queue.some((item) => item.kind === "create-event" && item.key === key)) {
      return false;
    }

    queue.push({
      kind: "create-event",
      chapterPath,
      key,
      name,
      occurrence
    });
    this.queues.set(chapterPath, queue);
    return true;
  }

  getPending(chapterPath: string): PendingStoryWorldEventAuthoring | null {
    return this.queues.get(chapterPath)?.[0] ?? null;
  }

  dismiss(chapterPath: string): boolean {
    const queue = this.queues.get(chapterPath);
    const pending = queue?.shift();
    if (!pending) return false;
    if (pending.kind === "create-event") this.dismissed.add(pending.key);
    if (queue && queue.length > 0) this.queues.set(chapterPath, queue);
    else this.queues.delete(chapterPath);
    return true;
  }

  markCreated(
    chapterPath: string,
    pending: PendingProseEventCreation,
    followUp: Omit<PendingWorldContextAddition, "kind" | "chapterPath">
  ): boolean {
    const queue = this.queues.get(chapterPath);
    if (!queue || queue[0]?.kind !== "create-event" || queue[0].key !== pending.key) {
      return false;
    }

    queue[0] = {
      kind: "add-world-context",
      chapterPath,
      ...followUp
    };
    return true;
  }

  complete(chapterPath: string): boolean {
    const queue = this.queues.get(chapterPath);
    if (!queue?.shift()) return false;
    if (queue.length > 0) this.queues.set(chapterPath, queue);
    else this.queues.delete(chapterPath);
    return true;
  }

  clear(path: string): void {
    this.tracker.clear(path);
    this.queues.delete(path);
    for (const key of [...this.dismissed]) {
      if (key.startsWith(`${path.toLowerCase()}\u0000`)) this.dismissed.delete(key);
    }
  }

  rename(oldPath: string, newPath: string): void {
    this.tracker.rename(oldPath, newPath);
    const queue = this.queues.get(oldPath);
    this.queues.delete(oldPath);
    if (queue) {
      this.queues.set(newPath, queue.map((item) => ({
        ...item,
        chapterPath: newPath,
        ...(item.kind === "create-event"
          ? { key: normalizedLinkKey(newPath, item.occurrence) }
          : {})
      })) as PendingStoryWorldEventAuthoring[]);
    }

    for (const key of [...this.dismissed]) {
      if (!key.startsWith(`${oldPath.toLowerCase()}\u0000`)) continue;
      this.dismissed.delete(key);
      this.dismissed.add(`${newPath.toLowerCase()}${key.slice(oldPath.length)}`);
    }
  }

  private pruneRemovedLinks(path: string, text: string): void {
    const queue = this.queues.get(path);
    if (!queue) return;
    const raws = new Set(findProseWikilinks(text).map((link) => link.raw));
    const next = queue.filter((item) => (
      item.kind === "add-world-context" || raws.has(item.occurrence.raw)
    ));
    if (next.length > 0) this.queues.set(path, next);
    else this.queues.delete(path);
  }
}
