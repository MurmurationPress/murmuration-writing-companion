import {
  getChapterContextField,
  getEditableChapterContextValue
} from "../companion/ChapterContext";
import type { StoryWorldEntityRecord } from "./StoryWorldIndex";
import { parseWikilink } from "./StoryWorldIndex";
import { POV_TYPED_PROPERTY_NAMES } from "./TypedEntityProperties";

export type PovProfileResolutionIssueKind =
  | "invalid-profile-reference"
  | "missing-profile"
  | "wrong-profile-type"
  | "inheritance-cycle"
  | "ambiguous-scoped-profile";

export interface PovProfileResolutionIssue {
  readonly kind: PovProfileResolutionIssueKind;
  readonly reference: string;
  readonly profilePath?: string;
  readonly candidatePaths?: readonly string[];
}

export interface ResolvedPovProfileChain {
  readonly povEntity: StoryWorldEntityRecord | null;
  /** Profiles are ordered from the most general base to the effective profile. */
  readonly profiles: readonly StoryWorldEntityRecord[];
  readonly issues: readonly PovProfileResolutionIssue[];
}

export interface PovGuidanceSection {
  readonly profile: StoryWorldEntityRecord;
  readonly markdown: string;
}

export interface EffectivePovGuidance extends ResolvedPovProfileChain {
  readonly sections: readonly PovGuidanceSection[];
}

export function povProfileResolutionIssueMessage(
  issues: readonly PovProfileResolutionIssue[]
): string | null {
  if (issues.some((issue) => issue.kind === "ambiguous-scoped-profile")) {
    return "Multiple Book-scoped POV profiles match this Scene. None was applied; resolve the duplicate scope manually.";
  }
  return issues.length
    ? "Some linked POV profile guidance could not be resolved. Existing chapter context remains available."
    : null;
}

export type PovProfileEntityResolver = (
  reference: string,
  sourcePath: string
) => StoryWorldEntityRecord | null;

export interface PovProfileScopeResolutionOptions {
  /** The authoritative owning Book note path for the current Scene. */
  readonly activeBookPath: string | null;
  /** Existing indexed Story World entities; no vault scan is performed. */
  readonly indexedEntities: readonly StoryWorldEntityRecord[];
  /** Resolves a semantic world_scope wikilink to a vault path. */
  readonly resolveScope: (reference: string, sourcePath: string) => string | null;
}

function scalarString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isPovProfile(entity: StoryWorldEntityRecord): boolean {
  return entity.entityType.trim().toLocaleLowerCase() === "pov-profile";
}

/**
 * Resolves only indexed Story World metadata. It never scans or writes the vault.
 * The returned chain is deterministic and base-first for direct presentation or
 * downstream Chapter Context consumers.
 */
export function resolvePovProfileChain(
  sceneFrontmatter: Record<string, unknown> | undefined,
  scenePath: string,
  resolve: PovProfileEntityResolver,
  scopeOptions?: PovProfileScopeResolutionOptions
): ResolvedPovProfileChain {
  const pov = getEditableChapterContextValue(
    sceneFrontmatter,
    getChapterContextField("pov")
  ).value;
  if (!parseWikilink(pov)) return { povEntity: null, profiles: [], issues: [] };

  const povEntity = resolve(pov, scenePath);
  if (!povEntity) return { povEntity: null, profiles: [], issues: [] };

  const profileReference = scalarString(
    povEntity.properties[POV_TYPED_PROPERTY_NAMES.profile]
  );
  if (!profileReference) return { povEntity, profiles: [], issues: [] };

  const profiles: StoryWorldEntityRecord[] = [];
  const issues: PovProfileResolutionIssue[] = [];
  const included = new Set<string>();
  const visiting = new Set<string>();

  const visitReference = (reference: string, sourcePath: string): void => {
    if (!parseWikilink(reference)) {
      issues.push({ kind: "invalid-profile-reference", reference });
      return;
    }
    const profile = resolve(reference, sourcePath);
    if (!profile) {
      issues.push({ kind: "missing-profile", reference });
      return;
    }
    if (!isPovProfile(profile)) {
      issues.push({ kind: "wrong-profile-type", reference, profilePath: profile.path });
      return;
    }
    if (visiting.has(profile.path)) {
      issues.push({ kind: "inheritance-cycle", reference, profilePath: profile.path });
      return;
    }
    if (included.has(profile.path)) return;

    visiting.add(profile.path);
    const parentReference = scalarString(
      profile.properties[POV_TYPED_PROPERTY_NAMES.extends]
    );
    if (parentReference) visitReference(parentReference, profile.path);
    visiting.delete(profile.path);

    if (!included.has(profile.path)) {
      included.add(profile.path);
      profiles.push(profile);
    }
  };

  visitReference(profileReference, povEntity.path);

  const activeBookPath = scopeOptions?.activeBookPath;
  if (activeBookPath && profiles.length) {
    let current = profiles[profiles.length - 1];
    while (current) {
      const matching = scopeOptions.indexedEntities.filter((candidate) => {
        if (!isPovProfile(candidate)) return false;
        const parentReference = scalarString(candidate.properties[POV_TYPED_PROPERTY_NAMES.extends]);
        if (!parentReference) return false;
        const parent = resolve(parentReference, candidate.path);
        if (parent?.path !== current.path) return false;
        return candidate.scope.some((scope) => (
          scopeOptions.resolveScope(scope, candidate.path) === activeBookPath
        ));
      }).sort((left, right) => left.path.localeCompare(right.path, "en", { sensitivity: "base" }));

      if (matching.length > 1) {
        issues.push({
          kind: "ambiguous-scoped-profile",
          reference: activeBookPath,
          profilePath: current.path,
          candidatePaths: matching.map((candidate) => candidate.path)
        });
        break;
      }
      const scoped = matching[0];
      if (!scoped) break;
      if (included.has(scoped.path)) {
        issues.push({
          kind: "inheritance-cycle",
          reference: scalarString(scoped.properties[POV_TYPED_PROPERTY_NAMES.extends]) ?? scoped.path,
          profilePath: scoped.path
        });
        break;
      }
      included.add(scoped.path);
      profiles.push(scoped);
      current = scoped;
    }
  }
  return { povEntity, profiles, issues };
}

/** Removes an initial YAML frontmatter block without interpreting or rewriting it. */
export function povProfileMarkdownBody(markdown: string): string {
  const normalised = markdown.replace(/\r\n?/g, "\n");
  if (!normalised.startsWith("---\n")) return normalised.trim();
  const match = /^---\n[\s\S]*?\n---(?:\n|$)/u.exec(normalised);
  return (match ? normalised.slice(match[0].length) : normalised).trim();
}

export function buildEffectivePovGuidance(
  resolution: ResolvedPovProfileChain,
  markdownForProfile: (profile: StoryWorldEntityRecord) => string | null | undefined
): EffectivePovGuidance {
  const sections = resolution.profiles.flatMap((profile) => {
    const markdown = markdownForProfile(profile);
    if (typeof markdown !== "string") return [];
    const body = povProfileMarkdownBody(markdown);
    return body ? [{ profile, markdown: body }] : [];
  });
  return { ...resolution, sections };
}

/** A stable text projection for existing or future Chapter Context consumers. */
export function buildPovGuidanceMarkdown(guidance: EffectivePovGuidance): string {
  if (!guidance.sections.length) return "";
  return [
    "## POV Guidance",
    ...guidance.sections.flatMap((section) => [
      `### ${section.profile.name}`,
      section.markdown
    ])
  ].join("\n\n");
}
