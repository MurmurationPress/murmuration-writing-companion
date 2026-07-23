import {
  ContinuityObservation,
  observationSourceNotes
} from "./ContinuityObservation";

export const CONTINUITY_DISPOSITION_NOTE_LIMIT = 500;
export const CONTINUITY_DISPOSITION_SUMMARY_LIMIT = 240;

export const CONTINUITY_DISPOSITION_KINDS = [
  "intentional",
  "deferred",
  "resolved"
] as const;

export type ContinuityDispositionKind = typeof CONTINUITY_DISPOSITION_KINDS[number];
export type DispositionMatchState = "unresolved" | "current" | "stale";

export interface ContinuityDispositionRecord {
  readonly lineageKey: string;
  readonly fingerprint: string;
  readonly disposition: ContinuityDispositionKind;
  readonly note: string | null;
  readonly firstReviewedAt: string;
  readonly updatedAt: string;
  readonly observationKind: string;
  readonly ruleId: string;
  readonly ruleVersion: number;
  /** Descriptive editorial context only; never used for matching. */
  readonly primaryPath: string;
  /** Descriptive editorial context only; never used for matching. */
  readonly sourcePaths: readonly string[];
  /** Descriptive editorial context only; never used for matching. */
  readonly reviewSummary: string;
  readonly [key: string]: unknown;
}

export interface DispositionMatch {
  readonly observation: ContinuityObservation;
  readonly state: DispositionMatchState;
  readonly record: ContinuityDispositionRecord | null;
}

export interface ContinuityDispositionQueue {
  readonly active: readonly DispositionMatch[];
  readonly reviewed: readonly DispositionMatch[];
}

export function isContinuityDispositionKind(
  value: unknown
): value is ContinuityDispositionKind {
  return typeof value === "string"
    && (CONTINUITY_DISPOSITION_KINDS as readonly string[]).includes(value);
}

export function normalizeContinuityDispositionNote(note: string | null | undefined): string | null {
  const normalized = (note ?? "").normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return null;
  if ([...normalized].length > CONTINUITY_DISPOSITION_NOTE_LIMIT) {
    throw new Error(
      `Continuity disposition notes are limited to ${CONTINUITY_DISPOSITION_NOTE_LIMIT} characters.`
    );
  }
  return normalized;
}

function descriptivePaths(observation: ContinuityObservation): string[] {
  return [...new Set([
    observation.primary.path,
    ...observationSourceNotes(observation).map((note) => note.path)
  ])].sort();
}

function reviewSummary(observation: ContinuityObservation): string {
  const normalized = observation.summary.normalize("NFC").trim();
  return [...normalized].slice(0, CONTINUITY_DISPOSITION_SUMMARY_LIMIT).join("");
}

export function matchContinuityDisposition(
  observation: ContinuityObservation,
  records: readonly ContinuityDispositionRecord[]
): DispositionMatch {
  const record = records.find((candidate) => candidate.lineageKey === observation.lineageKey)
    ?? null;
  if (!record) return { observation, state: "unresolved", record: null };
  return {
    observation,
    state: record.fingerprint === observation.fingerprint ? "current" : "stale",
    record
  };
}

/**
 * Intentional and deferred findings leave the default active queue only while
 * their exact evidence remains current. Resolved findings remain active for as
 * long as the producer still emits them.
 */
export function projectContinuityDispositionQueue(
  observations: readonly ContinuityObservation[],
  records: readonly ContinuityDispositionRecord[]
): ContinuityDispositionQueue {
  const active: DispositionMatch[] = [];
  const reviewed: DispositionMatch[] = [];
  for (const observation of observations) {
    const match = matchContinuityDisposition(observation, records);
    if (
      match.state === "current"
      && match.record
      && (match.record.disposition === "intentional" || match.record.disposition === "deferred")
    ) {
      reviewed.push(match);
    } else {
      active.push(match);
    }
  }
  return { active, reviewed };
}

export function setContinuityDisposition(
  observation: ContinuityObservation,
  disposition: ContinuityDispositionKind,
  note: string | null | undefined,
  now: string,
  previous: ContinuityDispositionRecord | null = null
): ContinuityDispositionRecord {
  const normalizedNote = normalizeContinuityDispositionNote(
    note === undefined ? previous?.note : note
  );
  return {
    ...(previous ?? {}),
    lineageKey: observation.lineageKey,
    fingerprint: observation.fingerprint,
    disposition,
    note: normalizedNote,
    firstReviewedAt: previous?.firstReviewedAt ?? now,
    updatedAt: now,
    observationKind: observation.kind,
    ruleId: observation.rule.id,
    ruleVersion: observation.rule.version,
    primaryPath: observation.primary.path,
    sourcePaths: descriptivePaths(observation),
    reviewSummary: reviewSummary(observation)
  };
}

export function reviseContinuityDispositionNote(
  record: ContinuityDispositionRecord,
  note: string | null | undefined,
  now: string
): ContinuityDispositionRecord {
  const normalized = normalizeContinuityDispositionNote(note);
  if (normalized === record.note) return record;
  return { ...record, note: normalized, updatedAt: now };
}
