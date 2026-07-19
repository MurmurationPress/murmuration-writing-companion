import {
  MANUSCRIPT_PARENT_ALIASES,
  normalizeBookPropertyName
} from "../editorial/BookReview";
import {
  MANUSCRIPT_TYPE_ALIASES
} from "./ManuscriptMetadata";
import type {
  ManuscriptDocumentRecord,
  ManuscriptOrderDiagnostic,
  ManuscriptOrderResult
} from "./ManuscriptOrder";
import {
  evenlySpacedManuscriptOrderKeys,
  MANUSCRIPT_ORDER_KEY_PROPERTY,
  manuscriptOrderKey,
  manuscriptOrderKeyBetween
} from "./ManuscriptOrderKey";
import { MANUSCRIPT_ORDER_PROPERTY } from "./ManuscriptOrder";

export type ManuscriptReconciliationPlacementPosition =
  | "start"
  | "end"
  | "before"
  | "after";

export interface ManuscriptReconciliationPlacementChoice {
  readonly parentPath: string;
  readonly position: ManuscriptReconciliationPlacementPosition;
  readonly targetPath?: string;
}

export interface ManuscriptReconciliationChoices {
  readonly placements: Readonly<Record<string, ManuscriptReconciliationPlacementChoice>>;
  readonly rebalanceParents: readonly string[];
}

export interface ManuscriptReconciliationPlacementOption {
  readonly id: string;
  readonly label: string;
  readonly choice: ManuscriptReconciliationPlacementChoice;
}

export interface ManuscriptReconciliationIssue {
  readonly id: string;
  readonly kind:
    | "placement"
    | "canonical_parent"
    | "duplicate_keys"
    | "obsolete_array"
    | "sync_conflict"
    | "unsupported";
  readonly message: string;
  readonly path?: string;
  readonly parentPath?: string;
  readonly requiresChoice: boolean;
}

export interface ManuscriptReconciliationMutation {
  readonly remove: readonly string[];
  readonly set: Readonly<Record<string, unknown>>;
}

export interface ManuscriptReconciliationChange {
  readonly property: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface ManuscriptReconciliationFilePlan {
  readonly path: string;
  readonly title: string;
  readonly kind: "book" | "part" | "scene";
  readonly beforeFrontmatter: Readonly<Record<string, unknown>>;
  readonly changes: readonly ManuscriptReconciliationChange[];
  readonly mutation: ManuscriptReconciliationMutation;
}

export interface ManuscriptReconciliationPlan {
  readonly bookPath: string;
  readonly bookTitle: string;
  readonly issues: readonly ManuscriptReconciliationIssue[];
  readonly files: readonly ManuscriptReconciliationFilePlan[];
  readonly unresolved: readonly string[];
  readonly canApply: boolean;
  readonly alreadyReconciled: boolean;
  readonly choices: ManuscriptReconciliationChoices;
}

export interface ManuscriptReconciliationInput {
  readonly book: ManuscriptDocumentRecord;
  readonly result: ManuscriptOrderResult;
  readonly frontmatterByPath: ReadonlyMap<string, Record<string, unknown> | undefined>;
  readonly conflictPaths?: ReadonlySet<string>;
}

const RECONCILIATION_DIAGNOSTICS = new Set<ManuscriptOrderDiagnostic["kind"]>([
  "missing_order_key",
  "invalid_order_key",
  "duplicate_order_key",
  "missing_parent",
  "invalid_parent_kind",
  "parent_cycle",
  "obsolete_order_array"
]);

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function hasOwn(
  value: Readonly<Record<string, unknown>>,
  property: string
): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
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

function entryByPath(
  result: ManuscriptOrderResult
): ReadonlyMap<string, ManuscriptDocumentRecord> {
  return new Map(result.entries.map((entry) => [entry.path, entry]));
}

function diagnosticsByPath(
  result: ManuscriptOrderResult
): ReadonlyMap<string, ManuscriptOrderDiagnostic[]> {
  const grouped = new Map<string, ManuscriptOrderDiagnostic[]>();
  for (const diagnostic of result.diagnostics) {
    if (!diagnostic.path || !RECONCILIATION_DIAGNOSTICS.has(diagnostic.kind)) continue;
    const existing = grouped.get(diagnostic.path);
    if (existing) existing.push(diagnostic);
    else grouped.set(diagnostic.path, [diagnostic]);
  }
  return grouped;
}

function requiresPlacement(
  entry: ManuscriptDocumentRecord,
  diagnostics: readonly ManuscriptOrderDiagnostic[]
): boolean {
  const kinds = new Set(diagnostics.map((diagnostic) => diagnostic.kind));
  return kinds.has("missing_order_key")
    || kinds.has("invalid_order_key")
    || kinds.has("invalid_parent_kind")
    || kinds.has("parent_cycle")
    || entry.parentReferenceInvalid === true;
}

function canonicalParentOnly(
  entry: ManuscriptDocumentRecord,
  diagnostics: readonly ManuscriptOrderDiagnostic[]
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.kind === "missing_parent")
    && !requiresPlacement(entry, diagnostics)
    && entry.explicitParent !== true
    && entry.parentPath !== null;
}

