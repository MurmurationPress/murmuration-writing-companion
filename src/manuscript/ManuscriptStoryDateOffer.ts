import { findAliasedProperty, getChapterContextField } from "../companion/ChapterContext";
import { parseTemporalInterval } from "../observations/TemporalInterval";
import { precedingStoryDate, PrecedingStoryDateProposal, PrecedingStoryDateScene } from "./PrecedingStoryDate";

export interface ManuscriptStoryDateOfferSnapshot {
  readonly activePath: string | null;
  readonly targetPath: string;
  readonly targetTitle: string;
  readonly targetParentPath: string;
  readonly targetOrderKey: string;
  readonly targetPosition: number;
  readonly targetMtime: number;
  readonly targetSize: number;
  readonly targetFrontmatter: Readonly<Record<string, unknown>> | undefined;
  readonly bookPath: string;
  readonly structurallySafe: boolean;
  readonly orderedScenes: readonly PrecedingStoryDateScene[];
  readonly sourceFileStateByPath: ReadonlyMap<string, { readonly mtime: number; readonly size: number }>;
}

export interface ManuscriptStoryDateOffer extends PrecedingStoryDateProposal {
  readonly targetPath: string;
  readonly targetTitle: string;
  readonly targetParentPath: string;
  readonly targetOrderKey: string;
  readonly targetPosition: number;
  readonly targetMtime: number;
  readonly targetSize: number;
  readonly targetDateFingerprint: string;
  readonly bookPath: string;
  readonly sourceMtime: number;
  readonly sourceSize: number;
}

function fingerprint(value: unknown): string {
  if (value instanceof Date) return `date:${value.toISOString()}`;
  return `${typeof value}:${JSON.stringify(value)}`;
}

export function storyDateAliasFingerprint(frontmatter: Readonly<Record<string, unknown>> | undefined): string {
  const aliases = getChapterContextField("story_date").aliases;
  return aliases.map((alias) => {
    const match = findAliasedProperty(frontmatter, [alias]);
    return match ? `${match.property}=${fingerprint(match.value)}` : `${alias}=missing`;
  }).join("|");
}

export function targetIsGenuinelyUndated(frontmatter: Readonly<Record<string, unknown>> | undefined): boolean {
  const match = findAliasedProperty(frontmatter, getChapterContextField("story_date").aliases);
  if (!match) return true;
  return parseTemporalInterval(match.value).kind === "missing";
}

export function manuscriptStoryDateOffer(snapshot: ManuscriptStoryDateOfferSnapshot): ManuscriptStoryDateOffer | null {
  if (!snapshot.structurallySafe || snapshot.activePath !== snapshot.targetPath) return null;
  if (!targetIsGenuinelyUndated(snapshot.targetFrontmatter)) return null;
  if (snapshot.targetPosition <= 0 || snapshot.orderedScenes[snapshot.targetPosition]?.path !== snapshot.targetPath) return null;
  const proposal = precedingStoryDate(snapshot.orderedScenes, snapshot.targetPosition);
  if (!proposal) return null;
  const sourceState = snapshot.sourceFileStateByPath.get(proposal.sourcePath);
  if (!sourceState) return null;
  return {
    ...proposal,
    targetPath: snapshot.targetPath,
    targetTitle: snapshot.targetTitle,
    targetParentPath: snapshot.targetParentPath,
    targetOrderKey: snapshot.targetOrderKey,
    targetPosition: snapshot.targetPosition,
    targetMtime: snapshot.targetMtime,
    targetSize: snapshot.targetSize,
    targetDateFingerprint: storyDateAliasFingerprint(snapshot.targetFrontmatter),
    bookPath: snapshot.bookPath,
    sourceMtime: sourceState.mtime,
    sourceSize: sourceState.size
  };
}

export function sameManuscriptStoryDateOffer(reviewed: ManuscriptStoryDateOffer, current: ManuscriptStoryDateOffer | null): boolean {
  if (!current) return false;
  return reviewed.targetPath === current.targetPath
    && reviewed.targetParentPath === current.targetParentPath
    && reviewed.targetOrderKey === current.targetOrderKey
    && reviewed.targetPosition === current.targetPosition
    && reviewed.targetMtime === current.targetMtime
    && reviewed.targetSize === current.targetSize
    && reviewed.targetDateFingerprint === current.targetDateFingerprint
    && reviewed.bookPath === current.bookPath
    && reviewed.sourceMtime === current.sourceMtime
    && reviewed.sourceSize === current.sourceSize
    && reviewed.sourcePath === current.sourcePath
    && reviewed.sourcePosition === current.sourcePosition
    && reviewed.property === current.property
    && fingerprint(reviewed.raw) === fingerprint(current.raw)
    && reviewed.value === current.value
    && reviewed.precision === current.precision;
}

export function applyManuscriptStoryDateOffer(
  frontmatter: Record<string, unknown>,
  canonicalValue: string
): void {
  const parsed = parseTemporalInterval(canonicalValue);
  if (parsed.kind !== "supported" || !parsed.value.point || parsed.value.authoredShape === "range") {
    throw new Error("The preceding story date is not a supported canonical point value.");
  }
  if (!targetIsGenuinelyUndated(frontmatter)) {
    throw new Error("The target Scene is no longer undated.");
  }
  const aliasNames = new Set(getChapterContextField("story_date").aliases.map((alias) => alias.trim().toLowerCase().replace(/[\s-]+/g, "_")));
  for (const property of Object.keys(frontmatter)) {
    const normalized = property.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (property !== "position" && aliasNames.has(normalized)) delete frontmatter[property];
  }
  frontmatter.story_date = parsed.value.source;
}
