import {
  BOOK_REFERENCE_ALIASES,
  MANUSCRIPT_PARENT_ALIASES,
  normalizeBookPropertyName
} from "../editorial/BookReview";
import {
  DETACHED_SCENE_TYPE,
  MANUSCRIPT_TYPE_ALIASES
} from "./ManuscriptMetadata";
import { MANUSCRIPT_ORDER_KEY_PROPERTY } from "./ManuscriptOrderKey";

export interface DetachmentEntrySnapshot {
  readonly path: string;
  readonly title: string;
  readonly kind: "book" | "part" | "scene";
  readonly parentPath: string | null;
  readonly orderKey: string | null;
}

export interface ManuscriptSceneDetachmentSnapshot {
  readonly selectedBookPath: string | null;
  readonly selectedContextPath: string | null;
  readonly selectionRevision: number;
  readonly bookPath: string;
  readonly bookTitle: string;
  readonly source: string;
  readonly structuralErrors: readonly string[];
  readonly entries: readonly DetachmentEntrySnapshot[];
  readonly scenePath: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly authoritativeBookProperties: readonly string[];
  readonly mtime: number;
  readonly size: number;
  readonly sourceHash: string;
}

export interface DetachmentPropertyChange {
  readonly property: string;
  readonly before: unknown;
  readonly after?: unknown;
  readonly action: "replace" | "remove";
}

export interface ManuscriptSceneDetachmentPlan {
  readonly path: string;
  readonly title: string;
  readonly bookPath: string;
  readonly bookTitle: string;
  readonly parentPath: string;
  readonly parentTitle: string;
  readonly parentKind: "book" | "part";
  readonly orderKey: string;
  readonly previous: DetachmentEntrySnapshot | null;
  readonly next: DetachmentEntrySnapshot | null;
  readonly bookPosition: number;
  readonly siblingPosition: number;
  readonly siblingCount: number;
  readonly selectedBookPath: string | null;
  readonly selectedContextPath: string | null;
  readonly selectionRevision: number;
  readonly mtime: number;
  readonly size: number;
  readonly sourceHash: string;
  readonly relevantFrontmatter: Readonly<Record<string, unknown>>;
  readonly changes: readonly DetachmentPropertyChange[];
  readonly typeProperties: readonly string[];
  readonly parentProperties: readonly string[];
  readonly orderKeyProperties: readonly string[];
  readonly bookProperties: readonly string[];
  readonly fallbackPath: string;
  readonly errors: readonly string[];
}

function normalizedSet(values: readonly string[]): Set<string> {
  return new Set(values.map(normalizeBookPropertyName));
}

const TYPE_NAMES = normalizedSet(MANUSCRIPT_TYPE_ALIASES);
const PARENT_NAMES = normalizedSet(MANUSCRIPT_PARENT_ALIASES);
const ORDER_NAMES = normalizedSet([MANUSCRIPT_ORDER_KEY_PROPERTY]);
const BOOK_NAMES = normalizedSet(BOOK_REFERENCE_ALIASES);

function propertiesMatching(frontmatter: Readonly<Record<string, unknown>>, names: ReadonlySet<string>): string[] {
  return Object.keys(frontmatter).filter((property) => property !== "position" && names.has(normalizeBookPropertyName(property)));
}