function duplicateParents(
  input: ManuscriptReconciliationInput
): ReadonlySet<string> {
  const entries = entryByPath(input.result);
  const parents = new Set<string>();
  for (const diagnostic of input.result.diagnostics) {
    if (diagnostic.kind !== "duplicate_order_key" || !diagnostic.path) continue;
    const entry = entries.get(diagnostic.path);
    if (entry) parents.add(effectiveParent(entry, input.book.path));
  }
  return parents;
}

function placementEntries(
  input: ManuscriptReconciliationInput
): readonly ManuscriptDocumentRecord[] {
  const grouped = diagnosticsByPath(input.result);
  return input.result.entries.filter((entry) => (
    (entry.kind === "part" || entry.kind === "scene")
    && requiresPlacement(entry, grouped.get(entry.path) ?? [])
  ));
}

function stableSiblings(
  input: ManuscriptReconciliationInput,
  parentPath: string,
  excludedPaths: ReadonlySet<string>
): ManuscriptDocumentRecord[] {
  return input.result.entries.filter((entry) => (
    (entry.kind === "part" || entry.kind === "scene")
    && !excludedPaths.has(entry.path)
    && effectiveParent(entry, input.book.path) === parentPath
    && manuscriptOrderKey(entry.orderKey) !== null
  ));
}

function parentTitle(
  input: ManuscriptReconciliationInput,
  parentPath: string
): string {
  if (parentPath === input.book.path) return input.book.title;
  return input.result.entries.find((entry) => entry.path === parentPath)?.title
    ?? parentPath.split("/").pop()?.replace(/\.md$/i, "")
    ?? parentPath;
}

function placementChoiceId(choice: ManuscriptReconciliationPlacementChoice): string {
  return [choice.parentPath, choice.position, choice.targetPath ?? ""].join("::");
}

export function manuscriptReconciliationPlacementOptions(
  input: ManuscriptReconciliationInput,
  entryPath: string
): readonly ManuscriptReconciliationPlacementOption[] {
  const entry = input.result.entries.find((candidate) => candidate.path === entryPath);
  if (!entry || (entry.kind !== "part" && entry.kind !== "scene")) return [];

  const allPlacementPaths = new Set(placementEntries(input).map((candidate) => candidate.path));
  const parents = entry.kind === "part"
    ? [input.book.path]
    : [
      input.book.path,
      ...input.result.entries
        .filter((candidate) => candidate.kind === "part" && candidate.path !== entry.path)
        .map((candidate) => candidate.path)
    ];
  const options: ManuscriptReconciliationPlacementOption[] = [];

  for (const parentPath of parents) {
    const title = parentTitle(input, parentPath);
    const siblings = stableSiblings(input, parentPath, allPlacementPaths);
    const start: ManuscriptReconciliationPlacementChoice = {
      parentPath,
      position: "start"
    };
    options.push({
      id: placementChoiceId(start),
      label: `At start of ${title}`,
      choice: start
    });

    for (const sibling of siblings) {
      const before: ManuscriptReconciliationPlacementChoice = {
        parentPath,
        position: "before",
        targetPath: sibling.path
      };
      const after: ManuscriptReconciliationPlacementChoice = {
        parentPath,
        position: "after",
        targetPath: sibling.path
      };
      options.push({
        id: placementChoiceId(before),
        label: `Before ${sibling.title} in ${title}`,
        choice: before
      });
      options.push({
        id: placementChoiceId(after),
        label: `After ${sibling.title} in ${title}`,
        choice: after
      });
    }

    const end: ManuscriptReconciliationPlacementChoice = {
      parentPath,
      position: "end"
    };
    options.push({
      id: placementChoiceId(end),
      label: `At end of ${title}`,
      choice: end
    });
  }
  return options;
}

