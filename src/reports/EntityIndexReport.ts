import type { StoryWorldEntityRecord } from "../story-world/StoryWorldIndex";
import { GENERATED_REPORT_TYPE } from "./GeneratedReportClassification";

export const ENTITY_INDEX_REPORT_TYPE = "entity-index";

export interface EntityIndexScene {
  readonly path: string;
  readonly title: string;
  readonly partTitle: string | null;
  readonly bookTitle: string;
  readonly order: number;
}

export interface EntityIndexOccurrence {
  readonly entityPath: string;
  readonly scene: EntityIndexScene;
}

export interface EntityIndexDiagnostics {
  readonly orphanEntities: number;
  readonly unresolvedLinks: number;
  readonly malformedLinks: number;
  readonly ambiguousAliases: number;
  readonly missingCanonicalEntities: number;
  readonly duplicateSceneTitles: number;
}

export interface EntityIndexReportInput {
  readonly scope: "book" | "vault";
  readonly book?: { path: string; title: string };
  readonly entities: readonly StoryWorldEntityRecord[];
  readonly occurrences: readonly EntityIndexOccurrence[];
  readonly includedTypes: ReadonlySet<string>;
  readonly generatedAt: string;
  readonly diagnostics?: Partial<Omit<EntityIndexDiagnostics, "orphanEntities" | "duplicateSceneTitles">>;
}

export interface EntityIndexReportDraft {
  readonly filename: string;
  readonly markdown: string;
  readonly entryCount: number;
  readonly occurrenceCount: number;
  readonly diagnostics: EntityIndexDiagnostics;
}

export function normalizeEntityType(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function entityIndexFilename(scopeLabel: string): string {
  const safe = scopeLabel.normalize("NFC").replace(/[\\/:*?"<>|#[\]^]/g, "-")
    .replace(/\s+/g, " ").replace(/-+/g, "-").trim() || "Book";
  return `Entity Index - ${safe}.md`;
}

function target(path: string): string { return path.replace(/\.md$/i, ""); }
function escaped(value: string): string { return value.replace(/\|/g, "\\|"); }
function link(path: string, label: string): string { return `[[${target(path)}|${escaped(label)}]]`; }
function sortName(value: string): string { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase(); }
function groupFor(value: string): string {
  const first = sortName(value).charAt(0).toLocaleUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

export function generateEntityIndexReport(input: EntityIndexReportInput): EntityIndexReportDraft {
  const eligible = input.entities.filter((entity) => input.includedTypes.has(normalizeEntityType(entity.entityType)));
  const byPath = new Map(eligible.map((entity) => [entity.path, entity]));
  const scenesByEntity = new Map<string, Map<string, EntityIndexScene>>();
  let missingCanonicalEntities = input.diagnostics?.missingCanonicalEntities ?? 0;
  for (const occurrence of input.occurrences) {
    if (!byPath.has(occurrence.entityPath)) {
      if (!input.entities.some((entity) => entity.path === occurrence.entityPath)) missingCanonicalEntities += 1;
      continue;
    }
    const scenes = scenesByEntity.get(occurrence.entityPath) ?? new Map<string, EntityIndexScene>();
    scenes.set(occurrence.scene.path, occurrence.scene);
    scenesByEntity.set(occurrence.entityPath, scenes);
  }
  const entries = eligible.filter((entity) => scenesByEntity.has(entity.path)).sort((left, right) => (
    sortName(left.name).localeCompare(sortName(right.name), "en", { numeric: true }) || left.path.localeCompare(right.path)
  ));
  const duplicateTitles = new Set<string>();
  const titlePaths = new Map<string, Set<string>>();
  for (const scenes of scenesByEntity.values()) for (const scene of scenes.values()) {
    const paths = titlePaths.get(scene.title) ?? new Set<string>(); paths.add(scene.path); titlePaths.set(scene.title, paths);
  }
  for (const [title, paths] of titlePaths) if (paths.size > 1) duplicateTitles.add(title);
  const lines = [
    "---", `type: ${GENERATED_REPORT_TYPE}`, `report_type: ${ENTITY_INDEX_REPORT_TYPE}`,
    `report_scope: ${input.scope}`,
    ...(input.scope === "book" && input.book ? [`book: "[[${target(input.book.path)}|${escaped(input.book.title)}]]"`] : []),
    `generated_at: ${input.generatedAt}`, "---", ""
  ];
  let currentGroup = "";
  let occurrenceCount = 0;
  for (const entity of entries) {
    const group = groupFor(entity.name);
    if (group !== currentGroup) { lines.push(`## ${group}`, ""); currentGroup = group; }
    const scenes = [...(scenesByEntity.get(entity.path)?.values() ?? [])].sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
    occurrenceCount += scenes.length;
    const references = scenes.map((scene) => {
      const needsPart = Boolean(scene.partTitle) || duplicateTitles.has(scene.title);
      const directDisambiguator = scene.path.split("/").pop()?.replace(/\.md$/i, "") ?? scene.path;
      const sceneLabel = needsPart
        ? scene.partTitle ? `${scene.partTitle} — ${scene.title}` : `${scene.title} — ${directDisambiguator}`
        : scene.title;
      const label = input.scope === "vault" ? `${scene.bookTitle} — ${sceneLabel}` : sceneLabel;
      return link(scene.path, label);
    });
    lines.push(`**${link(entity.path, entity.name)}** — ${references.join("; ")}`, "");
  }
  if (!entries.length) lines.push(`No indexed entities occur in this ${input.scope === "vault" ? "vault" : "Book"} for the selected categories.`, "");
  const diagnostics: EntityIndexDiagnostics = {
    orphanEntities: eligible.length - entries.length,
    unresolvedLinks: input.diagnostics?.unresolvedLinks ?? 0,
    malformedLinks: input.diagnostics?.malformedLinks ?? 0,
    ambiguousAliases: input.diagnostics?.ambiguousAliases ?? 0,
    missingCanonicalEntities,
    duplicateSceneTitles: duplicateTitles.size
  };
  lines.push("## Diagnostics", "", `- Entities omitted without an occurrence: ${diagnostics.orphanEntities}`,
    `- Unresolved entity links: ${diagnostics.unresolvedLinks}`, `- Malformed authoritative links: ${diagnostics.malformedLinks}`,
    `- Ambiguous aliases or collisions: ${diagnostics.ambiguousAliases}`, `- Occurrences with missing canonical entities: ${diagnostics.missingCanonicalEntities}`,
    `- Duplicate Scene titles requiring disambiguation: ${diagnostics.duplicateSceneTitles}`, "",
    "---", "", "This disposable report is derived from explicit manuscript evidence. Story World and manuscript Markdown remain authoritative; plain-text mentions are not indexed.", "");
  return { filename: entityIndexFilename(input.scope === "vault" ? "Vault" : input.book?.title ?? "Book"), markdown: lines.join("\n"), entryCount: entries.length, occurrenceCount, diagnostics };
}
