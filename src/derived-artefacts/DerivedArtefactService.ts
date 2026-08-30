import {
  DerivedArtefactDefinition,
  isDerivedArtefactDefinition,
  parseDerivedArtefactDefinition
} from "./DerivedArtefactDefinition";
import { FrontmatterRecord, normaliseLineChartData } from "./LineChartData";
import { renderLineChartSvg } from "./LineChartSvg";
import { normaliseStateTableData } from "./StateTableData";
import { renderStateTableMarkdown } from "./StateTableMarkdown";

export interface ArtefactDocument { readonly path: string; readonly frontmatter?: Record<string, unknown>; }
export interface DerivedArtefactVault {
  markdownDocuments(): readonly ArtefactDocument[];
  entryKind(path: string): "file" | "folder" | null;
  createFolder(path: string): Promise<void>;
  create(path: string, content: string): Promise<void>;
  modify(path: string, content: string): Promise<void>;
  read(path: string): Promise<string>;
}
export interface GeneratedArtefact {
  readonly definitionPath: string;
  readonly artefactType: DerivedArtefactDefinition["artefactType"];
  readonly outputPath: string;
  readonly observations: number;
  readonly content: string;
  /** Preserved for callers of the original line-chart API. */
  readonly svg?: string;
  readonly markdown?: string;
}

function sourceRecords(vault: DerivedArtefactVault, source: string): FrontmatterRecord[] {
  const folder = source.replace(/^\/+|\/+$/gu, "");
  if (!folder) throw new Error("source must name a vault folder.");
  return vault.markdownDocuments()
    .filter((document) => document.path.startsWith(`${folder}/`))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
    .map((document) => ({ path: document.path, frontmatter: document.frontmatter ?? {} }));
}

const stateTableMarker = (definitionPath: string) => `<!-- mwc-derived-artefact:state-table definition=${encodeURIComponent(definitionPath)} -->`;

function parsedDefinitions(documents: readonly ArtefactDocument[]): { document: ArtefactDocument; definition: DerivedArtefactDefinition }[] {
  const parsed: { document: ArtefactDocument; definition: DerivedArtefactDefinition }[] = [];
  for (const document of documents) {
    if (!isDerivedArtefactDefinition(document.frontmatter)) continue;
    try { parsed.push({ document, definition: parseDerivedArtefactDefinition(document.frontmatter ?? {}) }); }
    catch { /* An invalid definition is reported when its own generation is attempted. */ }
  }
  return parsed;
}

async function ensureParents(vault: DerivedArtefactVault, path: string): Promise<void> {
  const parts = path.split("/").slice(0, -1);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const kind = vault.entryKind(current);
    if (kind === "file") throw new Error(`Cannot create output folder because ${current} is a file.`);
    if (!kind) await vault.createFolder(current);
  }
}

export class DerivedArtefactService {
  constructor(private readonly vault: DerivedArtefactVault) {}

  definitions(): ArtefactDocument[] {
    return this.vault.markdownDocuments().filter((document) => isDerivedArtefactDefinition(document.frontmatter)).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  }

  async generate(definitionPath: string): Promise<GeneratedArtefact> {
    const documents = this.vault.markdownDocuments();
    const document = documents.find((candidate) => candidate.path === definitionPath);
    if (!document) throw new Error(`${definitionPath}: definition note was not found.`);
    let definition;
    try { definition = parseDerivedArtefactDefinition(document.frontmatter ?? {}); }
    catch (error) { throw new Error(`${definitionPath}: ${error instanceof Error ? error.message : String(error)}`); }
    const outputPath = definition.output.replace(/^\/+|\/+$/gu, "");
    const markdownPaths = new Set(documents.map((item) => item.path));
    const knownDefinitions = parsedDefinitions(documents);
    const definitionPaths = new Set(knownDefinitions.map((item) => item.document.path));
    const sourceFolders = knownDefinitions.map((item) => item.definition.source.replace(/^\/+|\/+$/gu, "")).filter(Boolean);
    const outputIsCanonical = definitionPaths.has(outputPath) || sourceFolders.some((source) => outputPath.startsWith(`${source}/`));
    if (outputIsCanonical) throw new Error(`${definitionPath}: output collides with a source or definition note.`);
    if (definition.artefactType === "line-chart") {
      const withoutSvg = outputPath.replace(/\.svg$/iu, "");
      if (markdownPaths.has(outputPath) || markdownPaths.has(`${withoutSvg}.md`)) {
        throw new Error(`${definitionPath}: output collides with a Markdown source or definition note.`);
      }
    } else if (markdownPaths.has(outputPath)) {
      const existing = await this.vault.read(outputPath);
      if (!existing.includes(stateTableMarker(definitionPath))) {
        throw new Error(`${definitionPath}: output collides with a Markdown source or definition note.`);
      }
    }
    if (this.vault.entryKind(outputPath) === "folder") throw new Error(`${definitionPath}: output path is an existing folder.`);
    if (definition.artefactType === "state-table" && this.vault.entryKind(definition.source.replace(/^\/+|\/+$/gu, "")) !== "folder") {
      throw new Error(`${definitionPath}: source must name an existing vault folder.`);
    }
    let observations: number;
    let content: string;
    try {
      const records = sourceRecords(this.vault, definition.source);
      if (definition.artefactType === "line-chart") {
        const data = normaliseLineChartData(definition, records);
        observations = data.points.length;
        content = renderLineChartSvg(data);
      } else {
        const data = normaliseStateTableData(definition, records);
        observations = data.observations.length;
        content = `${renderStateTableMarkdown(data)}\n${stateTableMarker(definitionPath)}\n`;
      }
    } catch (error) { throw new Error(`${definitionPath}: ${error instanceof Error ? error.message : String(error)}`); }
    await ensureParents(this.vault, outputPath);
    if (this.vault.entryKind(outputPath) === "file") await this.vault.modify(outputPath, content);
    else await this.vault.create(outputPath, content);
    return {
      definitionPath,
      artefactType: definition.artefactType,
      outputPath,
      observations,
      content,
      ...(definition.artefactType === "line-chart" ? { svg: content } : { markdown: content })
    };
  }
}
