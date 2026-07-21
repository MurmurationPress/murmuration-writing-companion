export const STORY_WORLD_ENTITY_KINDS = [
  "character",
  "event",
  "location",
  "organisation",
  "technology",
  "concept",
  "other"
] as const;

export type StoryWorldEntityKind = typeof STORY_WORLD_ENTITY_KINDS[number];

export interface StoryWorldEntityCreationInput {
  readonly kind: StoryWorldEntityKind;
  readonly customKind?: string;
  readonly name: string;
  readonly scope?: string;
}

export interface StoryWorldEntityCreationPlan {
  readonly entityType: string;
  readonly name: string;
  readonly scope: string | null;
  readonly folder: string;
  readonly path: string;
  readonly markdown: string;
}

const FOLDERS: Record<Exclude<StoryWorldEntityKind, "other">, string> = {
  character: "Characters",
  event: "Events",
  location: "Locations",
  organisation: "Organisations",
  technology: "Technologies",
  concept: "Concepts"
};

export function safeStoryWorldFilename(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").replace(/[. ]+$/g, "");
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function planStoryWorldEntityCreation(input: StoryWorldEntityCreationInput): StoryWorldEntityCreationPlan {
  const name = input.name.trim();
  if (!name) throw new Error("Canonical name is required.");
  const customKind = input.customKind?.trim().toLowerCase() ?? "";
  const entityType = input.kind === "other" ? customKind : input.kind;
  if (!entityType) throw new Error("An entity kind is required.");
  if (!/^[a-z][a-z0-9-]*$/.test(entityType)) throw new Error("Custom kinds must use lower-case letters, numbers and hyphens.");
  const filename = safeStoryWorldFilename(name);
  if (!filename) throw new Error("The canonical name does not produce a valid filename.");
  const folder = input.kind === "other" ? "Other" : FOLDERS[input.kind];
  const path = `Story World/${folder}/${filename}.md`;
  const scope = input.scope?.trim() || null;
  const lines = ["---", `world_entity: ${entityType}`, `world_name: ${yamlString(name)}`];
  if (scope) lines.push(`world_scope:`, `  - ${yamlString(scope)}`);
  lines.push("---", "", `# ${name}`, "");
  return { entityType, name, scope, folder, path, markdown: lines.join("\n") };
}

export function findStoryWorldCreationCollision(
  plan: StoryWorldEntityCreationPlan,
  documents: readonly { path: string; name: string; aliases: readonly string[] }[]
): string | null {
  const target = plan.name.toLocaleLowerCase();
  const targetPath = plan.path.toLocaleLowerCase();
  for (const document of documents) {
    if (document.path.toLocaleLowerCase() === targetPath) return `A file already exists at ${plan.path}.`;
    if (document.name.toLocaleLowerCase() === target) return `An entity already uses the canonical name ${plan.name}.`;
    if (document.aliases.some((alias) => alias.toLocaleLowerCase() === target)) return `${plan.name} is already used as an alias.`;
  }
  return null;
}
