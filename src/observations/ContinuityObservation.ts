export type ObservationSeverity = "information" | "review" | "conflict";

export type ObservationClassification =
  | "optional_missing"
  | "required_incomplete"
  | "review_concern"
  | "contradiction"
  | "malformed_evidence"
  | "unresolved_evidence";

export type ObservationNoteRole = "manuscript" | "story_world";

/**
 * A current, resolved vault location. Paths are the repository's present note
 * identity mechanism, so fingerprint stability across renames is best-effort.
 */
export interface ObservationNoteReference {
  readonly role: ObservationNoteRole;
  readonly path: string;
  readonly label?: string;
}

export type ObservationPropertyPathSegment = string | number;

export interface ObservationSource {
  readonly note: ObservationNoteReference;
  readonly property: readonly ObservationPropertyPathSegment[];
}

export type DeterministicValue =
  | null
  | boolean
  | number
  | string
  | readonly DeterministicValue[]
  | { readonly [key: string]: DeterministicValue };

export type ObservationEvidenceValue =
  | { readonly kind: "missing" }
  | { readonly kind: "value"; readonly value: DeterministicValue }
  | { readonly kind: "date"; readonly value: string; readonly precision: string }
  | { readonly kind: "resolved_note"; readonly note: ObservationNoteReference }
  | {
      readonly kind: "unresolved_reference";
      readonly reference: string;
      readonly reason: "missing" | "ambiguous" | "not_indexed";
    }
  | {
      readonly kind: "malformed";
      readonly raw: DeterministicValue;
      readonly reason: string;
    }
  | {
      readonly kind: "unsupported";
      readonly raw: DeterministicValue;
      readonly reason: string;
    };

export interface ObservationEvidence {
  readonly role: string;
  readonly source: ObservationSource;
  readonly value: ObservationEvidenceValue;
}

/**
 * A disposable result derived from authoritative Markdown. Summary,
 * explanation, labels, severity and navigation presentation do not contribute
 * to fingerprint identity. See docs/continuity-observation-contract.md.
 */
export interface ContinuityObservation {
  readonly kind: string;
  readonly severity: ObservationSeverity;
  readonly classification: ObservationClassification;
  readonly primary: ObservationNoteReference;
  readonly evidence: readonly ObservationEvidence[];
  readonly summary: string;
  readonly explanation: string;
  readonly rule: {
    readonly id: string;
    readonly version: number;
  };
  readonly lineageKey: string;
  readonly fingerprint: string;
}

export interface ContinuityObservationInput {
  readonly kind: string;
  readonly severity: ObservationSeverity;
  readonly classification: ObservationClassification;
  readonly primary: ObservationNoteReference;
  readonly evidence: readonly ObservationEvidence[];
  readonly summary: string;
  readonly explanation: string;
  readonly rule: ContinuityObservation["rule"];
  /** Logical subject plus a deterministic duplicate ordinal where required. */
  readonly logicalOccurrence: DeterministicValue;
}

export type ObservationNavigationTarget =
  | { readonly kind: "note"; readonly note: ObservationNoteReference }
  | { readonly kind: "property"; readonly source: ObservationSource };

function normalizeString(value: string): string {
  return value.normalize("NFC");
}

function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Observation values must contain only finite numbers.");
  if (Object.is(value, -0)) return "0";
  return String(value);
}

function canonicalValue(value: DeterministicValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return canonicalNumber(value);
  if (typeof value === "string") return JSON.stringify(normalizeString(value));
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;

  const entries = Object.entries(value as Readonly<Record<string, DeterministicValue>>)
    .map(([key, item]) => [normalizeString(key), item] as const)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalValue(item)}`).join(",")}}`;
}

export function canonicalObservationEncoding(value: DeterministicValue): string {
  return canonicalValue(value);
}

