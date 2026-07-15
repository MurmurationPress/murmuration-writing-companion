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
  inferred: boolean;
  frontier: boolean;
  historicallyCompleted: boolean;
  completedAt?: string;
  lastChangedAt?: string;
  history: EditorialPassEvent[];
}

export type EditorialPassMigrationSource = "managed" | "history" | "frontmatter" | "none";

export interface EditorialPassMigrationResult {
  changed: boolean;
  frontier: EditorialPassKey | null;
  source: EditorialPassMigrationSource;
}

export type EditorialPassProjectionStatus =
  | "unmanaged"
  | "match"
  | "missing"
  | "mismatch"
  | "unknown";

export interface EditorialPassProjection {
  managed: boolean;
  frontier: EditorialPassKey | null;
  frontmatterValue: string;
  frontmatterPass: EditorialPassKey | null;
  status: EditorialPassProjectionStatus;
}

interface HistoricalPassState {
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

export function parseEditorialPassKey(value: unknown): EditorialPassKey | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isEditorialPassKey(normalized) ? normalized : null;
}

export function parseEditorialPassEvent(value: unknown): EditorialPassEvent | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.length === 0) return null;
  if (!isEditorialPassKey(value.pass)) return null;
  if (value.action !== "completed" && value.action !== "reopened") return null;
  if (typeof value.at !== "string" || value.at.length === 0) return null;

  return value as EditorialPassEvent;
}

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

function buildHistoricalPassStates(
  page: PageEditorialNotes
): Map<EditorialPassKey, HistoricalPassState> {
  const states = new Map<EditorialPassKey, HistoricalPassState>();

  for (const pass of EDITORIAL_PASS_OPTIONS) {
    states.set(pass, { completed: false, history: [] });
  }

  const seenEventIds = new Set<string>();

  for (const rawEvent of getEditorialPassHistory(page)) {
    const event = parseEditorialPassEvent(rawEvent);
    if (!event || seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);

    const state = states.get(event.pass)!;
    state.history.push(event);
    state.lastChangedAt = event.at;

    if (event.action === "completed") {
      state.completed = true;
      state.completedAt = event.at;
    } else {
      state.completed = false;
      delete state.completedAt;
    }
  }

  return states;
}

export function hasManagedEditorialPassFrontier(page: PageEditorialNotes): boolean {
  if (!Object.prototype.hasOwnProperty.call(page, "editorialPassFrontier")) {
    return false;
  }

  return page.editorialPassFrontier === null
    || isEditorialPassKey(page.editorialPassFrontier);
}

export function deriveEditorialPassFrontier(
  page: PageEditorialNotes
): EditorialPassKey | null {
  const states = buildHistoricalPassStates(page);
  let frontier: EditorialPassKey | null = null;

  for (const pass of EDITORIAL_PASS_OPTIONS) {
    if (states.get(pass)?.completed) frontier = pass;
  }

  return frontier;
}

export function getEditorialPassFrontier(
  page: PageEditorialNotes
): EditorialPassKey | null {
  if (hasManagedEditorialPassFrontier(page)) {
    return page.editorialPassFrontier === null
      ? null
      : page.editorialPassFrontier as EditorialPassKey;
  }

  return deriveEditorialPassFrontier(page);
}

export function ensureEditorialPassFrontier(
  page: PageEditorialNotes,
  frontmatterValue?: unknown
): EditorialPassMigrationResult {
  if (hasManagedEditorialPassFrontier(page)) {
    return {
      changed: false,
      frontier: getEditorialPassFrontier(page),
      source: "managed"
    };
  }

  const validHistory = getEditorialPassHistory(page)
    .some((event) => parseEditorialPassEvent(event) !== null);

  if (validHistory) {
    const frontier = deriveEditorialPassFrontier(page);
    page.editorialPassFrontier = frontier;
    return { changed: true, frontier, source: "history" };
  }

  const seededFrontier = parseEditorialPassKey(frontmatterValue);
  if (seededFrontier) {
    page.editorialPassFrontier = seededFrontier;
    return {
      changed: true,
      frontier: seededFrontier,
      source: "frontmatter"
    };
  }

  return { changed: false, frontier: null, source: "none" };
}

