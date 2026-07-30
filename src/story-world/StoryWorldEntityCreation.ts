import { safeReferenceExternalUrl } from "./StoryWorldReference";

export const STORY_WORLD_ENTITY_KINDS = [
  "character",
  "event",
  "location",
  "organisation",
  "technology",
  "concept",
  "reference",
  "other"
] as const;

export type StoryWorldEntityKind = typeof STORY_WORLD_ENTITY_KINDS[number];

export interface StoryWorldEntityCreationInput {
  readonly kind: StoryWorldEntityKind;
  readonly customKind?: string;
  readonly name: string;
  readonly scope?: string;
  readonly reference?: StoryWorldReferenceCreationMetadata;
}

export interface StoryWorldReferenceCreationMetadata {
  readonly category?: string;
  readonly title?: string;
  readonly journal?: string;
  readonly authors?: readonly string[];
  readonly date?: string;
  readonly key?: string;
  readonly link?: string;
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
  concept: "Concepts",
  reference: "References"
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
  if (entityType === "reference") {
    const metadata = input.reference;
    const category = metadata?.category?.trim();
    const title = metadata?.title?.trim();
    const journal = metadata?.journal?.trim();
    const authors = metadata?.authors?.map((author) => author.trim()).filter(Boolean) ?? [];
    const date = metadata?.date?.trim();
    const key = metadata?.key?.trim();
    const link = metadata?.link?.trim();
    if (link && !safeReferenceExternalUrl(link)) throw new Error("Reference Link must be an HTTP or HTTPS URL.");
    if (category) lines.push(`reference_category: ${yamlString(category)}`);
    if (title) lines.push(`reference_title: ${yamlString(title)}`);
    if (journal) lines.push(`reference_journal: ${yamlString(journal)}`);
    if (authors.length) lines.push("reference_authors:", ...authors.map((author) => `  - ${yamlString(author)}`));
    if (date) lines.push(`reference_date: ${yamlString(date)}`);
    if (key) lines.push(`reference_key: ${yamlString(key)}`);
    if (link) lines.push(`link: ${yamlString(link)}`);
  }
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

export function findStoryWorldPathCollision(
  plan: StoryWorldEntityCreationPlan,
  paths: readonly string[]
): string | null {
  const targetPath = plan.path.toLocaleLowerCase();
  return paths.some((path) => path.toLocaleLowerCase() === targetPath)
    ? `A file already exists at ${plan.path}.`
    : null;
}

export interface StoryWorldEntityCreationWriter<T> {
  readonly revalidate: () => string | null;
  readonly create: (path: string, markdown: string) => Promise<T>;
  readonly read: (created: T) => Promise<string>;
  readonly rollback: (created: T) => Promise<void>;
}

/** Executes only a confirmed plan, rechecking stale state and rolling back unverifiable writes. */
export async function executeStoryWorldEntityCreation<T>(
  plan: StoryWorldEntityCreationPlan,
  writer: StoryWorldEntityCreationWriter<T>
): Promise<T> {
  const stale = writer.revalidate();
  if (stale) throw new Error(stale);
  let created: T | null = null;
  try {
    created = await writer.create(plan.path, plan.markdown);
    if (await writer.read(created) !== plan.markdown) throw new Error("The created note could not be verified.");
    return created;
  } catch (error) {
    if (created) {
      try { await writer.rollback(created); } catch { /* Preserve the authoritative creation failure. */ }
    }
    throw error;
  }
}
