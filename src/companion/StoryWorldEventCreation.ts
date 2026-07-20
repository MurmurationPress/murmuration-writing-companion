import type { StoryWorldEntityRecord } from "../story-world/StoryWorldIndex";
import type { ProseWikilinkOccurrence } from "./ProseWikilinkChanges";

export type StoryWorldEventDateMode = "chapter" | "custom" | "undated";

export interface StoryWorldEventDateDecision {
  readonly mode: StoryWorldEventDateMode;
  readonly date: string | null;
}

export interface StoryWorldEventCreationProposal {
  readonly chapterPath: string;
  readonly sourceRawLink: string;
  readonly sourceLinkpath: string;
  readonly name: string;
  readonly path: string;
  readonly scope: readonly string[];
  readonly sources: readonly string[];
  readonly worldContextReference: string;
  readonly chapterStoryDate: string | null;
}

export interface StoryWorldEventCreationOptions {
  readonly entities: readonly StoryWorldEntityRecord[];
  readonly existingPaths: readonly string[];
  readonly chapterPath: string;
  readonly bookPath?: string | null;
  readonly scopeReferences?: readonly string[];
  readonly chapterStoryDate?: unknown;
  readonly fallbackFolder?: string;
}

function normalizeLookup(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|", 1)[0]
    .replace(/\.md$/i, "")
    .toLowerCase();
}

function basenameWithoutExtension(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

function parentFolder(path: string): string {
  const slash = path.replace(/\\/g, "/").lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash).replace(/\\/g, "/");
}

function normalizeVaultTarget(value: string): string | null {
  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/\.md$/i, "");
  if (!normalized) return null;
  if (normalized.split("/").some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  return normalized;
}

function isSafePathSegment(value: string): boolean {
  return value.length > 0
    && value.trim() === value
    && !/[\\:*?"<>|#^\[\]]/.test(value)
    && !/[. ]$/.test(value);
}

function isSafeTarget(target: string): boolean {
  return target.split("/").every(isSafePathSegment);
}

function withMarkdownExtension(path: string): string {
  return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
}

function compactName(value: string): string | null {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 0 ? compact : null;
}

export function extractProseEventName(
  occurrence: ProseWikilinkOccurrence
): string | null {
  return compactName(
    occurrence.displayText
    ?? basenameWithoutExtension(occurrence.linkpath)
  );
}

function isEvent(entity: StoryWorldEntityRecord): boolean {
  return entity.entityType.trim().toLowerCase() === "event";
}

export function findMatchingStoryWorldEvents(
  occurrence: ProseWikilinkOccurrence,
  entities: readonly StoryWorldEntityRecord[]
): StoryWorldEntityRecord[] {
  const target = normalizeLookup(occurrence.linkpath);
  const name = normalizeLookup(extractProseEventName(occurrence) ?? "");

  return entities.filter((entity) => {
    if (!isEvent(entity)) return false;
    if (normalizeLookup(entity.path) === target) return true;
    if (normalizeLookup(entity.basename) === target) return true;
    return Boolean(name && [entity.name, ...entity.aliases].some((candidate) => (
      normalizeLookup(candidate) === name
    )));
  });
}

function scopeMatches(
  entity: StoryWorldEntityRecord,
  scopeReferences: readonly string[]
): boolean {
  if (entity.scope.length === 0 || scopeReferences.length === 0) return false;
  const expected = new Set(scopeReferences.map(normalizeLookup).filter(Boolean));
  return entity.scope.some((scope) => {
    const normalized = normalizeLookup(scope);
    return expected.has(normalized)
      || expected.has(normalizeLookup(basenameWithoutExtension(normalized)));
  });
}

function preferredEventFolder(
  entities: readonly StoryWorldEntityRecord[],
  scopeReferences: readonly string[],
  fallbackFolder: string
): string {
  const events = entities.filter(isEvent);
  const scoped = events.filter((entity) => scopeMatches(entity, scopeReferences));
  const candidates = scoped.length > 0 ? scoped : events;
  const counts = new Map<string, { path: string; count: number }>();

  for (const entity of candidates) {
    const folder = parentFolder(entity.path);
    if (!folder) continue;
    const key = folder.toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { path: folder, count: 1 });
  }

  const selected = [...counts.values()].sort((left, right) => (
    right.count - left.count
    || left.path.localeCompare(right.path, "en", { sensitivity: "base" })
  ))[0]?.path ?? fallbackFolder;
  return normalizeVaultTarget(selected) ?? "Story World/Events";
}