function issuesFor(
  input: ManuscriptReconciliationInput
): ManuscriptReconciliationIssue[] {
  const issues: ManuscriptReconciliationIssue[] = [];
  const grouped = diagnosticsByPath(input.result);
  const entries = entryByPath(input.result);

  for (const entry of input.result.entries) {
    if (entry.kind !== "part" && entry.kind !== "scene") continue;
    const diagnostics = grouped.get(entry.path) ?? [];
    if (requiresPlacement(entry, diagnostics)) {
      issues.push({
        id: `placement:${entry.path}`,
        kind: "placement",
        path: entry.path,
        parentPath: entry.parentPath ?? input.book.path,
        requiresChoice: true,
        message: `${entry.title} needs an explicit manuscript position.`
      });
    } else if (canonicalParentOnly(entry, diagnostics)) {
      issues.push({
        id: `canonical-parent:${entry.path}`,
        kind: "canonical_parent",
        path: entry.path,
        parentPath: entry.parentPath ?? input.book.path,
        requiresChoice: false,
        message: `${entry.title} needs its inferred parent written canonically.`
      });
    }
  }

  for (const parentPath of duplicateParents(input)) {
    issues.push({
      id: `duplicate:${parentPath}`,
      kind: "duplicate_keys",
      parentPath,
      requiresChoice: true,
      message: `${parentTitle(input, parentPath)} contains duplicate sibling order keys.`
    });
  }

  if (input.result.diagnostics.some((diagnostic) => diagnostic.kind === "obsolete_order_array")) {
    issues.push({
      id: `obsolete:${input.book.path}`,
      kind: "obsolete_array",
      path: input.book.path,
      requiresChoice: false,
      message: "The obsolete book-level manuscript_order array will be removed."
    });
  }

  for (const path of input.conflictPaths ?? []) {
    const title = entries.get(path)?.title ?? (path === input.book.path ? input.book.title : path);
    issues.push({
      id: `conflict:${path}`,
      kind: "sync_conflict",
      path,
      requiresChoice: false,
      message: `${title} contains unresolved Git or sync conflict markers.`
    });
  }

  const represented = new Set(issues.flatMap((issue) => issue.path ? [issue.path] : []));
  for (const diagnostic of input.result.diagnostics) {
    if (!RECONCILIATION_DIAGNOSTICS.has(diagnostic.kind)) continue;
    if (diagnostic.path && represented.has(diagnostic.path)) continue;
    if (diagnostic.kind === "duplicate_order_key" || diagnostic.kind === "obsolete_order_array") continue;
    issues.push({
      id: `unsupported:${diagnostic.kind}:${diagnostic.path ?? diagnostic.message}`,
      kind: "unsupported",
      path: diagnostic.path,
      requiresChoice: false,
      message: diagnostic.message
    });
  }
  return issues;
}

function insertAtChoice(
  siblings: string[],
  path: string,
  choice: ManuscriptReconciliationPlacementChoice
): string | null {
  const without = siblings.filter((candidate) => candidate !== path);
  if (choice.position === "start") {
    without.unshift(path);
    siblings.splice(0, siblings.length, ...without);
    return null;
  }
  if (choice.position === "end") {
    without.push(path);
    siblings.splice(0, siblings.length, ...without);
    return null;
  }
  if (!choice.targetPath) return "A before/after placement needs a target note.";
  const targetIndex = without.indexOf(choice.targetPath);
  if (targetIndex < 0) return "The selected placement target is no longer available.";
  const index = choice.position === "before" ? targetIndex : targetIndex + 1;
  without.splice(index, 0, path);
  siblings.splice(0, siblings.length, ...without);
  return null;
}

