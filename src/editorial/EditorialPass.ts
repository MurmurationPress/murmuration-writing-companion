import type { PageEditorialNotes } from "./EditorialNote";

export const EDITORIAL_PASS_OPTIONS = [
  "draft",
  "structure",
  "character",
  "dialogue",
  "continuity",
  "style",
  "proof"
] as const;

export type EditorialPassKey = typeof EDITORIAL_PASS_OPTIONS[number];
export type EditorialPassAction = "completed" | "reopened";

export const EDITORIAL_PASS_LABELS: Readonly<Record<EditorialPassKey, string>> = {
  draft: "Draft",
  structure: "Structure",
  character: "Character",
  dialogue: "Dialogue",
  continuity: "Continuity",
  style: "Style",
  proof: "Proof"
};

export interface EditorialPassEvent {
  id: string;
  pass: EditorialPassKey;
  action: EditorialPassAction;
  at: string;
  [key: string]: unknown;
}

export interface EditorialPassChecklistItem {
  key: EditorialPassKey;
  label: string;
  completed: boolean;
  completedAt?: string;
  lastChangedAt?: string;
  history: EditorialPassEvent[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isEditorialPassKey(value: unknown): value is EditorialPassKey {
  return typeof value === "string"
    && (EDITORIAL_PASS_OPTIONS as readonly string[]).includes(value);
}

export function parseEditorialPassEvent(value: unknown): EditorialPassEvent | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.length === 0) return null;
  if (!isEditorialPassKey(value.pass)) return null;
  if (value.action !== "completed" && value.action !== "reopened") return null;
  if (typeof value.at !== "string" || value.at.length === 0) return null;

  return value as EditorialPassEvent;
}

/**
 * Convert missing or malformed history into an append-safe array without
 * discarding the original value. Invalid entries remain stored and are simply
 * ignored when the checklist is derived.
 */
export function ensureEditorialPassHistory(page: PageEditorialNotes): boolean {
  const history = page.editorialPassHistory;
  if (Array.isArray(history)) return false;

  page.editorialPassHistory = history === undefined ? [] : [history];
  return true;
}

export function getEditorialPassHistory(page: PageEditorialNotes): unknown[] {
  const history = page.editorialPassHistory;
  if (Array.isArray(history)) return history;
  return history === undefined ? [] : [history];
}

export function getEditorialPassChecklist(
  page: PageEditorialNotes
): EditorialPassChecklistItem[] {
  const items = new Map<EditorialPassKey, EditorialPassChecklistItem>();

  for (const key of EDITORIAL_PASS_OPTIONS) {
    items.set(key, {
      key,
      label: EDITORIAL_PASS_LABELS[key],
      completed: false,
      history: []
    });
  }

  const seenEventIds = new Set<string>();

  for (const rawEvent of getEditorialPassHistory(page)) {
    const event = parseEditorialPassEvent(rawEvent);
    if (!event || seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);

    const item = items.get(event.pass);
    if (!item) continue;

    item.history.push(event);
    item.lastChangedAt = event.at;

    if (event.action === "completed") {
      item.completed = true;
      item.completedAt = event.at;
    } else {
      item.completed = false;
      delete item.completedAt;
    }
  }

  return EDITORIAL_PASS_OPTIONS.map((key) => items.get(key)!);
}

export function setEditorialPassCompleted(
  page: PageEditorialNotes,
  pass: EditorialPassKey,
  completed: boolean,
  at: string,
  eventId: string
): boolean {
  const current = getEditorialPassChecklist(page).find((item) => item.key === pass);
  if (!current || current.completed === completed) return false;

  ensureEditorialPassHistory(page);
  page.editorialPassHistory!.push({
    id: eventId,
    pass,
    action: completed ? "completed" : "reopened",
    at
  } satisfies EditorialPassEvent);

  return true;
}