export function normalizeObservationValue(
  value: unknown,
  ancestors = new WeakSet<object>()
): DeterministicValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return typeof value === "string" ? normalizeString(value) : value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Observation values must contain only finite numbers.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("Observation values must not contain invalid dates.");
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new Error("Observation values must not contain cycles.");
    ancestors.add(value);
    const result = value.map((item) => normalizeObservationValue(item, ancestors));
    ancestors.delete(value);
    return result;
  }
  if (typeof value === "object" && value !== null) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Observation values must contain only plain objects, arrays and dates.");
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new Error("Observation values must not contain symbol properties.");
    }
    if (ancestors.has(value)) throw new Error("Observation values must not contain cycles.");
    ancestors.add(value);
    const result: Record<string, DeterministicValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key === "position" || item === undefined) continue;
      result[normalizeString(key)] = normalizeObservationValue(item, ancestors);
    }
    ancestors.delete(value);
    return result;
  }
  throw new Error(`Unsupported observation evidence value: ${typeof value}`);
}

/** Normalises, sorts and deduplicates a collection whose rule semantics are set-like. */
export function normalizeObservationSet(values: readonly unknown[]): DeterministicValue[] {
  const byEncoding = new Map<string, DeterministicValue>();
  for (const value of values) {
    const normalized = normalizeObservationValue(value);
    byEncoding.set(canonicalValue(normalized), normalized);
  }
  return [...byEncoding.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([, value]) => value);
}

