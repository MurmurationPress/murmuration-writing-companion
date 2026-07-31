import {
  MANUSCRIPT_PARENT_ALIASES,
  normalizeBookPropertyName
} from "../editorial/BookReview";
import {
  explicitManuscriptKind,
  MANUSCRIPT_TYPE_ALIASES
} from "./ManuscriptMetadata";
import {
  MANUSCRIPT_ORDER_PROPERTY,
  ManuscriptDocumentRecord,
  ManuscriptOrderResult
} from "./ManuscriptOrder";
import {
  evenlySpacedManuscriptOrderKeys,
  MANUSCRIPT_ORDER_KEY_PROPERTY,
  manuscriptOrderKey,
  manuscriptOrderKeyBetween
} from "./ManuscriptOrderKey";

export type ManuscriptPreparationProperty =
  | "type"
  | "parent"
  | typeof MANUSCRIPT_ORDER_KEY_PROPERTY
  | typeof MANUSCRIPT_ORDER_PROPERTY;

export interface ManuscriptPreparationChange {
  readonly property: ManuscriptPreparationProperty;
  readonly before: unknown;
  readonly after: unknown;
}

export interface ManuscriptPreparationMutation {
  readonly remove: readonly string[];
  readonly set: Readonly<Record<string, unknown>>;
}

export interface ManuscriptPreparationExecutionStep {
  readonly file: ManuscriptPreparationFilePlan;
  readonly phase: "prepare_book" | "prepare_child" | "remove_legacy_order";
  readonly mutation: ManuscriptPreparationMutation;
}

export interface ManuscriptPreparationFilePlan {
  readonly path: string;
  readonly title: string;
  readonly kind: "book" | "part" | "scene";
  readonly beforeFrontmatter: Readonly<Record<string, unknown>>;
  readonly changes: readonly ManuscriptPreparationChange[];
  readonly mutation: ManuscriptPreparationMutation;
  readonly expectedFileVersion?: { readonly mtime: number; readonly size: number };
}

export interface ManuscriptPreparationDiagnostic {
  readonly message: string;
  readonly path?: string;
}

export interface ManuscriptPreparationPlan {
  readonly bookPath: string;
  readonly bookTitle: string;
  readonly source: ManuscriptOrderResult["source"];
  readonly files: readonly ManuscriptPreparationFilePlan[];
  readonly diagnostics: readonly ManuscriptPreparationDiagnostic[];
  readonly canApply: boolean;
  readonly alreadyPrepared: boolean;
  readonly state: ManuscriptPreparationState;
}

export type ManuscriptPreparationState =
  | "fully_prepared"
  | "legacy_array"
  | "deterministic_folder_order"
  | "partially_distributed"
  | "conflicting_distributed_metadata"
  | "malformed_or_incomplete_legacy_metadata"
  | "ambiguous_hierarchy"
  | "unsupported_or_unrecognised";

