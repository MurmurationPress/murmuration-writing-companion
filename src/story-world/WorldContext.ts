import {
  EDITABLE_CHAPTER_CONTEXT_FIELDS,
  normalizePropertyName
} from "../companion/ChapterContext";
import {
  parseWikilink,
  StoryWorldEntityRecord
} from "./StoryWorldIndex";

export type WorldContextReason = "pov" | "explicit";

export interface WorldContextEntry {
  readonly entity: StoryWorldEntityRecord;
  readonly reasons: readonly WorldContextReason[];
}

export interface WorldContextResult {
  readonly entries: readonly WorldContextEntry[];
  readonly unresolvedReferences: readonly string[];
  readonly invalidReferenceCount: number;
}

export interface WorldContextGroup {
  readonly entityType: string;
  readonly label: string;
  readonly entries: readonly WorldContextEntry[];
}

export type WorldStatusTone =
  | "confirmed"
  | "provisional"
  | "unresolved"
  | "superseded"
  | "unclassified"
  | "custom";

export interface WorldStatusPresentation {
  readonly value: string | null;
  readonly label: string;
  readonly tone: WorldStatusTone;
}

export type WorldContextResolver = (
  reference: string
) => StoryWorldEntityRecord | null;

interface ReferenceCandidate {
  reference: string;
  reason: WorldContextReason;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const result: string[] = [];

  for (const item of values) {
    const text = nonEmptyString(item);
    if (text) result.push(text);
  }

  return result;
}

function findPropertyValue(
  frontmatter: Record<string, unknown> | undefined,
  aliases: readonly string[]
): unknown {
  if (!frontmatter) return undefined;

  const normalizedAliases = new Set(aliases.map(normalizePropertyName));

  for (const [property, value] of Object.entries(frontmatter)) {
    if (property === "position") continue;
    if (normalizedAliases.has(normalizePropertyName(property))) return value;
  }

  return undefined;
}

function getPovValue(
  frontmatter: Record<string, unknown> | undefined
): unknown {
  const field = EDITABLE_CHAPTER_CONTEXT_FIELDS.find(
    (candidate) => candidate.key === "pov"
  );

  if (!field) return undefined;
  return findPropertyValue(frontmatter, field.aliases);
}

function getWorldContextValue(
  frontmatter: Record<string, unknown> | undefined
): unknown {
  return findPropertyValue(frontmatter, ["world_context"]);
}

function collectCandidates(
  frontmatter: Record<string, unknown> | undefined
): ReferenceCandidate[] {
  return [
    ...stringValues(getPovValue(frontmatter)).map((reference) => ({
      reference,
      reason: "pov" as const
    })),
    ...stringValues(getWorldContextValue(frontmatter)).map((reference) => ({
      reference,
      reason: "explicit" as const
    }))
  ];
}

export function buildWorldContext(
  frontmatter: Record<string, unknown> | undefined,
  resolve: WorldContextResolver
): WorldContextResult {
  const entriesByPath = new Map<
    string,
    { entity: StoryWorldEntityRecord; reasons: WorldContextReason[] }
  >();
  const unresolvedReferences: string[] = [];
  const seenUnresolved = new Set<string>();
  let invalidReferenceCount = 0;

  for (const candidate of collectCandidates(frontmatter)) {
    if (!parseWikilink(candidate.reference)) {
      invalidReferenceCount += 1;
      continue;
    }

    const entity = resolve(candidate.reference);

    if (!entity) {
      const key = candidate.reference.toLowerCase();
      if (!seenUnresolved.has(key)) {
        seenUnresolved.add(key);
        unresolvedReferences.push(candidate.reference);
      }
      continue;
    }

    const existing = entriesByPath.get(entity.path);
    if (existing) {
      if (!existing.reasons.includes(candidate.reason)) {
        existing.reasons.push(candidate.reason);
      }
      continue;
    }

    entriesByPath.set(entity.path, {
      entity,
      reasons: [candidate.reason]
    });
  }

  return {
    entries: [...entriesByPath.values()].map(({ entity, reasons }) => ({
      entity,
      reasons: [...reasons]
    })),
    unresolvedReferences,
    invalidReferenceCount
  };
}

function titleCaseWords(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatWorldEntityType(entityType: string): string {
  return titleCaseWords(entityType) || "Entity";
}

export function groupWorldContextEntries(
  entries: readonly WorldContextEntry[]
): WorldContextGroup[] {
  const groups = new Map<string, WorldContextEntry[]>();

  for (const entry of entries) {
    const key = entry.entity.entityType.trim().toLowerCase();
    const group = groups.get(key);

    if (group) {
      group.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return [...groups.entries()].map(([entityType, groupEntries]) => ({
    entityType,
    label: formatWorldEntityType(groupEntries[0]?.entity.entityType ?? entityType),
    entries: groupEntries
  }));
}

export function presentWorldStatus(
  status: string | null
): WorldStatusPresentation {
  const value = nonEmptyString(status);
  if (!value) {
    return {
      value: null,
      label: "Unclassified",
      tone: "unclassified"
    };
  }

  switch (value.toLowerCase()) {
    case "confirmed":
      return { value, label: "Confirmed", tone: "confirmed" };
    case "planned":
      return { value, label: "Planned", tone: "provisional" };
    case "candidate":
      return { value, label: "Candidate", tone: "provisional" };
    case "unresolved":
      return { value, label: "Unresolved", tone: "unresolved" };
    case "superseded":
      return { value, label: "Superseded", tone: "superseded" };
    default:
      return {
        value,
        label: titleCaseWords(value),
        tone: "custom"
      };
  }
}

export function buildWorldContextSummary(
  result: WorldContextResult,
  maxNames = 3
): string {
  if (result.entries.length === 0) {
    return result.unresolvedReferences.length > 0
      ? "No resolved world context"
      : "No world context";
  }

  const safeLimit = Math.max(1, maxNames);
  const names = result.entries
    .slice(0, safeLimit)
    .map((entry) => entry.entity.name);
  const remaining = result.entries.length - names.length;

  return remaining > 0
    ? `${names.join(" · ")} +${remaining}`
    : names.join(" · ");
}

export function buildWorldContextStatus(result: WorldContextResult): string {
  const entityCount = result.entries.length;
  const unresolvedCount = result.unresolvedReferences.length;

  if (entityCount === 0 && unresolvedCount === 0) return "";

  const entityText = entityCount > 0
    ? `${entityCount} ${entityCount === 1 ? "entity" : "entities"}`
    : "";
  const unresolvedText = unresolvedCount > 0
    ? `${unresolvedCount} unresolved`
    : "";

  return [entityText, unresolvedText].filter(Boolean).join(" · ");
}
