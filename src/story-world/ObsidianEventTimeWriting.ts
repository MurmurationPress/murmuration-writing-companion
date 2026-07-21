import { App, getFrontMatterInfo, MarkdownView, parseYaml, TFile } from "obsidian";
import { EventTimeDocumentState, EventTimeMutation, EventTimeWriteHost, writeEventTimeMutation } from "./EventTimeWriting";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function parseFrontmatter(text: string): Record<string, unknown> {
  const info = getFrontMatterInfo(text);
  const parsed = info.exists ? parseYaml(info.frontmatter) : {};
  if (!isRecord(parsed)) throw new Error("The event note's YAML frontmatter is invalid.");
  return parsed;
}
function revision(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `${text.length}:${hash >>> 0}`;
}
export async function readEventTimeDocument(app: App, file: TFile): Promise<EventTimeDocumentState> {
  let openText: string | null = null;
  app.workspace.iterateRootLeaves((leaf) => {
    if (openText === null && leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path) openText = leaf.view.editor.getValue();
  });
  const text = openText ?? await app.vault.read(file);
  return { revision: revision(text), text, frontmatter: parseFrontmatter(text) };
}
export async function readAuthoritativeEventTimeDocument(app: App, file: TFile): Promise<EventTimeDocumentState> {
  const text = await app.vault.read(file);
  return { revision: revision(text), text, frontmatter: parseFrontmatter(text) };
}
export function writeObsidianEventTime(app: App, file: TFile, expected: EventTimeDocumentState, mutation: EventTimeMutation): Promise<EventTimeDocumentState> {
  const host: EventTimeWriteHost = {
    readCurrent: () => readEventTimeDocument(app, file), readAuthoritative: () => readAuthoritativeEventTimeDocument(app, file),
    processFrontmatter: (change) => app.fileManager.processFrontMatter(file, change), restore: (text) => app.vault.modify(file, text)
  };
  return writeEventTimeMutation(host, expected, mutation);
}
