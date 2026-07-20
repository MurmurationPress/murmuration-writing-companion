import type { PovSuggestion } from "./PovSuggestions";
import { parseWikilink } from "../story-world/StoryWorldIndex";

export interface PovCharacterCreationProposal {
  readonly sourceValue: string;
  readonly name: string;
  readonly path: string;
  readonly povValue: string;
  readonly scope: readonly string[];
}

export interface PovCharacterCreationOptions {
  readonly suggestions: readonly PovSuggestion[];
  readonly existingPaths: readonly string[];
  readonly scope?: readonly string[];
  readonly fallbackFolder?: string;
}

function normalizeLookup(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .toLowerCase();
}

function normalizeVaultPath(value: string): string | null {
  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
  if (!normalized) return null;
  if (normalized.split("/").some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  return normalized;
}

function basenameWithoutExtension(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

function parentFolder(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  return slash < 0 ? "" : normalized.slice(0, slash);
}

function compactName(value: string): string | null {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 0 ? compact : null;
}

export function extractPovCharacterName(value: string): string | null {
  const source = value.trim();
  if (!source) return null;

  const parsed = parseWikilink(source);
  if (parsed) {
    return compactName(
      parsed.displayText
      ?? basenameWithoutExtension(parsed.linkpath)
    );
  }

  return compactName(source);
}

export function findMatchingPovSuggestions(
  value: string,
  suggestions: readonly PovSuggestion[]
): PovSuggestion[] {
  const parsed = parseWikilink(value);
  const name = extractPovCharacterName(value);
  const nameKey = name ? normalizeLookup(name) : "";
  const targetKey = parsed ? normalizeLookup(parsed.linkpath) : "";

  return suggestions.filter((suggestion) => {
    if (
      targetKey
      && normalizeLookup(suggestion.entity.path) === targetKey
    ) {
      return true;
    }

    return Boolean(
      nameKey
      && suggestion.matches.some((candidate) => (
        normalizeLookup(candidate) === nameKey
      ))
    );
  });
}

function preferredCharacterFolder(
  suggestions: readonly PovSuggestion[],
  fallbackFolder: string
): string {
  const scoped = suggestions.filter((suggestion) => suggestion.scoped);
  const candidates = scoped.length > 0 ? scoped : suggestions;
  const counts = new Map<string, { path: string; count: number }>();

  for (const suggestion of candidates) {
    const folder = parentFolder(suggestion.entity.path);
    if (!folder) continue;
    const key = folder.toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { path: folder, count: 1 });
  }

  const ranked = [...counts.values()].sort((left, right) => (
    right.count - left.count
    || left.path.localeCompare(right.path, "en", { sensitivity: "base" })
  ));

  return normalizeVaultPath(ranked[0]?.path ?? fallbackFolder)
    ?? "Story World/Characters";
}

function safeFilename(name: string): string | null {
  const safe = name
    .replace(/[\\/:*?"<>|#^\[\]]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return safe.length > 0 ? safe : null;
}

function withMarkdownExtension(path: string): string {
  return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
}

function uniqueCharacterPath(
  preferredPath: string,
  existingPaths: readonly string[]
): string {
  const existing = new Set(existingPaths.map((path) => path.toLowerCase()));
  const normalized = withMarkdownExtension(preferredPath);
  if (!existing.has(normalized.toLowerCase())) return normalized;

  const base = normalized.replace(/\.md$/i, "");
  const firstAlternative = `${base} (character).md`;
  if (!existing.has(firstAlternative.toLowerCase())) return firstAlternative;

  let suffix = 2;
  while (existing.has(`${base} (character ${suffix}).md`.toLowerCase())) {
    suffix += 1;
  }
  return `${base} (character ${suffix}).md`;
}

function hasMarkdownBasenameCollision(
  path: string,
  existingPaths: readonly string[]
): boolean {
  const basenameKey = normalizeLookup(basenameWithoutExtension(path));
  return existingPaths.some((candidate) => (
    candidate.toLowerCase().endsWith(".md")
    && normalizeLookup(basenameWithoutExtension(candidate)) === basenameKey
  ));
}

function canonicalPovValue(
  path: string,
  name: string,
  existingPaths: readonly string[],
  preserveExplicitTarget: boolean
): string {
  const fullTarget = path.replace(/\.md$/i, "");
  const basename = basenameWithoutExtension(path);
  const target = preserveExplicitTarget
    || hasMarkdownBasenameCollision(path, existingPaths)
    ? fullTarget
    : basename;

  return normalizeLookup(basename) === normalizeLookup(name)
    ? `[[${target}]]`
    : `[[${target}|${name}]]`;
}

function normalizedScope(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function buildPovCharacterCreationProposal(
  value: string,
  options: PovCharacterCreationOptions
): PovCharacterCreationProposal | null {
  const sourceValue = value.trim();
  const name = extractPovCharacterName(sourceValue);
  if (!sourceValue || !name) return null;
  if (findMatchingPovSuggestions(sourceValue, options.suggestions).length > 0) {
    return null;
  }

  const filename = safeFilename(name);
  if (!filename) return null;

  const parsed = parseWikilink(sourceValue);
  const explicitTarget = parsed
    ? normalizeVaultPath(parsed.linkpath.replace(/\.md$/i, ""))
    : null;
  const fallbackFolder = preferredCharacterFolder(
    options.suggestions,
    options.fallbackFolder ?? "Story World/Characters"
  );
  const preferredPath = explicitTarget?.includes("/")
    ? withMarkdownExtension(explicitTarget)
    : `${fallbackFolder}/${filename}.md`;
  const path = uniqueCharacterPath(preferredPath, options.existingPaths);
  const preserveExplicitTarget = Boolean(explicitTarget?.includes("/"));

  return {
    sourceValue,
    name,
    path,
    povValue: canonicalPovValue(
      path,
      name,
      options.existingPaths,
      preserveExplicitTarget
    ),
    scope: normalizedScope(options.scope ?? [])
  };
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function buildPovCharacterMarkdown(
  proposal: PovCharacterCreationProposal
): string {
  const lines = [
    "---",
    "world_entity: character",
    `world_name: ${yamlString(proposal.name)}`
  ];

  if (proposal.scope.length > 0) {
    lines.push("world_scope:");
    for (const scope of proposal.scope) {
      lines.push(`  - ${yamlString(scope)}`);
    }
  }

  lines.push(
    "---",
    "",
    `# ${proposal.name}`,
    "",
    "Character details to be added.",
    ""
  );

  return lines.join("\n");
}