export function getEditorialPassChecklist(
  page: PageEditorialNotes
): EditorialPassChecklistItem[] {
  const states = buildHistoricalPassStates(page);
  const frontier = getEditorialPassFrontier(page);
  const frontierIndex = frontier === null
    ? -1
    : EDITORIAL_PASS_OPTIONS.indexOf(frontier);

  return EDITORIAL_PASS_OPTIONS.map((key, index) => {
    const historical = states.get(key)!;
    const completed = index <= frontierIndex;

    return {
      key,
      label: EDITORIAL_PASS_LABELS[key],
      completed,
      inferred: completed && key !== frontier,
      frontier: key === frontier,
      historicallyCompleted: historical.completed,
      completedAt: historical.completedAt,
      lastChangedAt: historical.lastChangedAt,
      history: historical.history
    };
  });
}

function appendEditorialPassEvent(
  page: PageEditorialNotes,
  pass: EditorialPassKey,
  action: EditorialPassAction,
  at: string,
  eventId: string
) {
  ensureEditorialPassHistory(page);
  page.editorialPassHistory!.push({
    id: eventId,
    pass,
    action,
    at
  } satisfies EditorialPassEvent);
}

export function previousEditorialPass(
  pass: EditorialPassKey
): EditorialPassKey | null {
  const index = EDITORIAL_PASS_OPTIONS.indexOf(pass);
  return index > 0 ? EDITORIAL_PASS_OPTIONS[index - 1] : null;
}

export function setEditorialPassFrontier(
  page: PageEditorialNotes,
  frontier: EditorialPassKey | null,
  at: string,
  eventId: string
): boolean {
  const managed = hasManagedEditorialPassFrontier(page);
  const current = getEditorialPassFrontier(page);

  if (managed && current === frontier) return false;

  if (current !== frontier) {
    const currentIndex = current === null
      ? -1
      : EDITORIAL_PASS_OPTIONS.indexOf(current);
    const nextIndex = frontier === null
      ? -1
      : EDITORIAL_PASS_OPTIONS.indexOf(frontier);

    if (nextIndex > currentIndex && frontier !== null) {
      appendEditorialPassEvent(page, frontier, "completed", at, eventId);
    } else if (nextIndex < currentIndex) {
      const historical = buildHistoricalPassStates(page);
      const reopened: EditorialPassKey[] = [];

      for (let index = currentIndex; index > nextIndex; index -= 1) {
        const pass = EDITORIAL_PASS_OPTIONS[index];
        if (pass === current || historical.get(pass)?.completed) reopened.push(pass);
      }

      for (const [index, pass] of reopened.entries()) {
        appendEditorialPassEvent(
          page,
          pass,
          "reopened",
          at,
          reopened.length === 1 ? eventId : `${eventId}:${index + 1}:${pass}`
        );
      }
    }
  }

  page.editorialPassFrontier = frontier;
  return true;
}

export function setEditorialPassCompleted(
  page: PageEditorialNotes,
  pass: EditorialPassKey,
  completed: boolean,
  at: string,
  eventId: string
): boolean {
  return setEditorialPassFrontier(
    page,
    completed ? pass : previousEditorialPass(pass),
    at,
    eventId
  );
}

export function buildEditorialPassProjection(
  page: PageEditorialNotes,
  frontmatterValue: unknown
): EditorialPassProjection {
  const managed = hasManagedEditorialPassFrontier(page);
  const frontier = getEditorialPassFrontier(page);
  const rawValue = typeof frontmatterValue === "string"
    ? frontmatterValue.trim()
    : "";
  const frontmatterPass = parseEditorialPassKey(rawValue);

  if (!managed) {
    return {
      managed,
      frontier,
      frontmatterValue: rawValue,
      frontmatterPass,
      status: "unmanaged"
    };
  }

  let status: EditorialPassProjectionStatus;

  if (frontier === null && rawValue.length === 0) {
    status = "match";
  } else if (rawValue.length === 0) {
    status = "missing";
  } else if (!frontmatterPass) {
    status = "unknown";
  } else if (frontmatterPass === frontier) {
    status = "match";
  } else {
    status = "mismatch";
  }

  return {
    managed,
    frontier,
    frontmatterValue: rawValue,
    frontmatterPass,
    status
  };
}
