import { App, getFrontMatterInfo, MarkdownView, parseYaml, TFile } from "obsidian";
import {
  EntityRelationshipDocumentState,
  EntityRelationshipWriteHost,
  writeEntityRelationshipMutation
} from "./EntityRelationshipWriting";
import { EntityRelationshipMutation, isRecord } from "./EntityRelationships";

function parseFrontmatter(text: string): Record<string, unknown> {
  const info = getFrontMatterInfo(text);
  const parsed = info.exists ? parseYaml(info.frontmatter) : {};
  if (!isRecord(parsed)) throw new Error("The entity note's YAML frontmatter is invalid.");
  return parsed;
}

function revision(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${hash >>> 0}`;
}

export async function readEntityRelationshipDocument(
  app: App,
  file: TFile
): Promise<EntityRelationshipDocumentState> {
  let openText: string | null = null;
  app.workspace.iterateRootLeaves((leaf) => {
    if (openText !== null) return;
    if (leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path) {
      openText = leaf.view.editor.getValue();
    }
  });
  const text = openText ?? await app.vault.read(file);
  return { revision: revision(text), text, frontmatter: parseFrontmatter(text) };
}

export async function readAuthoritativeEntityRelationshipDocument(
  app: App,
  file: TFile
): Promise<EntityRelationshipDocumentState> {
  const text = await app.vault.read(file);
  return { revision: revision(text), text, frontmatter: parseFrontmatter(text) };
}

export async function writeObsidianEntityRelationship(
  app: App,
  file: TFile,
  expected: EntityRelationshipDocumentState,
  mutation: EntityRelationshipMutation
): Promise<EntityRelationshipDocumentState> {
  const host: EntityRelationshipWriteHost = {
    readCurrent: () => readEntityRelationshipDocument(app, file),
    readAuthoritative: () => readAuthoritativeEntityRelationshipDocument(app, file),
    processFrontmatter: (change) => app.fileManager.processFrontMatter(file, change),
    restore: (text) => app.vault.modify(file, text)
  };
  return writeEntityRelationshipMutation(host, expected, mutation);
}
