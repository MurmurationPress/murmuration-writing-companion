import { parseWikilink } from "./StoryWorldIndex";
import {
  STORY_WORLD_RELATION_PREDICATE_OPTIONS,
  STORY_WORLD_RELATION_STATUS_OPTIONS
} from "../companion/StoryWorldRelationAuthoring";

export const ENTITY_RELATIONSHIP_STATUSES = STORY_WORLD_RELATION_STATUS_OPTIONS;
export const ENTITY_RELATIONSHIP_PREDICATES = STORY_WORLD_RELATION_PREDICATE_OPTIONS;

export type EntityRelationshipObjectKind = "target" | "value";
export type EntityRelationshipMutationKind = "add" | "edit" | "supersede" | "remove";

export interface EntityRelationshipProjection {
  readonly index: number;
  readonly raw: unknown;
  readonly valid: boolean;
  readonly sentence: string;
  readonly issue: string | null;
  readonly predicate: string | null;
  readonly predicateLabel: string | null;
  readonly objectKind: EntityRelationshipObjectKind | null;
  readonly objectValue: string | number | boolean | null;
  readonly objectLabel: string | null;
  readonly status: string | null;
  readonly statusLabel: string;
  readonly sources: readonly string[];
  readonly qualifiers: Readonly<Record<string, unknown>>;
}

export interface EntityRelationshipDraft {
  readonly predicate: string;
  readonly predicateLabel?: string | null;
  readonly objectKind: EntityRelationshipObjectKind;
  readonly objectValue: string | number | boolean;
  readonly status: string;
  readonly qualifierUpdates?: Readonly<Record<string, unknown | undefined>>;
}

export interface EntityRelationshipMutation {
  readonly kind: EntityRelationshipMutationKind;
  readonly index?: number;
  readonly draft?: EntityRelationshipDraft;
}

const ASSERTION_KEYS = new Set(["predicate", "predicate_label", "target", "value", "status"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cloneRelationshipValue(value: unknown): unknown {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(cloneRelationshipValue);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneRelationshipValue(item)]));
  }
  return value;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function literal(value: unknown): string | number | boolean | null {
  if (typeof value === "string") return value.trim() || null;
  return typeof value === "number" || typeof value === "boolean" ? value : null;
}

function targetLabel(value: string): string | null {
  const parsed = parseWikilink(value);
  if (!parsed) return null;
  return parsed.displayText ?? (parsed.linkpath.split("/").pop() ?? parsed.linkpath);
}

export function readablePredicateLabel(predicate: string, customLabel?: unknown): string {
  return text(customLabel)
    ?? ENTITY_RELATIONSHIP_PREDICATES.find((option) => option.value === predicate)?.label
    ?? predicate.replace(/[_-]+/g, " ");
}

export function readableStatusLabel(status: unknown): string {
  const stored = text(status);
  if (!stored) return "Unclassified";
  return ENTITY_RELATIONSHIP_STATUSES.find((option) => option.value === stored)?.label
    ?? (stored === "superseded" ? "Superseded" : `Unrecognised status: ${stored}`);
}

function sources(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map(text).filter((item): item is string => item !== null);
}

