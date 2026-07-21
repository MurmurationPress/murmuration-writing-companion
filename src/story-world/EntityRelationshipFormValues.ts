import { shortestUnambiguousWikilink } from "../companion/StoryWorldEventCreation";
import { parseWikilink, StoryWorldEntityRecord } from "./StoryWorldIndex";

export interface ResolvedEntityRelationshipTarget {
  readonly entity: StoryWorldEntityRecord | null;
  readonly reference: string | null;
  readonly displayName: string | null;
  readonly error: string | null;
}

function normalize(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\.md$/i, "").toLowerCase();
}

function lookupValues(entity: StoryWorldEntityRecord): string[] {
  return [entity.name, ...entity.aliases, entity.basename, entity.path];
}

export function resolveEntityRelationshipTarget(
  input: string,
  entities: readonly StoryWorldEntityRecord[],
  existingPaths: readonly string[]
): ResolvedEntityRelationshipTarget {
  const trimmed = input.trim();
  if (!trimmed) return { entity: null, reference: null, displayName: null, error: "Choose a Story World target." };
  const parsed = parseWikilink(trimmed);
  const lookup = normalize(parsed?.linkpath ?? trimmed);
  const matches = entities.filter((entity) => lookupValues(entity).some((value) => normalize(value) === lookup));
  if (!matches.length) {
    return { entity: null, reference: null, displayName: null, error: `No Story World entity matches “${trimmed}”.` };
  }
  if (matches.length > 1) {
    return { entity: null, reference: null, displayName: null, error: `“${trimmed}” is ambiguous. Choose a canonical entity name.` };
  }
  const entity = matches[0];
  return {
    entity,
    reference: shortestUnambiguousWikilink(entity.path, entity.name, existingPaths),
    displayName: parsed?.displayText ?? entity.name,
    error: null
  };
}

export function exactIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] ? value : null;
}

export interface ExactDateQualifierState {
  readonly original: unknown;
  readonly exactValue: string;
  readonly requiresReplacement: boolean;
  readonly preservedLabel: string | null;
}

export function exactDateQualifierState(value: unknown): ExactDateQualifierState {
  const exact = exactIsoDate(value);
  const absent = value === undefined || value === null || value === "";
  return {
    original: value,
    exactValue: exact ?? "",
    requiresReplacement: !absent && exact === null,
    preservedLabel: !absent && exact === null
      ? (typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : "Preserved structured value")
      : null
  };
}

export function exactDateQualifierUpdate(
  state: ExactDateQualifierState,
  replacementEnabled: boolean,
  inputValue: string
): { changed: boolean; value?: string } {
  if (state.requiresReplacement && !replacementEnabled) return { changed: false };
  const exact = exactIsoDate(inputValue);
  if (!exact) return { changed: false };
  return exact === state.original ? { changed: false } : { changed: true, value: exact };
}