function mutationBuilder(
  record: ManuscriptDocumentRecord,
  frontmatterValue: Record<string, unknown> | undefined
) {
  const frontmatter = cloneValue(frontmatterValue ?? {});
  const remove = new Set<string>();
  const set: Record<string, unknown> = {};
  const changes: ManuscriptReconciliationChange[] = [];

  const setCanonical = (
    property: string,
    aliases: readonly string[],
    expected: unknown
  ) => {
    const properties = aliasedProperties(frontmatter, aliases);
    const canonical = properties.length === 1
      && properties[0][0] === property
      && String(properties[0][1] ?? "").trim() === String(expected ?? "").trim();
    if (canonical) return;
    for (const [existing] of properties) {
      if (existing !== property) remove.add(existing);
    }
    set[property] = expected;
    changes.push({
      property,
      before: displayExistingProperties(properties),
      after: expected
    });
  };

  const removeProperty = (property: string) => {
    if (!hasOwn(frontmatter, property)) return;
    remove.add(property);
    changes.push({
      property,
      before: cloneValue(frontmatter[property]),
      after: undefined
    });
  };

  const filePlan = (): ManuscriptReconciliationFilePlan | null => {
    if (changes.length === 0) return null;
    return {
      path: record.path,
      title: record.title,
      kind: record.kind as "book" | "part" | "scene",
      beforeFrontmatter: frontmatter,
      changes,
      mutation: { remove: [...remove], set }
    };
  };

  return { setCanonical, removeProperty, filePlan };
}

function validChoiceForEntry(
  input: ManuscriptReconciliationInput,
  entry: ManuscriptDocumentRecord,
  choice: ManuscriptReconciliationPlacementChoice
): boolean {
  if (entry.kind === "part") return choice.parentPath === input.book.path;
  if (entry.kind !== "scene") return false;
  if (choice.parentPath === input.book.path) return true;
  return input.result.entries.some((candidate) => (
    candidate.path === choice.parentPath && candidate.kind === "part"
  ));
}

