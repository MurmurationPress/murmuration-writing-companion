import type { StoryWorldGraphEdge, StoryWorldGraphNode } from "./StoryWorldGraph";

export interface StoryWorldGraphNavigationSnapshot {
  readonly centrePath: string | null;
  readonly canBack: boolean;
  readonly canForward: boolean;
  readonly followsActiveNote: boolean;
}

export function selectStoryWorldGraphNode(
  navigation: StoryWorldGraphNavigation,
  node: StoryWorldGraphNode
): "recenter" | "detail" {
  if (node.kind === "scene") return "detail";
  navigation.navigate(node.path);
  return "recenter";
}

export function storyWorldGraphNodeOpenPath(node: StoryWorldGraphNode): string { return node.path; }
export function storyWorldGraphEdgeOpenPath(edge: StoryWorldGraphEdge): string { return edge.sourcePath; }

/** Local presentation-only graph centre history. */
export class StoryWorldGraphNavigation {
  private paths: string[] = [];
  private cursor = -1;
  private manual = false;

  get(): StoryWorldGraphNavigationSnapshot {
    return {
      centrePath: this.paths[this.cursor] ?? null,
      canBack: this.cursor > 0,
      canForward: this.cursor >= 0 && this.cursor < this.paths.length - 1,
      followsActiveNote: !this.manual
    };
  }

  initialise(path: string): void {
    if (!this.paths.length) { this.paths = [path]; this.cursor = 0; }
    else if (!this.manual) this.replace(path);
  }

  navigate(path: string): void {
    if (this.paths[this.cursor] === path) { this.manual = true; return; }
    this.paths = this.paths.slice(0, this.cursor + 1);
    this.paths.push(path); this.cursor = this.paths.length - 1; this.manual = true;
  }

  follow(path: string): void {
    this.manual = false;
    this.replace(path);
  }

  observeActive(path: string): boolean {
    if (this.manual) return false;
    this.replace(path); return true;
  }

  back(): string | null { if (this.cursor <= 0) return null; this.cursor -= 1; this.manual = true; return this.paths[this.cursor]; }
  forward(): string | null { if (this.cursor < 0 || this.cursor >= this.paths.length - 1) return null; this.cursor += 1; this.manual = true; return this.paths[this.cursor]; }

  reconcile(existingPaths: ReadonlySet<string>, renames: ReadonlyMap<string, string> = new Map()): void {
    const current = this.paths[this.cursor] ?? null;
    const translated = this.paths.map((path) => renames.get(path) ?? path).filter((path) => existingPaths.has(path));
    const unique: string[] = [];
    for (const path of translated) if (unique[unique.length - 1] !== path) unique.push(path);
    const translatedCurrent = current ? renames.get(current) ?? current : null;
    this.paths = unique;
    this.cursor = translatedCurrent ? unique.indexOf(translatedCurrent) : -1;
    if (this.cursor < 0) this.cursor = unique.length - 1;
    if (!unique.length) { this.cursor = -1; this.manual = false; }
  }

  private replace(path: string): void {
    if (this.cursor < 0) { this.paths = [path]; this.cursor = 0; return; }
    if (this.paths[this.cursor] === path) return;
    this.paths[this.cursor] = path;
    this.paths = this.paths.slice(0, this.cursor + 1);
  }
}