function pathExists(path: string, existingPaths: readonly string[]): boolean {
  const key = path.toLowerCase();
  return existingPaths.some((candidate) => candidate.toLowerCase() === key);
}

function basenameCollision(path: string, existingPaths: readonly string[]): boolean {
  const pathKey = path.toLowerCase();
  const basename = normalizeLookup(basenameWithoutExtension(path));
  return existingPaths.some((candidate) => (
    candidate.toLowerCase().endsWith(".md")
    && candidate.toLowerCase() !== pathKey
    && normalizeLookup(basenameWithoutExtension(candidate)) === basename
  ));
}

export function shortestUnambiguousWikilink(
  path: string,
  displayName: string | null,
  existingPaths: readonly string[]
): string {
  const targetPath = path.replace(/\.md$/i, "");
  const basename = basenameWithoutExtension(path);
  const target = basenameCollision(path, existingPaths) ? targetPath : basename;
  const name = displayName?.trim() ?? "";
  return name && normalizeLookup(name) !== normalizeLookup(basename)
    ? `[[${target}|${name}]]`
    : `[[${target}]]`;
}

export function isExactStoryDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function buildStoryWorldEventCreationProposal(
  occurrence: ProseWikilinkOccurrence,
  options: StoryWorldEventCreationOptions
): StoryWorldEventCreationProposal | null {
  if (findMatchingStoryWorldEvents(occurrence, options.entities).length > 0) return null;
  const name = extractProseEventName(occurrence);
  const target = normalizeVaultTarget(occurrence.linkpath);
  if (!name || !target || !isSafeTarget(target)) return null;

  const explicitPath = target.includes("/");
  const folder = preferredEventFolder(
    options.entities,
    options.scopeReferences ?? [],
    options.fallbackFolder ?? "Story World/Events"
  );
  const path = withMarkdownExtension(
    explicitPath ? target : `${folder}/${target}`
  );

  if (pathExists(path, options.existingPaths)) return null;
  if (!explicitPath && basenameCollision(path, options.existingPaths)) return null;

  const chapterPath = withMarkdownExtension(options.chapterPath);
  const sources = [shortestUnambiguousWikilink(
    chapterPath,
    basenameWithoutExtension(chapterPath),
    options.existingPaths
  )];
  const scope = options.bookPath
    ? [shortestUnambiguousWikilink(
      withMarkdownExtension(options.bookPath),
      basenameWithoutExtension(options.bookPath),
      options.existingPaths
    )]
    : [];

  return {
    chapterPath,
    sourceRawLink: occurrence.raw,
    sourceLinkpath: occurrence.linkpath,
    name,
    path,
    scope,
    sources,
    worldContextReference: shortestUnambiguousWikilink(
      path,
      name,
      options.existingPaths
    ),
    chapterStoryDate: isExactStoryDate(options.chapterStoryDate)
      ? options.chapterStoryDate.trim()
      : null
  };
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function buildStoryWorldEventMarkdown(
  proposal: StoryWorldEventCreationProposal,
  decision: StoryWorldEventDateDecision
): string {
  if (decision.date !== null && !isExactStoryDate(decision.date)) {
    throw new Error("Event dates must be exact YYYY-MM-DD calendar dates.");
  }

  const lines = [
    "---",
    "world_entity: event",
    `world_name: ${yamlString(proposal.name)}`
  ];

  if (proposal.scope.length > 0) {
    lines.push("world_scope:");
    for (const scope of proposal.scope) lines.push(`  - ${yamlString(scope)}`);
  }
  if (proposal.sources.length > 0) {
    lines.push("world_sources:");
    for (const source of proposal.sources) lines.push(`  - ${yamlString(source)}`);
  }
  if (decision.date) {
    lines.push(
      "world_time:",
      `  at: ${yamlString(decision.date)}`,
      "  precision: day"
    );
  }

  lines.push(
    "---",
    "",
    `# ${proposal.name}`,
    "",
    "Event details to be added.",
    ""
  );
  return lines.join("\n");
}