export function planManuscriptReconciliation(
  input: ManuscriptReconciliationInput,
  choices: ManuscriptReconciliationChoices = { placements: {}, rebalanceParents: [] }
): ManuscriptReconciliationPlan {
  const issues = issuesFor(input);
  const unresolved: string[] = [];
  const conflicts = issues.filter((issue) => issue.kind === "sync_conflict");
  if (conflicts.length > 0) {
    unresolved.push(...conflicts.map((issue) => issue.message));
  }
  const unsupported = issues.filter((issue) => issue.kind === "unsupported");
  unresolved.push(...unsupported.map((issue) => issue.message));

  const entries = entryByPath(input.result);
  const placementPaths = new Set(
    issues.filter((issue) => issue.kind === "placement" && issue.path).map((issue) => issue.path!)
  );
  const acceptedRebalances = new Set(choices.rebalanceParents);
  for (const issue of issues) {
    if (issue.kind === "placement" && issue.path && !choices.placements[issue.path]) {
      unresolved.push(`${entries.get(issue.path)?.title ?? issue.path} still needs a position.`);
    }
    if (issue.kind === "duplicate_keys" && issue.parentPath && !acceptedRebalances.has(issue.parentPath)) {
      unresolved.push(`Confirm the displayed order for ${parentTitle(input, issue.parentPath)} before rebalancing it.`);
    }
  }

  const pathsByParent = new Map<string, string[]>();
  for (const entry of input.result.entries) {
    if (entry.kind !== "part" && entry.kind !== "scene") continue;
    if (placementPaths.has(entry.path)) continue;
    const parent = effectiveParent(entry, input.book.path);
    const paths = pathsByParent.get(parent);
    if (paths) paths.push(entry.path);
    else pathsByParent.set(parent, [entry.path]);
  }

  const placementsByParent = new Map<string, string[]>();
  for (const path of placementPaths) {
    const entry = entries.get(path);
    const choice = choices.placements[path];
    if (!entry || !choice) continue;
    if (!validChoiceForEntry(input, entry, choice)) {
      unresolved.push(`${entry.title}'s selected parent is not valid.`);
      continue;
    }
    for (const siblings of pathsByParent.values()) {
      const index = siblings.indexOf(path);
      if (index >= 0) siblings.splice(index, 1);
    }
    const destination = pathsByParent.get(choice.parentPath) ?? [];
    const error = insertAtChoice(destination, path, choice);
    if (error) {
      unresolved.push(`${entry.title}: ${error}`);
      continue;
    }
    pathsByParent.set(choice.parentPath, destination);
    const placed = placementsByParent.get(choice.parentPath);
    if (placed) placed.push(path);
    else placementsByParent.set(choice.parentPath, [path]);
  }

  const expectedKeys = new Map<string, string>();
  const rebalanceParents = new Set<string>(acceptedRebalances);
  for (const [parentPath, placedPaths] of placementsByParent) {
    if (placedPaths.length !== 1) {
      rebalanceParents.add(parentPath);
      continue;
    }
    const siblings = pathsByParent.get(parentPath) ?? [];
    const path = placedPaths[0];
    const index = siblings.indexOf(path);
    const before = index > 0 ? entries.get(siblings[index - 1]) : null;
    const after = index >= 0 && index < siblings.length - 1
      ? entries.get(siblings[index + 1])
      : null;
    const between = manuscriptOrderKeyBetween(
      before ? manuscriptOrderKey(before.orderKey) : null,
      after ? manuscriptOrderKey(after.orderKey) : null
    );
    if (between) expectedKeys.set(path, between);
    else rebalanceParents.add(parentPath);
  }

  for (const parentPath of rebalanceParents) {
    const siblings = pathsByParent.get(parentPath) ?? [];
    const keys = evenlySpacedManuscriptOrderKeys(siblings.length);
    siblings.forEach((path, index) => expectedKeys.set(path, keys[index]));
  }

  const files: ManuscriptReconciliationFilePlan[] = [];
  const touched = new Set<string>();
  const addEntryPlan = (
    entry: ManuscriptDocumentRecord,
    parentPath?: string,
    key?: string
  ) => {
    const builder = mutationBuilder(entry, input.frontmatterByPath.get(entry.path));
    builder.setCanonical("type", MANUSCRIPT_TYPE_ALIASES, entry.kind);
    if (parentPath) {
      builder.setCanonical("parent", MANUSCRIPT_PARENT_ALIASES, manuscriptReference(parentPath));
    }
    if (key) {
      builder.setCanonical(
        MANUSCRIPT_ORDER_KEY_PROPERTY,
        [MANUSCRIPT_ORDER_KEY_PROPERTY],
        key
      );
    }
    const plan = builder.filePlan();
    if (plan) files.push(plan);
    touched.add(entry.path);
  };

  for (const issue of issues) {
    if (issue.kind !== "canonical_parent" || !issue.path || !issue.parentPath) continue;
    const entry = entries.get(issue.path);
    if (entry) addEntryPlan(entry, issue.parentPath, undefined);
  }

  for (const path of placementPaths) {
    const entry = entries.get(path);
    const choice = choices.placements[path];
    if (!entry || !choice || !expectedKeys.has(path)) continue;
    addEntryPlan(entry, choice.parentPath, expectedKeys.get(path));
  }

  for (const [path, key] of expectedKeys) {
    if (touched.has(path)) continue;
    const entry = entries.get(path);
    if (!entry) continue;
    addEntryPlan(entry, effectiveParent(entry, input.book.path), key);
  }

  if (issues.some((issue) => issue.kind === "obsolete_array")) {
    const builder = mutationBuilder(
      input.book,
      input.frontmatterByPath.get(input.book.path)
    );
    builder.setCanonical("type", MANUSCRIPT_TYPE_ALIASES, "book");
    builder.removeProperty(MANUSCRIPT_ORDER_PROPERTY);
    const plan = builder.filePlan();
    if (plan) files.push(plan);
  }

  const canApply = unresolved.length === 0 && files.length > 0;
  return {
    bookPath: input.book.path,
    bookTitle: input.book.title,
    issues,
    files,
    unresolved,
    canApply,
    alreadyReconciled: issues.length === 0 && files.length === 0,
    choices
  };
}

function stablePlanValue(plan: ManuscriptReconciliationPlan): unknown {
  return {
    bookPath: plan.bookPath,
    choices: plan.choices,
    unresolved: plan.unresolved,
    files: plan.files.map((file) => ({
      path: file.path,
      changes: file.changes,
      mutation: {
        remove: [...file.mutation.remove].sort(),
        set: Object.fromEntries(
          Object.entries(file.mutation.set).sort(([left], [right]) => left.localeCompare(right))
        )
      }
    }))
  };
}

export function sameManuscriptReconciliationPlan(
  left: ManuscriptReconciliationPlan,
  right: ManuscriptReconciliationPlan
): boolean {
  return JSON.stringify(stablePlanValue(left)) === JSON.stringify(stablePlanValue(right));
}

export function manuscriptNeedsReconciliation(result: ManuscriptOrderResult): boolean {
  return result.source === "distributed"
    && result.diagnostics.some((diagnostic) => RECONCILIATION_DIAGNOSTICS.has(diagnostic.kind));
}
