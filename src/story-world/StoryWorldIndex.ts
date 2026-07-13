export interface StoryWorldDocument {
  path: string;
  basename: string;
  frontmatter?: Record<string, unknown> | null;
}

export interface StoryWorldEntityRecord {
  readonly path: string;
  readonly basename: string;
  readonly entityType: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly facets: readonly string[];
  readonly scope: readonly string[];
  readonly status: string | null;
  readonly summary: string | null;
  readonly firstAppearance: string | null;
  readonly sources: readonly string[];
  readonly links: readonly string[];
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface ParsedWikilink {
  linkpath: string;
  displayText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of values) {
    const text = nonEmptyString(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }

  return result;
}

function cloneValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (value instanceof Date) return new Date(value.getTime());

  if (Array.isArray(value)) {
    if (seen.has(value)) return seen.get(value);
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) copy.push(cloneValue(item, seen));
    return copy;
  }

  if (isRecord(value)) {
    if (seen.has(value)) return seen.get(value);
    const copy: Record<string, unknown> = {};
    seen.set(value, copy);
    for (const [key, item] of Object.entries(value)) {
      copy[key] = cloneValue(item, seen);
    }
    return copy;
  }

  return value;
}

function cloneProperties(frontmatter: Record<string, unknown>): Record<string, unknown> {
  return cloneValue(frontmatter) as Record<string, unknown>;
}

function basenameFromPath(path: string): string {
  const filename = path.split("/").pop() ?? path;
  return filename.toLowerCase().endsWith(".md")
    ? filename.slice(0, -3)
    : filename;
}

function collectWikilinks(
  value: unknown,
  output: string[],
  seenLinks: Set<string>,
  visited: WeakSet<object>
) {
  if (typeof value === "string") {
    const matches = value.match(/\[\[[^\]\n]+\]\]/g) ?? [];
    for (const match of matches) {
      if (seenLinks.has(match)) continue;
      seenLinks.add(match);
      output.push(match);
    }
    return;
  }

  if (typeof value !== "object" || value === null) return;
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectWikilinks(item, output, seenLinks, visited);
    return;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    collectWikilinks(item, output, seenLinks, visited);
  }
}

function extractStoryWorldLinks(frontmatter: Record<string, unknown>): string[] {
  const output: string[] = [];
  const seenLinks = new Set<string>();
  const visited = new WeakSet<object>();

  for (const [key, value] of Object.entries(frontmatter)) {
    if (!key.startsWith("world_")) continue;
    collectWikilinks(value, output, seenLinks, visited);
  }

  return output;
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

function findUnescapedPipe(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "|") continue;

    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
      backslashes += 1;
    }

    if (backslashes % 2 === 0) return index;
  }

  return -1;
}

export function parseWikilink(value: unknown): ParsedWikilink | null {
  const text = nonEmptyString(value);
  if (!text) return null;

  const match = /^\[\[([\s\S]+)\]\]$/.exec(text);
  if (!match) return null;

  const inner = match[1].trim();
  const pipeIndex = findUnescapedPipe(inner);
  const rawTarget = (pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner).trim();
  const displayText = pipeIndex >= 0
    ? nonEmptyString(inner.slice(pipeIndex + 1).replace(/\\\|/g, "|"))
    : null;
  const linkpath = rawTarget.split("#", 1)[0].trim();

  if (!linkpath) return null;
  return { linkpath, displayText };
}

export function parseStoryWorldEntity(
  document: StoryWorldDocument
): StoryWorldEntityRecord | null {
  const path = nonEmptyString(document.path);
  const frontmatter = document.frontmatter;

  if (!path || !isRecord(frontmatter)) return null;

  const entityType = nonEmptyString(frontmatter.world_entity);
  if (!entityType) return null;

  const basename = nonEmptyString(document.basename) ?? basenameFromPath(path);
  const name = nonEmptyString(frontmatter.world_name)
    ?? nonEmptyString(frontmatter.title)
    ?? basename;

  return {
    path,
    basename,
    entityType,
    name,
    aliases: stringList(frontmatter.aliases),
    facets: stringList(frontmatter.world_facets),
    scope: stringList(frontmatter.world_scope),
    status: nonEmptyString(frontmatter.world_status),
    summary: nonEmptyString(frontmatter.world_summary),
    firstAppearance: nonEmptyString(frontmatter.world_first_appearance),
    sources: stringList(frontmatter.world_sources),
    links: extractStoryWorldLinks(frontmatter),
    properties: cloneProperties(frontmatter)
  };
}

