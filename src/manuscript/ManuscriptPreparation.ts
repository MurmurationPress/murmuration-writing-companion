import {
  MANUSCRIPT_PARENT_ALIASES,
  normalizeBookPropertyName
} from "../editorial/BookReview";
import { MANUSCRIPT_TYPE_ALIASES } from "./ManuscriptMetadata";
import {
  MANUSCRIPT_ORDER_PROPERTY,
  ManuscriptDocumentRecord,
  ManuscriptEntryKind,
  ManuscriptOrderResult,
  ManuscriptOrderSource
} from "./ManuscriptOrder";

export type ManuscriptPreparationProperty =
  | "type"
  | "parent"
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

export interface ManuscriptPreparationFilePlan {
  readonly path: string;
  readonly title: string;
  readonly kind: "book" | "part" | "scene";
  readonly beforeFrontmatter: Readonly<Record<string, unknown>>;
  readonly changes: readonly ManuscriptPreparationChange[];
  readonly mutation: ManuscriptPreparationMutation;
}

export interface ManuscriptPreparationDiagnostic {
  readonly message: string;
  readonly path?: string;
}

export interface ManuscriptPreparationPlan {
  readonly bookPath: string;
  readonly bookTitle: string;
  readonly source: ManuscriptOrderSource;
  readonly files: readonly ManuscriptPreparationFilePlan[];
  readonly diagnostics: readonly ManuscriptPreparationDiagnostic[];
  readonly canApply: boolean;
  readonly alreadyPrepared: boolean;
}

export interface ManuscriptPreparationInput {
  readonly book: ManuscriptDocumentRecord;
  readonly result: ManuscriptOrderResult;
  readonly frontmatterByPath: ReadonlyMap<
    string,
    Record<string, unknown> | undefined
  >;
  readonly explicitKindByPath: ReadonlyMap<string, ManuscriptEntryKind | null>;
  readonly explicitParentPathByPath: ReadonlyMap<string, string | null>;
  readonly explicitBookPathByPath: ReadonlyMap<string, string | null>;
  readonly parentReferencesByPath: ReadonlyMap<string, readonly string[]>;
  readonly bookReferencesByPath: ReadonlyMap<string, readonly string[]>;
  readonly missingLegacyParentFolderByPath: ReadonlyMap<string, string | null>;
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

function normalizedPath(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\.md$/i, "")
    .toLowerCase();
}

function manuscriptReference(path: string): string {
  return `[[${path.replace(/\.md$/i, "")}]]`;
}

function preparationOrderReferences(
  entries: readonly ManuscriptDocumentRecord[]
): string[] {
  return entries.map((entry) => manuscriptReference(entry.path));
}

function displayExistingProperties(
  properties: readonly [string, unknown][]
): unknown {
  if (properties.length === 0) return undefined;
  if (properties.length === 1 && properties[0][0] === "type") {
    return cloneValue(properties[0][1]);
  }
  return Object.fromEntries(properties.map(([property, value]) => (
    [property, cloneValue(value)]
  )));
}

