import type { TFile } from "obsidian";
import {
  findProseWikilinks,
  ProseWikilinkChangeTracker,
  ProseWikilinkOccurrence
} from "./ProseWikilinkChanges";

export interface PendingStoryWorldRelationMeaning {
  readonly kind: "author-relation";
  readonly chapterPath: string;
  readonly key: string;
  readonly occurrence: ProseWikilinkOccurrence;
  readonly sourceLine: number;
  readonly sourceEntityPath: string;
  readonly sourceEntityName: string;
  readonly targetEntityPath: string;
  readonly targetEntityName: string;
  readonly targetEntityType: string;
}

export interface PendingStoryWorldRelationContextAddition {
  readonly kind: "add-world-context";
  readonly chapterPath: string;
  readonly targetEntityPath: string;
  readonly targetEntityName: string;
  readonly reference: string;
  readonly sourceRawLink: string;
}

export type PendingStoryWorldRelationAuthoring =
  | PendingStoryWorldRelationMeaning
  | PendingStoryWorldRelationContextAddition;

export interface StoryWorldRelationAuthoringHost {
  getPendingStoryWorldRelationAuthoring(
    chapter: TFile
  ): PendingStoryWorldRelationAuthoring | null;
  dismissPendingStoryWorldRelationAuthoring(chapter: TFile): void;
  advancePendingStoryWorldRelationAuthoring(
    chapter: TFile,
    pending: PendingStoryWorldRelationMeaning,
    followUp: Omit<
      PendingStoryWorldRelationContextAddition,
      "kind" | "chapterPath"
    > | null
  ): void;
  completePendingStoryWorldRelationAuthoring(chapter: TFile): void;
}

export function storyWorldRelationAuthoringHost(
  value: unknown
): StoryWorldRelationAuthoringHost | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<StoryWorldRelationAuthoringHost>;
  return typeof candidate.getPendingStoryWorldRelationAuthoring === "function"
    && typeof candidate.dismissPendingStoryWorldRelationAuthoring === "function"
    && typeof candidate.advancePendingStoryWorldRelationAuthoring === "function"
    && typeof candidate.completePendingStoryWorldRelationAuthoring === "function"
    ? candidate as StoryWorldRelationAuthoringHost
    : null;
}

function normalizedLinkKey(
  chapterPath: string,
  occurrence: ProseWikilinkOccurrence,
  sourceEntityPath: string,
  targetEntityPath: string
): string {
  return [
    chapterPath.trim().toLowerCase(),
    sourceEntityPath.trim().toLowerCase(),
    targetEntityPath.trim().toLowerCase(),
    occurrence.linkpath.trim().toLowerCase(),
    (occurrence.displayText ?? "").trim().toLowerCase()
  ].join("\u0000");
}

export class StoryWorldRelationAuthoringSession {
  private readonly tracker = new ProseWikilinkChangeTracker();
  private readonly queues = new Map<string, PendingStoryWorldRelationAuthoring[]>();
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
    sourceLine: number,
    sourceEntityPath: string,
    sourceEntityName: string,
    targetEntityPath: string,
    targetEntityName: string,
    targetEntityType: string
  ): boolean {
    const key = normalizedLinkKey(
      chapterPath,
      occurrence,
      sourceEntityPath,
      targetEntityPath
    );
    if (this.dismissed.has(key)) return false;

    const queue = this.queues.get(chapterPath) ?? [];
    if (queue.some((item) => item.kind === "author-relation" && item.key === key)) {
      return false;
    }

    queue.push({
      kind: "author-relation",
      chapterPath,
      key,
      occurrence,
      sourceLine: Math.max(1, Math.floor(sourceLine)),
      sourceEntityPath,
      sourceEntityName,
      targetEntityPath,
      targetEntityName,
      targetEntityType
    });
    this.queues.set(chapterPath, queue);
    return true;
  }

  getPending(chapterPath: string): PendingStoryWorldRelationAuthoring | null {
    return this.queues.get(chapterPath)?.[0] ?? null;
  }

  dismiss(chapterPath: string): boolean {
    const queue = this.queues.get(chapterPath);
    const pending = queue?.shift();
    if (!pending) return false;
    if (pending.kind === "author-relation") this.dismissed.add(pending.key);
    this.retainQueue(chapterPath, queue ?? []);
    return true;
  }

  advance(
    chapterPath: string,
    pending: PendingStoryWorldRelationMeaning,
    followUp: Omit<
      PendingStoryWorldRelationContextAddition,
      "kind" | "chapterPath"
    > | null
  ): boolean {
    const queue = this.queues.get(chapterPath);
    if (
      !queue
      || queue[0]?.kind !== "author-relation"
      || queue[0].key !== pending.key
    ) {
      return false;
    }

    if (followUp) {
      queue[0] = {
        kind: "add-world-context",
        chapterPath,
        ...followUp
      };
      this.queues.set(chapterPath, queue);
    } else {
      queue.shift();
      this.retainQueue(chapterPath, queue);
    }
    return true;
  }

  complete(chapterPath: string): boolean {
    const queue = this.queues.get(chapterPath);
    if (!queue?.shift()) return false;
    this.retainQueue(chapterPath, queue);
    return true;
  }

  clear(path: string): void {
    this.tracker.clear(path);
    this.queues.delete(path);
    const prefix = `${path.toLowerCase()}\u0000`;
    for (const key of [...this.dismissed]) {
      if (key.startsWith(prefix)) this.dismissed.delete(key);
    }
  }

  rename(oldPath: string, newPath: string): void {
    this.tracker.rename(oldPath, newPath);
    const queue = this.queues.get(oldPath);
    this.queues.delete(oldPath);
    if (queue) {
      this.queues.set(newPath, queue.map((item) => {
        if (item.kind === "add-world-context") {
          return { ...item, chapterPath: newPath };
        }
        return {
          ...item,
          chapterPath: newPath,
          key: normalizedLinkKey(
            newPath,
            item.occurrence,
            item.sourceEntityPath,
            item.targetEntityPath
          )
        };
      }));
    }

    const oldPrefix = `${oldPath.toLowerCase()}\u0000`;
    const newPrefix = `${newPath.toLowerCase()}\u0000`;
    for (const key of [...this.dismissed]) {
      if (!key.startsWith(oldPrefix)) continue;
      this.dismissed.delete(key);
      this.dismissed.add(`${newPrefix}${key.slice(oldPrefix.length)}`);
    }
  }

  private retainQueue(
    chapterPath: string,
    queue: PendingStoryWorldRelationAuthoring[]
  ): void {
    if (queue.length > 0) this.queues.set(chapterPath, queue);
    else this.queues.delete(chapterPath);
  }

  private pruneRemovedLinks(path: string, text: string): void {
    const queue = this.queues.get(path);
    if (!queue) return;
    const links = findProseWikilinks(text);
    const next = queue.filter((item) => (
      item.kind === "add-world-context"
      || links.some((link) => (
        link.raw === item.occurrence.raw
        && link.linkpath === item.occurrence.linkpath
      ))
    ));
    this.retainQueue(path, next);
  }
}