function sameEntity(
  left: StoryWorldEntityRecord,
  right: StoryWorldEntityRecord
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class StoryWorldIndex {
  private readonly entitiesByPath = new Map<string, StoryWorldEntityRecord>();
  private readonly pathsByName = new Map<string, Set<string>>();
  private readonly pathsByType = new Map<string, Set<string>>();

  get size(): number {
    return this.entitiesByPath.size;
  }

  rebuild(documents: Iterable<StoryWorldDocument>): boolean {
    const before = JSON.stringify(this.getAll());
    this.clear();

    for (const document of documents) {
      this.upsert(document);
    }

    return before !== JSON.stringify(this.getAll());
  }

  upsert(document: StoryWorldDocument): boolean {
    const path = nonEmptyString(document.path);
    if (!path) return false;

    const next = parseStoryWorldEntity(document);
    const existing = this.entitiesByPath.get(path);

    if (!next) {
      return existing ? this.remove(path) : false;
    }

    if (existing && sameEntity(existing, next)) return false;
    if (existing) this.removeFromSecondaryIndexes(existing);

    this.entitiesByPath.set(path, next);
    this.addToSecondaryIndexes(next);
    return true;
  }

  remove(path: string): boolean {
    const existing = this.entitiesByPath.get(path);
    if (!existing) return false;

    this.entitiesByPath.delete(path);
    this.removeFromSecondaryIndexes(existing);
    return true;
  }

  rename(
    oldPath: string,
    document: StoryWorldDocument
  ): boolean {
    const removed = oldPath === document.path ? false : this.remove(oldPath);
    return this.upsert(document) || removed;
  }

  clear(): void {
    this.entitiesByPath.clear();
    this.pathsByName.clear();
    this.pathsByType.clear();
  }

  getByPath(path: string): StoryWorldEntityRecord | null {
    return this.entitiesByPath.get(path) ?? null;
  }

  findByNameOrAlias(value: string): StoryWorldEntityRecord[] {
    return this.recordsForPaths(this.pathsByName.get(normalizeLookup(value)));
  }

  findByType(value: string): StoryWorldEntityRecord[] {
    return this.recordsForPaths(this.pathsByType.get(normalizeLookup(value)));
  }

  getAll(): StoryWorldEntityRecord[] {
    return [...this.entitiesByPath.values()]
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  private addToSecondaryIndexes(entity: StoryWorldEntityRecord) {
    for (const value of [entity.name, ...entity.aliases]) {
      this.addPath(this.pathsByName, normalizeLookup(value), entity.path);
    }

    this.addPath(
      this.pathsByType,
      normalizeLookup(entity.entityType),
      entity.path
    );
  }

  private removeFromSecondaryIndexes(entity: StoryWorldEntityRecord) {
    for (const value of [entity.name, ...entity.aliases]) {
      this.removePath(this.pathsByName, normalizeLookup(value), entity.path);
    }

    this.removePath(
      this.pathsByType,
      normalizeLookup(entity.entityType),
      entity.path
    );
  }

  private addPath(
    index: Map<string, Set<string>>,
    key: string,
    path: string
  ) {
    let paths = index.get(key);
    if (!paths) {
      paths = new Set<string>();
      index.set(key, paths);
    }
    paths.add(path);
  }

  private removePath(
    index: Map<string, Set<string>>,
    key: string,
    path: string
  ) {
    const paths = index.get(key);
    if (!paths) return;

    paths.delete(path);
    if (paths.size === 0) index.delete(key);
  }

  private recordsForPaths(paths: Set<string> | undefined): StoryWorldEntityRecord[] {
    if (!paths) return [];

    return [...paths]
      .map((path) => this.entitiesByPath.get(path))
      .filter((entity): entity is StoryWorldEntityRecord => Boolean(entity))
      .sort((left, right) => left.path.localeCompare(right.path));
  }
}