export interface ManuscriptPreparationInput {
  readonly book: ManuscriptDocumentRecord;
  readonly result: ManuscriptOrderResult;
  readonly frontmatterByPath: ReadonlyMap<
    string,
    Record<string, unknown> | undefined
  >;
  readonly fileVersionByPath?: ReadonlyMap<string, { readonly mtime: number; readonly size: number }>;
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizedAliasSet(aliases: readonly string[]): Set<string> {
  return new Set(aliases.map(normalizeBookPropertyName));
}

function aliasedProperties(
  frontmatter: Readonly<Record<string, unknown>>,
  aliases: readonly string[]
): Array<[string, unknown]> {
  const normalized = normalizedAliasSet(aliases);
  return Object.entries(frontmatter).filter(([property]) => (
    property !== "position"
    && normalized.has(normalizeBookPropertyName(property))
  ));
}

function displayExistingProperties(
  properties: readonly [string, unknown][]
): unknown {
  if (properties.length === 0) return undefined;
  if (properties.length === 1) return cloneValue(properties[0][1]);
  return Object.fromEntries(properties.map(([property, value]) => (
    [property, cloneValue(value)]
  )));
}

function manuscriptReference(path: string): string {
  return `[[${path.replace(/\.md$/i, "")}]]`;
}

function effectiveParent(
  entry: ManuscriptDocumentRecord,
  bookPath: string
): string {
  return entry.parentPath ?? bookPath;
}

function siblingKeyAssignments(
  bookPath: string,
  entries: readonly ManuscriptDocumentRecord[],
  preserveExisting: boolean
): ReadonlyMap<string, string> {
  const entriesByParent = new Map<string, ManuscriptDocumentRecord[]>();
  for (const entry of entries) {
    const parent = effectiveParent(entry, bookPath);
    const siblings = entriesByParent.get(parent);
    if (siblings) siblings.push(entry);
    else entriesByParent.set(parent, [entry]);
  }

  const assignments = new Map<string, string>();
  for (const siblings of entriesByParent.values()) {
    const existing = preserveExisting ? siblings.map((entry) => manuscriptOrderKey(entry.orderKey)) : siblings.map(() => null);
    if (!existing.some(Boolean)) {
      const keys = evenlySpacedManuscriptOrderKeys(siblings.length);
      siblings.forEach((entry, index) => assignments.set(entry.path, keys[index]));
      continue;
    }
    let previous: string | null = null;
    for (let index = 0; index < siblings.length; index += 1) {
      const retained = existing[index];
      if (retained) {
        if (previous && retained <= previous) continue;
        assignments.set(siblings[index].path, retained);
        previous = retained;
        continue;
      }
      const next = existing.slice(index + 1).find((key): key is string => Boolean(key)) ?? null;
      const allocated = manuscriptOrderKeyBetween(previous, next);
      if (!allocated) continue;
      assignments.set(siblings[index].path, allocated);
      previous = allocated;
    }
  }
  return assignments;
}

function expectedOrderKey(
  entry: ManuscriptDocumentRecord,
  assignments: ReadonlyMap<string, string>
): string | null {
  return assignments.get(entry.path) ?? null;
}

function plannedFile(
  record: ManuscriptDocumentRecord,
  expectedKind: "book" | "part" | "scene",
  expectedParentPath: string | null,
  expectedKey: string | null,
  frontmatterValue: Record<string, unknown> | undefined,
  removeLegacyArray: boolean,
  diagnostics: ManuscriptPreparationDiagnostic[],
  expectedFileVersion?: { readonly mtime: number; readonly size: number }
): ManuscriptPreparationFilePlan | null {
  const frontmatter = cloneValue(frontmatterValue ?? {});
  const changes: ManuscriptPreparationChange[] = [];
  const remove = new Set<string>();
  const set: Record<string, unknown> = {};

  const explicitKind = explicitManuscriptKind(frontmatter);
  if (explicitKind && explicitKind !== expectedKind) {
    diagnostics.push({
      path: record.path,
      message: `${record.title} is explicitly classified as ${explicitKind}; expected ${expectedKind}.`
    });
  }

  const typeProperties = aliasedProperties(frontmatter, MANUSCRIPT_TYPE_ALIASES);
  const canonicalType = typeProperties.length === 1
    && typeProperties[0][0] === "type"
    && String(typeProperties[0][1] ?? "").trim() === expectedKind;
  if (!canonicalType) {
    for (const [property] of typeProperties) {
      if (property !== "type") remove.add(property);
    }
    set.type = expectedKind;
    changes.push({
      property: "type",
      before: displayExistingProperties(typeProperties),
      after: expectedKind
    });
  }

  if (expectedParentPath) {
    const expectedParent = manuscriptReference(expectedParentPath);
    const parentProperties = aliasedProperties(frontmatter, MANUSCRIPT_PARENT_ALIASES);
    const canonicalParent = parentProperties.length === 1
      && parentProperties[0][0] === "parent"
      && String(parentProperties[0][1] ?? "").trim() === expectedParent;
    if (!canonicalParent) {
      for (const [property] of parentProperties) {
        if (property !== "parent") remove.add(property);
      }
      set.parent = expectedParent;
      changes.push({
        property: "parent",
        before: displayExistingProperties(parentProperties),
        after: expectedParent
      });
    }
  }

  if (expectedKey) {
    const keyProperties = aliasedProperties(frontmatter, [MANUSCRIPT_ORDER_KEY_PROPERTY]);
    const canonicalKey = keyProperties.length === 1
      && keyProperties[0][0] === MANUSCRIPT_ORDER_KEY_PROPERTY
      && String(keyProperties[0][1] ?? "").trim() === expectedKey;
    if (!canonicalKey) {
      for (const [property] of keyProperties) {
        if (property !== MANUSCRIPT_ORDER_KEY_PROPERTY) remove.add(property);
      }
      set[MANUSCRIPT_ORDER_KEY_PROPERTY] = expectedKey;
      changes.push({
        property: MANUSCRIPT_ORDER_KEY_PROPERTY,
        before: displayExistingProperties(keyProperties),
        after: expectedKey
      });
    }
  }

  if (
    removeLegacyArray
    && Object.prototype.hasOwnProperty.call(frontmatter, MANUSCRIPT_ORDER_PROPERTY)
  ) {
    remove.add(MANUSCRIPT_ORDER_PROPERTY);
    changes.push({
      property: MANUSCRIPT_ORDER_PROPERTY,
      before: cloneValue(frontmatter[MANUSCRIPT_ORDER_PROPERTY]),
      after: undefined
    });
  }

  if (changes.length === 0) return null;
  return {
    path: record.path,
    title: record.title,
    kind: expectedKind,
    beforeFrontmatter: frontmatter,
    changes,
    mutation: {
      remove: [...remove],
      set
    },
    expectedFileVersion
  };
}

function blockingDiagnostics(
  result: ManuscriptOrderResult,
  assignments: ReadonlyMap<string, string>
): ManuscriptPreparationDiagnostic[] {
  if (result.source === "invalid") {
    return [{
      message: "Correct the legacy manuscript_order property before migration.",
    }];
  }

  const blockingKinds = new Set([
    "invalid_property_shape",
    "invalid_reference",
    "unresolved_reference",
    "invalid_entry_kind",
    "duplicate_entry",
    "cross_book_entry",
    "unlisted_entry",
    "missing_parent",
    "invalid_parent_kind",
    "parent_cycle",
    "missing_order_key",
    "invalid_order_key",
    "duplicate_order_key",
    "legacy_ambiguous"
  ]);
  return result.diagnostics
    .filter((diagnostic) => {
      if (!blockingKinds.has(diagnostic.kind)) return false;
      if (result.source !== "distributed" || !diagnostic.path) return true;
      const entry = result.entries.find((candidate) => candidate.path === diagnostic.path);
      if (diagnostic.kind === "missing_order_key" && assignments.has(diagnostic.path)) return false;
      if (diagnostic.kind === "missing_parent" && entry?.parentPath && !entry.parentReferenceInvalid) return false;
      return true;
    })
    .map((diagnostic) => ({
      path: diagnostic.path,
      message: diagnostic.message
    }));
}

function preparationState(
  result: ManuscriptOrderResult,
  diagnostics: readonly ManuscriptPreparationDiagnostic[],
  files: readonly ManuscriptPreparationFilePlan[]
): ManuscriptPreparationState {
  if (result.source === "distributed" && diagnostics.length === 0) {
    return files.every((file) => file.changes.every((change) => change.property === MANUSCRIPT_ORDER_PROPERTY))
      ? "fully_prepared" : "partially_distributed";
  }
  if (result.source === "legacy_array" && diagnostics.length === 0) return "legacy_array";
  if (result.source === "legacy") return result.diagnostics.some((item) => item.kind === "legacy_ambiguous")
    ? "ambiguous_hierarchy" : diagnostics.length ? "conflicting_distributed_metadata" : "deterministic_folder_order";
  if (result.source === "none") return "unsupported_or_unrecognised";
  const kinds = new Set(result.diagnostics.map((item) => item.kind));
  if (kinds.has("invalid_property_shape") || kinds.has("invalid_reference") || kinds.has("unresolved_reference")
    || kinds.has("duplicate_entry") || kinds.has("cross_book_entry") || kinds.has("unlisted_entry")) {
    return "malformed_or_incomplete_legacy_metadata";
  }
  if (kinds.has("missing_order_key")) return "partially_distributed";
  if (kinds.has("invalid_order_key") || kinds.has("duplicate_order_key")) return "conflicting_distributed_metadata";
  if (kinds.has("missing_parent") || kinds.has("invalid_parent_kind") || kinds.has("parent_cycle") || kinds.has("legacy_ambiguous")) return "ambiguous_hierarchy";
  return "conflicting_distributed_metadata";
}

export function planManuscriptPreparation(
  input: ManuscriptPreparationInput
): ManuscriptPreparationPlan {
  const assignments = siblingKeyAssignments(input.book.path, input.result.entries, input.result.source === "distributed");
  const diagnostics = blockingDiagnostics(input.result, assignments);
  if (input.result.source === "none") {
    diagnostics.push({
      path: input.book.path,
      message: "No recognised parts or scenes are available to prepare."
    });
  }

  const files: ManuscriptPreparationFilePlan[] = [];
  const bookPlan = plannedFile(
    input.book,
    "book",
    null,
    null,
    input.frontmatterByPath.get(input.book.path),
    true,
    diagnostics,
    input.fileVersionByPath?.get(input.book.path)
  );
  if (bookPlan) files.push(bookPlan);

  for (const entry of input.result.entries) {
    if (entry.kind !== "part" && entry.kind !== "scene") continue;
    const expectedParentPath = entry.kind === "part"
      ? input.book.path
      : effectiveParent(entry, input.book.path);
    const expectedKey = expectedOrderKey(
      entry,
      assignments
    );
    if (!expectedKey) {
      diagnostics.push({
        path: entry.path,
        message: `${entry.title} could not be assigned a manuscript order key.`
      });
      continue;
    }

    const plan = plannedFile(
      entry,
      entry.kind,
      expectedParentPath,
      expectedKey,
      input.frontmatterByPath.get(entry.path),
      false,
      diagnostics,
      input.fileVersionByPath?.get(entry.path)
    );
    if (plan) files.push(plan);
  }

  const canApply = diagnostics.length === 0 && files.length > 0;
  return {
    bookPath: input.book.path,
    bookTitle: input.book.title,
    source: input.result.source,
    files,
    diagnostics,
    canApply,
    alreadyPrepared: diagnostics.length === 0 && files.length === 0,
    state: preparationState(input.result, diagnostics, files)
  };
}

function stablePlanValue(plan: ManuscriptPreparationPlan): unknown {
  return {
    bookPath: plan.bookPath,
    source: plan.source,
    state: plan.state,
    diagnostics: plan.diagnostics,
    files: plan.files.map((file) => ({
      path: file.path,
      changes: file.changes,
      mutation: {
        remove: [...file.mutation.remove].sort(),
        set: Object.fromEntries(
          Object.entries(file.mutation.set).sort(([left], [right]) => (
            left.localeCompare(right)
          ))
        )
      },
      expectedFileVersion: file.expectedFileVersion
    }))
  };
}

export function sameManuscriptPreparationPlan(
  left: ManuscriptPreparationPlan,
  right: ManuscriptPreparationPlan
): boolean {
  return JSON.stringify(stablePlanValue(left)) === JSON.stringify(stablePlanValue(right));
}

export function manuscriptPreparationExecutionSteps(
  plan: ManuscriptPreparationPlan
): ManuscriptPreparationExecutionStep[] {
  const steps: ManuscriptPreparationExecutionStep[] = [];
  const book = plan.files.find((file) => file.path === plan.bookPath);
  if (book) {
    const mutation = { set: book.mutation.set, remove: book.mutation.remove.filter((property) => property !== MANUSCRIPT_ORDER_PROPERTY) };
    if (Object.keys(mutation.set).length || mutation.remove.length) steps.push({ file: book, phase: "prepare_book", mutation });
  }
  for (const file of plan.files.filter((candidate) => candidate.path !== plan.bookPath)) {
    steps.push({ file, phase: "prepare_child", mutation: file.mutation });
  }
  if (book?.mutation.remove.includes(MANUSCRIPT_ORDER_PROPERTY)) {
    steps.push({ file: book, phase: "remove_legacy_order", mutation: { set: {}, remove: [MANUSCRIPT_ORDER_PROPERTY] } });
  }
  return steps;
}

export function describePreparationValue(value: unknown): string {
  if (value === undefined) return "removed";
  if (Array.isArray(value)) return `${value.length} legacy entries`;
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([property, item]) => `${property}: ${String(item)}`)
      .join(", ");
  }
  return String(value);
}