function clone(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function captureDetachmentRelevantFrontmatter(
  frontmatter: Readonly<Record<string, unknown>>,
  authoritativeBookProperties: readonly string[]
): Readonly<Record<string, unknown>> {
  const names = new Set([
    ...propertiesMatching(frontmatter, TYPE_NAMES),
    ...propertiesMatching(frontmatter, PARENT_NAMES),
    ...propertiesMatching(frontmatter, ORDER_NAMES),
    ...authoritativeBookProperties
  ]);
  return Object.fromEntries([...names].sort().map((property) => [property, clone(frontmatter[property])]));
}

export function sameDetachmentRelevantFrontmatter(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function planManuscriptSceneDetachment(
  snapshot: ManuscriptSceneDetachmentSnapshot
): ManuscriptSceneDetachmentPlan {
  const errors: string[] = [];
  const scene = snapshot.entries.find((entry) => entry.path === snapshot.scenePath);
  if (!scene || scene.kind !== "scene") errors.push("The selected note is no longer a recognised manuscript Scene.");
  if (snapshot.selectedBookPath !== snapshot.bookPath) errors.push("The owning Book is no longer selected.");
  if (snapshot.source !== "distributed") errors.push("Remove from manuscript requires valid distributed manuscript order.");
  errors.push(...snapshot.structuralErrors);

  const parentPath = scene?.parentPath ?? snapshot.bookPath;
  const parent = parentPath === snapshot.bookPath
    ? snapshot.entries.find((entry) => entry.path === snapshot.bookPath)
    : snapshot.entries.find((entry) => entry.path === parentPath);
  if (!parent || (parent.kind !== "book" && parent.kind !== "part")) errors.push("The Scene does not have a valid Book or Part parent.");
  if (!scene?.orderKey) errors.push("The Scene does not have a valid manuscript_order_key.");

  const siblings = snapshot.entries.filter((entry) => entry.path !== snapshot.bookPath && (entry.parentPath ?? snapshot.bookPath) === parentPath);
  const siblingIndex = siblings.findIndex((entry) => entry.path === snapshot.scenePath);
  const sceneEntries = snapshot.entries.filter((entry) => entry.kind === "scene");
  const bookIndex = sceneEntries.findIndex((entry) => entry.path === snapshot.scenePath);
  if (siblingIndex < 0 || bookIndex < 0) errors.push("The Scene's manuscript position could not be confirmed.");
  const previous = siblingIndex > 0 ? siblings[siblingIndex - 1] : null;
  const next = siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : null;

  const typeProperties = propertiesMatching(snapshot.frontmatter, TYPE_NAMES);
  const parentProperties = propertiesMatching(snapshot.frontmatter, PARENT_NAMES);
  const orderKeyProperties = propertiesMatching(snapshot.frontmatter, ORDER_NAMES);
  const bookProperties = snapshot.authoritativeBookProperties.filter((property) => (
    BOOK_NAMES.has(normalizeBookPropertyName(property)) && Object.prototype.hasOwnProperty.call(snapshot.frontmatter, property)
  ));
  if (typeProperties.length === 0) errors.push("The recognised Scene type property could not be found.");

  const canonicalType = typeProperties.find((property) => property === "type") ?? null;
  const removals = [...new Set([...typeProperties.filter((property) => property !== canonicalType), ...parentProperties, ...orderKeyProperties, ...bookProperties])];
  const changes: DetachmentPropertyChange[] = removals.map((property) => ({
    property,
    before: clone(snapshot.frontmatter[property]),
    action: "remove" as const
  }));
  changes.unshift({ property: "type", before: canonicalType ? snapshot.frontmatter[canonicalType] : undefined, after: DETACHED_SCENE_TYPE, action: "replace" });

  return {
    path: snapshot.scenePath,
    title: scene?.title ?? snapshot.scenePath,
    bookPath: snapshot.bookPath,
    bookTitle: snapshot.bookTitle,
    parentPath,
    parentTitle: parent?.title ?? parentPath,
    parentKind: parent?.kind === "part" ? "part" : "book",
    orderKey: scene?.orderKey ?? "",
    previous,
    next,
    bookPosition: bookIndex + 1,
    siblingPosition: siblingIndex + 1,
    siblingCount: siblings.length,
    selectedBookPath: snapshot.selectedBookPath,
    selectedContextPath: snapshot.selectedContextPath,
    selectionRevision: snapshot.selectionRevision,
    mtime: snapshot.mtime,
    size: snapshot.size,
    sourceHash: snapshot.sourceHash,
    relevantFrontmatter: captureDetachmentRelevantFrontmatter(snapshot.frontmatter, snapshot.authoritativeBookProperties),
    changes,
    typeProperties,
    parentProperties,
    orderKeyProperties,
    bookProperties,
    fallbackPath: next?.path ?? previous?.path ?? (parent?.kind === "part" ? parent.path : snapshot.bookPath),
    errors
  };
}

export function applyManuscriptSceneDetachment(
  frontmatter: Record<string, unknown>,
  plan: ManuscriptSceneDetachmentPlan
): void {
  for (const property of new Set([
    ...plan.typeProperties,
    ...plan.parentProperties,
    ...plan.orderKeyProperties,
    ...plan.bookProperties
  ])) delete frontmatter[property];
  frontmatter.type = DETACHED_SCENE_TYPE;
}

export function revalidateManuscriptSceneDetachment(
  preview: ManuscriptSceneDetachmentPlan,
  snapshot: ManuscriptSceneDetachmentSnapshot
): ManuscriptSceneDetachmentPlan {
  const current = planManuscriptSceneDetachment(snapshot);
  const stale = preview.path !== current.path
    || preview.bookPath !== current.bookPath
    || preview.parentPath !== current.parentPath
    || preview.orderKey !== current.orderKey
    || preview.sourceHash !== current.sourceHash
    || !sameDetachmentRelevantFrontmatter(preview.relevantFrontmatter, current.relevantFrontmatter);
  return stale
    ? { ...current, errors: [...current.errors, "The confirmed Scene detachment became stale. Review it again."] }
    : current;
}

export function markdownBody(content: string): string {
  const match = /^---[^\r\n]*(?:\r\n|\n)[\s\S]*?(?:\r\n|\n)---[^\r\n]*(?:\r\n|\n|$)/.exec(content);
  return match ? content.slice(match[0].length) : content;
}
