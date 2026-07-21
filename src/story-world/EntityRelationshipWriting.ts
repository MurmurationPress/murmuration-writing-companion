import {
  applyEntityRelationshipMutation,
  cloneRelationshipValue,
  EntityRelationshipMutation,
  relationshipProperty,
  relationshipValuesEqual
} from "./EntityRelationships";

export interface EntityRelationshipDocumentState {
  readonly revision: string;
  readonly text: string;
  readonly frontmatter: Record<string, unknown>;
}

export interface EntityRelationshipWriteHost {
  read(): Promise<EntityRelationshipDocumentState>;
  processFrontmatter(change: (frontmatter: Record<string, unknown>) => void): Promise<void>;
  restore(text: string): Promise<void>;
}

export class StaleEntityRelationshipWriteError extends Error {
  constructor() {
    super("The entity note changed after relationship editing began. Review the newer Markdown and try again.");
    this.name = "StaleEntityRelationshipWriteError";
  }
}

export class EntityRelationshipVerificationError extends Error {
  constructor() {
    super("The saved relationship could not be verified. This operation was rolled back when it was safe to do so.");
    this.name = "EntityRelationshipVerificationError";
  }
}

function replaceRecord(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(target)) {
    if (key !== "position") delete target[key];
  }
  for (const [key, value] of Object.entries(source)) target[key] = cloneRelationshipValue(value);
}

function withoutRelationship(frontmatter: Record<string, unknown>): Record<string, unknown> {
  const copy = cloneRelationshipValue(frontmatter) as Record<string, unknown>;
  delete copy[relationshipProperty(copy)];
  return copy;
}

export async function writeEntityRelationshipMutation(
  host: EntityRelationshipWriteHost,
  expected: EntityRelationshipDocumentState,
  mutation: EntityRelationshipMutation
): Promise<EntityRelationshipDocumentState> {
  const current = await host.read();
  if (current.revision !== expected.revision
    || !relationshipValuesEqual(current.frontmatter, expected.frontmatter)) {
    throw new StaleEntityRelationshipWriteError();
  }
  if (typeof current.frontmatter.world_entity !== "string" || !current.frontmatter.world_entity.trim()) {
    throw new Error("The note is no longer an authoritative Story World entity.");
  }

  const nextFrontmatter = applyEntityRelationshipMutation(current.frontmatter, mutation);
  await host.processFrontmatter((frontmatter) => {
    if (!relationshipValuesEqual(frontmatter, current.frontmatter)) throw new StaleEntityRelationshipWriteError();
    replaceRecord(frontmatter, nextFrontmatter);
  });

  const written = await host.read();
  if (relationshipValuesEqual(written.frontmatter, nextFrontmatter)) return written;

  const latest = await host.read();
  const onlyThisOperationCanBeRolledBack = relationshipValuesEqual(
    withoutRelationship(written.frontmatter),
    withoutRelationship(current.frontmatter)
  );
  if (onlyThisOperationCanBeRolledBack && latest.revision === written.revision) {
    await host.restore(current.text);
  }
  throw new EntityRelationshipVerificationError();
}
