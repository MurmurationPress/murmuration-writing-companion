import { isDerivedArtefactDefinition, parseLineChartDefinition } from "./DerivedArtefactDefinition";
import { FrontmatterRecord, normaliseLineChartData } from "./LineChartData";
import { renderLineChartSvg } from "./LineChartSvg";

export interface ArtefactDocument { readonly path: string; readonly frontmatter?: Record<string, unknown>; }
export interface DerivedArtefactVault {
  markdownDocuments(): readonly ArtefactDocument[];
  entryKind(path: string): "file" | "folder" | null;
  createFolder(path: string): Promise<void>;
  create(path: string, content: string): Promise<void>;
  modify(path: string, content: string): Promise<void>;
}
export interface GeneratedArtefact { readonly definitionPath: string; readonly outputPath: string; readonly observations: number; readonly svg: string; }

function sourceRecords(vault: DerivedArtefactVault, source: string): FrontmatterRecord[] {
  const folder = source.replace(/^\/+|\/+$/gu, "");
  if (!folder) throw new Error("source must name a vault folder.");
  return vault.markdownDocuments()
    .filter((document) => document.path.startsWith(`${folder}/`))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
    .map((document) => ({ path: document.path, frontmatter: document.frontmatter ?? {} }));
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
    const document = this.vault.markdownDocuments().find((candidate) => candidate.path === definitionPath);
    if (!document) throw new Error(`${definitionPath}: definition note was not found.`);
    let definition;
    try { definition = parseLineChartDefinition(document.frontmatter ?? {}); }
    catch (error) { throw new Error(`${definitionPath}: ${error instanceof Error ? error.message : String(error)}`); }
    const outputPath = definition.output.replace(/^\/+|\/+$/gu, "");
    const markdownPaths = new Set(this.vault.markdownDocuments().map((item) => item.path));
    const withoutSvg = outputPath.replace(/\.svg$/iu, "");
    if (markdownPaths.has(outputPath) || markdownPaths.has(`${withoutSvg}.md`)) throw new Error(`${definitionPath}: output collides with a Markdown source or definition note.`);
    if (this.vault.entryKind(outputPath) === "folder") throw new Error(`${definitionPath}: output path is an existing folder.`);
    let data;
    try { data = normaliseLineChartData(definition, sourceRecords(this.vault, definition.source)); }
    catch (error) { throw new Error(`${definitionPath}: ${error instanceof Error ? error.message : String(error)}`); }
    const svg = renderLineChartSvg(data);
    await ensureParents(this.vault, outputPath);
    if (this.vault.entryKind(outputPath) === "file") await this.vault.modify(outputPath, svg);
    else await this.vault.create(outputPath, svg);
    return { definitionPath, outputPath, observations: data.points.length, svg };
  }
}