function fnv1a(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A compact synchronous content hash; collision resistance is not a security boundary. */
export function observationHash(value: string): string {
  const first = fnv1a(value, 0x811c9dc5).toString(16).padStart(8, "0");
  const second = fnv1a(value, 0x9e3779b9).toString(16).padStart(8, "0");
  return `${first}${second}`;
}

function noteValue(note: ObservationNoteReference): DeterministicValue {
  return { role: note.role, path: note.path };
}

function sourceValue(source: ObservationSource): DeterministicValue {
  return { note: noteValue(source.note), property: [...source.property] };
}

function evidenceValue(evidence: ObservationEvidence): DeterministicValue {
  const value = evidence.value;
  let canonicalEvidenceValue: DeterministicValue;
  switch (value.kind) {
    case "missing":
      canonicalEvidenceValue = { kind: "missing" };
      break;
    case "value":
      canonicalEvidenceValue = { kind: "value", value: value.value };
      break;
    case "date":
      canonicalEvidenceValue = {
        kind: "date",
        value: value.value,
        precision: value.precision
      };
      break;
    case "resolved_note":
      canonicalEvidenceValue = { kind: "resolved_note", note: noteValue(value.note) };
      break;
    case "unresolved_reference":
      canonicalEvidenceValue = {
        kind: "unresolved_reference",
        reference: value.reference,
        reason: value.reason
      };
      break;
    case "malformed":
    case "unsupported":
      canonicalEvidenceValue = {
        kind: value.kind,
        raw: value.raw,
        reason: value.reason
      };
      break;
  }
  return {
    role: evidence.role,
    source: sourceValue(evidence.source),
    value: canonicalEvidenceValue
  };
}

function requireText(value: string, field: string): string {
  const normalized = normalizeString(value).trim();
  if (!normalized) throw new Error(`Continuity observation ${field} is required.`);
  return normalized;
}

function normalizeNote(note: ObservationNoteReference): ObservationNoteReference {
  return {
    role: note.role,
    path: requireText(note.path, "note path"),
    ...(note.label === undefined ? {} : { label: normalizeString(note.label) })
  };
}

function normalizeEvidence(evidence: ObservationEvidence): ObservationEvidence {
  const role = requireText(evidence.role, "evidence role");
  if (evidence.source.property.length === 0) {
    throw new Error("Continuity observation evidence property path is required.");
  }
  const property = evidence.source.property.map((segment) => {
    if (typeof segment === "number") {
      if (!Number.isSafeInteger(segment) || segment < 0) {
        throw new Error("Observation property indexes must be non-negative safe integers.");
      }
      return segment;
    }
    return requireText(segment, "property path segment");
  });
  const source = { note: normalizeNote(evidence.source.note), property };
  const value = evidence.value;
  switch (value.kind) {
    case "missing":
      return { role, source, value };
    case "value":
      return { role, source, value: { kind: "value", value: normalizeObservationValue(value.value) } };
    case "date":
      return { role, source, value: {
        kind: "date",
        value: requireText(value.value, "date value"),
        precision: requireText(value.precision, "date precision")
      } };
    case "resolved_note":
      return { role, source, value: { kind: "resolved_note", note: normalizeNote(value.note) } };
    case "unresolved_reference":
      return { role, source, value: {
        kind: "unresolved_reference",
        reference: requireText(value.reference, "unresolved reference"),
        reason: value.reason
      } };
    case "malformed":
    case "unsupported":
      return { role, source, value: {
        kind: value.kind,
        raw: normalizeObservationValue(value.raw),
        reason: requireText(value.reason, `${value.kind} reason`)
      } };
  }
}

export function buildContinuityObservation(
  input: ContinuityObservationInput
): ContinuityObservation {
  const kind = requireText(input.kind, "kind");
  const summary = requireText(input.summary, "summary");
  const explanation = requireText(input.explanation, "explanation");
  const primary = normalizeNote(input.primary);
  const rule = {
    id: requireText(input.rule.id, "rule identifier"),
    version: input.rule.version
  };
  if (!Number.isSafeInteger(rule.version) || rule.version < 1) {
    throw new Error("Continuity observation rule version must be a positive safe integer.");
  }
  if (input.evidence.length === 0) {
    throw new Error("Continuity observation evidence is required.");
  }
  const evidence = input.evidence.map(normalizeEvidence);
  const lineagePayload: DeterministicValue = {
    schema: 1,
    rule: rule.id,
    kind,
    primary: noteValue(primary),
    occurrence: normalizeObservationValue(input.logicalOccurrence)
  };
  // Evidence is a logical supporting set. Its own order and duplicates do not
  // change identity; array order inside an evidence value remains authoritative.
  const evidenceByEncoding = new Map<string, DeterministicValue>();
  for (const item of evidence.map(evidenceValue)) {
    evidenceByEncoding.set(canonicalValue(item), item);
  }
  const canonicalEvidence = [...evidenceByEncoding.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([, value]) => value);
  const fingerprintPayload: DeterministicValue = {
    schema: 1,
    rule,
    kind,
    classification: input.classification,
    primary: noteValue(primary),
    evidence: canonicalEvidence
  };

  return {
    kind,
    severity: input.severity,
    classification: input.classification,
    primary,
    evidence,
    summary,
    explanation,
    rule,
    lineageKey: `obs-lineage-v1:${observationHash(canonicalValue(lineagePayload))}`,
    fingerprint: `obs-v1:${observationHash(canonicalValue(fingerprintPayload))}`
  };
}

function noteKey(note: ObservationNoteReference): string {
  return `${note.role}\u0000${note.path}`;
}

export function observationSourceNotes(
  observation: ContinuityObservation
): ObservationNoteReference[] {
  const notes = new Map<string, ObservationNoteReference>();
  for (const evidence of observation.evidence) {
    notes.set(noteKey(evidence.source.note), evidence.source.note);
    if (evidence.value.kind === "resolved_note") {
      notes.set(noteKey(evidence.value.note), evidence.value.note);
    }
  }
  return [...notes.values()].sort((left, right) => noteKey(left).localeCompare(noteKey(right)));
}

export function observationNavigationTargets(
  observation: ContinuityObservation
): ObservationNavigationTarget[] {
  const targets: ObservationNavigationTarget[] = [{ kind: "note", note: observation.primary }];
  const seenNotes = new Set<string>([noteKey(observation.primary)]);
  const seenProperties = new Set<string>();
  for (const evidence of observation.evidence) {
    const key = `${noteKey(evidence.source.note)}\u0000${canonicalValue([...evidence.source.property])}`;
    if (!seenProperties.has(key)) {
      seenProperties.add(key);
      targets.push({ kind: "property", source: evidence.source });
    }
    if (evidence.value.kind === "resolved_note") {
      const resolvedKey = noteKey(evidence.value.note);
      if (!seenNotes.has(resolvedKey)) {
        seenNotes.add(resolvedKey);
        targets.push({ kind: "note", note: evidence.value.note });
      }
    }
  }
  return targets;
}