function plannedFile(
  record: ManuscriptDocumentRecord,
  expectedKind: "book" | "part" | "scene",
  expectedParentPath: string | null,
  input: ManuscriptPreparationInput,
  diagnostics: ManuscriptPreparationDiagnostic[]
): ManuscriptPreparationFilePlan | null {
  const frontmatter = cloneValue(input.frontmatterByPath.get(record.path) ?? {});
  const explicitKind = input.explicitKindByPath.get(record.path) ?? null;
  const explicitParentPath = input.explicitParentPathByPath.get(record.path) ?? null;
  const explicitBookPath = input.explicitBookPathByPath.get(record.path) ?? null;
  const parentReferences = input.parentReferencesByPath.get(record.path) ?? [];
  const bookReferences = input.bookReferencesByPath.get(record.path) ?? [];
  const missingLegacyParentFolder = input.missingLegacyParentFolderByPath
    .get(record.path) ?? null;
  const changes: ManuscriptPreparationChange[] = [];
  const remove = new Set<string>();
  const set: Record<string, unknown> = {};

  if (explicitKind && explicitKind !== expectedKind) {
    diagnostics.push({
      path: record.path,
      message: `${record.title} is explicitly classified as ${explicitKind}; expected ${expectedKind}.`
    });
  }

  if (parentReferences.length > 0 && !explicitParentPath) {
    diagnostics.push({
      path: record.path,
      message: `${record.title}'s explicit parent could not be resolved: ${parentReferences[0]}`
    });
  }

  if (bookReferences.length > 0 && !explicitBookPath) {
    diagnostics.push({
      path: record.path,
      message: `${record.title}'s explicit book could not be resolved: ${bookReferences[0]}`
    });
  }

  if (
    explicitBookPath
    && normalizedPath(explicitBookPath) !== normalizedPath(input.book.path)
  ) {
    diagnostics.push({
      path: record.path,
      message: `${record.title}'s explicit book conflicts with the selected manuscript.`
    });
  }

  if (expectedKind !== "book" && missingLegacyParentFolder) {
    diagnostics.push({
      path: record.path,
      message: `${record.title} is inside ${missingLegacyParentFolder}, which has no recognised folder note. Add the missing part note or set an explicit parent before preparation.`
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
    if (
      explicitParentPath
      && normalizedPath(explicitParentPath) !== normalizedPath(expectedParentPath)
    ) {
      diagnostics.push({
        path: record.path,
        message: `${record.title}'s explicit parent conflicts with the displayed manuscript structure.`
      });
    }

    const parentReference = manuscriptReference(expectedParentPath);
    const parentProperties = aliasedProperties(frontmatter, MANUSCRIPT_PARENT_ALIASES);
    const canonicalParent = parentProperties.length === 1
      && parentProperties[0][0] === "parent"
      && String(parentProperties[0][1] ?? "").trim() === parentReference;

    if (!canonicalParent) {
      for (const [property] of parentProperties) {
        if (property !== "parent") remove.add(property);
      }
      set.parent = parentReference;
      changes.push({
        property: "parent",
        before: displayExistingProperties(parentProperties),
        after: parentReference
      });
    }
  }

  if (record.path === input.book.path && input.result.source !== "explicit") {
    const references = preparationOrderReferences(input.result.entries);
    set[MANUSCRIPT_ORDER_PROPERTY] = references;
    changes.push({
      property: MANUSCRIPT_ORDER_PROPERTY,
      before: cloneValue(frontmatter[MANUSCRIPT_ORDER_PROPERTY]),
      after: references
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
    }
  };
}

export function planManuscriptPreparation(
  input: ManuscriptPreparationInput
): ManuscriptPreparationPlan {
  const diagnostics: ManuscriptPreparationDiagnostic[] = input.result.diagnostics
    .map((diagnostic) => ({
      path: diagnostic.path,
      message: diagnostic.message
    }));

  if (input.result.source === "invalid") {
    diagnostics.push({
      path: input.book.path,
      message: "Correct manuscript_order before preparing this manuscript."
    });
  }

  const files: ManuscriptPreparationFilePlan[] = [];
  const bookPlan = plannedFile(
    input.book,
    "book",
    null,
    input,
    diagnostics
  );
  if (bookPlan) files.push(bookPlan);

  for (const entry of input.result.entries) {
    if (entry.kind !== "part" && entry.kind !== "scene") continue;
    const expectedParentPath = entry.kind === "part"
      ? input.book.path
      : entry.parentPath ?? input.book.path;
    const plan = plannedFile(
      entry,
      entry.kind,
      expectedParentPath,
      input,
      diagnostics
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
    alreadyPrepared: diagnostics.length === 0 && files.length === 0
  };
}

function stablePlanValue(plan: ManuscriptPreparationPlan): unknown {
  return {
    bookPath: plan.bookPath,
    source: plan.source,
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
      }
    }))
  };
}

export function sameManuscriptPreparationPlan(
  left: ManuscriptPreparationPlan,
  right: ManuscriptPreparationPlan
): boolean {
  return JSON.stringify(stablePlanValue(left)) === JSON.stringify(stablePlanValue(right));
}

export function describePreparationValue(value: unknown): string {
  if (value === undefined) return "not set";
  if (Array.isArray(value)) return `${value.length} ordered entries`;
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([property, item]) => `${property}: ${String(item)}`)
      .join(", ");
  }
  return String(value);
}