export function projectEntityRelationships(subject: string, value: unknown): EntityRelationshipProjection[] {
  if (value != null && !Array.isArray(value)) {
    return [{
      index: -1,
      raw: cloneRelationshipValue(value),
      valid: false,
      sentence: "Incomplete relationship collection.",
      issue: "The world_relationships property is not a list and was left unchanged.",
      predicate: null,
      predicateLabel: null,
      objectKind: null,
      objectValue: null,
      objectLabel: null,
      status: null,
      statusLabel: "Unclassified",
      sources: [],
      qualifiers: {}
    }];
  }
  const values = value ?? [];
  return values.map((raw, index) => {
    if (!isRecord(raw)) {
      return {
        index, raw, valid: false, sentence: "Incomplete relationship assertion.",
        issue: "This relationship is not a structured assertion and was left unchanged.",
        predicate: null, predicateLabel: null, objectKind: null, objectValue: null,
        objectLabel: null, status: null, statusLabel: "Unclassified", sources: [], qualifiers: {}
      };
    }

    const predicate = text(raw.predicate);
    const target = text(raw.target);
    const parsedTarget = target ? targetLabel(target) : null;
    const valueObject = literal(raw.value);
    const hasTarget = parsedTarget !== null;
    const hasValue = valueObject !== null;
    const valid = predicate !== null && hasTarget !== hasValue;
    const predicateLabel = predicate ? readablePredicateLabel(predicate, raw.predicate_label) : null;
    const objectKind = hasTarget ? "target" : hasValue ? "value" : null;
    const objectValue = hasTarget ? target : valueObject;
    const objectLabel = hasTarget ? parsedTarget : hasValue ? String(valueObject) : null;
    const issue = valid ? null : !predicate
      ? "This assertion has no predicate."
      : hasTarget && hasValue
        ? "This assertion has both a target and a literal value; exactly one is required."
        : target && !parsedTarget
          ? "This assertion's target is not a valid wikilink."
          : "This assertion needs either a target or a literal value.";
    const qualifiers = Object.fromEntries(Object.entries(raw)
      .filter(([key]) => !ASSERTION_KEYS.has(key))
      .map(([key, item]) => [key, cloneRelationshipValue(item)]));
    const status = text(raw.status);
    return {
      index,
      raw: cloneRelationshipValue(raw),
      valid,
      sentence: valid ? `${subject} ${predicateLabel} ${objectLabel}.` : "Incomplete relationship assertion.",
      issue,
      predicate,
      predicateLabel,
      objectKind,
      objectValue,
      objectLabel,
      status,
      statusLabel: readableStatusLabel(status),
      sources: sources(raw.source),
      qualifiers
    };
  });
}

export function relationshipProperty(frontmatter: Record<string, unknown>): string {
  return Object.keys(frontmatter).find((key) => key.toLowerCase().replace(/[\s_-]+/g, "") === "worldrelationships")
    ?? "world_relationships";
}

function relationshipList(frontmatter: Record<string, unknown>): unknown[] {
  const current = frontmatter[relationshipProperty(frontmatter)];
  if (current == null) return [];
  if (!Array.isArray(current)) throw new Error("world_relationships is not a list and was left unchanged.");
  return current.map(cloneRelationshipValue);
}

function draftRelationship(draft: EntityRelationshipDraft, existing?: unknown): Record<string, unknown> {
  const predicate = text(draft.predicate);
  const status = text(draft.status);
  const object = draft.objectKind === "target" ? text(draft.objectValue) : literal(draft.objectValue);
  if (!predicate || !status || object === null) throw new Error("Complete the predicate, object and authorial status before saving.");
  if (draft.objectKind === "target" && !parseWikilink(object)) throw new Error("Relationship targets must be wikilinks to authoritative notes.");

  const result = isRecord(existing) ? cloneRelationshipValue(existing) as Record<string, unknown> : {};
  result.predicate = predicate;
  if (text(draft.predicateLabel)) result.predicate_label = text(draft.predicateLabel)!;
  else delete result.predicate_label;
  if (draft.objectKind === "target") {
    result.target = object;
    delete result.value;
  } else {
    result.value = object;
    delete result.target;
  }
  result.status = status;
  for (const [key, value] of Object.entries(draft.qualifierUpdates ?? {})) {
    if (ASSERTION_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === "") delete result[key];
    else result[key] = cloneRelationshipValue(value);
  }
  return result;
}

export function applyEntityRelationshipMutation(
  frontmatter: Record<string, unknown>,
  mutation: EntityRelationshipMutation
): Record<string, unknown> {
  const next = cloneRelationshipValue(frontmatter) as Record<string, unknown>;
  const property = relationshipProperty(next);
  const values = relationshipList(next);
  if (mutation.kind === "add") {
    if (!mutation.draft) throw new Error("A relationship draft is required.");
    values.push(draftRelationship(mutation.draft));
  } else {
    const index = mutation.index;
    if (index === undefined || index < 0 || index >= values.length) throw new Error("The relationship no longer exists.");
    if (mutation.kind === "edit") {
      if (!mutation.draft) throw new Error("A relationship draft is required.");
      values[index] = draftRelationship(mutation.draft, values[index]);
    } else if (mutation.kind === "supersede") {
      if (!isRecord(values[index])) throw new Error("Only structured relationships can be superseded.");
      (values[index] as Record<string, unknown>).status = "superseded";
    } else {
      values.splice(index, 1);
    }
  }
  if (values.length) next[property] = values;
  else delete next[property];
  return next;
}

export function relationshipValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => relationshipValuesEqual(value, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).filter((key) => key !== "position");
    const rightKeys = Object.keys(right).filter((key) => key !== "position");
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key)
        && relationshipValuesEqual(left[key], right[key]));
  }
  return false;
}
