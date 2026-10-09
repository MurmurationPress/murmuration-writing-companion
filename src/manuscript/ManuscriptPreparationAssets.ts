import { App, TFile, TFolder } from "obsidian";
import type { ManuscriptPreparationPlan } from "./ManuscriptPreparation";

export interface PreparationAssets {
  readonly from: string;
  readonly to: string;
  readonly inventory: readonly { path: string; mtime?: number; size?: number }[];
  readonly links: readonly { path: string; before: string; after: string; replacements: readonly { before: string; after: string }[] }[];
}

function inventory(app: App, folder: string) {
  return app.vault.getAllLoadedFiles().filter(file => file.path === folder || file.path.startsWith(`${folder}/`))
    .map(file => ({ path: file.path, ...(file instanceof TFile ? { mtime: file.stat.mtime, size: file.stat.size } : {}) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Vault.rename deliberately avoids Obsidian's unreviewed automatic link writes. */
export async function previewPreparationAssets(app: App, plan: ManuscriptPreparationPlan): Promise<PreparationAssets | undefined> {
  const folder = plan.selection?.folderPath;
  if (!folder) return;
  const from = `${folder}/Assets`, to = "Assets";
  if (!(app.vault.getAbstractFileByPath(from) instanceof TFolder)) return;
  if (app.vault.getAbstractFileByPath(to)) throw new Error("Vault-root Assets already exists. Merge assets and update links before preparing; preparation never overwrites a destination.");
  const sourceInventory = inventory(app, from);
  if (sourceInventory.some(item => item.path.endsWith(".md"))) throw new Error("Move Markdown notes out of the nested Assets folder before preparation.");
  const links: PreparationAssets["links"][number][] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache) throw new Error(`Wait for indexing before moving assets: ${file.path}`);
    const edits: { start: number; end: number; before: string; after: string }[] = [];
    for (const ref of cache.frontmatterLinks ?? []) {
      const target = app.metadataCache.getFirstLinkpathDest(ref.link.split("#")[0], file.path);
      if (target?.path.startsWith(`${from}/`)) throw new Error(`Asset reference in frontmatter must be updated before preparation: ${file.path}`);
    }
    for (const ref of [...(cache.links ?? []), ...(cache.embeds ?? [])]) {
      const target = app.metadataCache.getFirstLinkpathDest(ref.link.split("#")[0], file.path);
      if (!target?.path.startsWith(`${from}/`)) continue;
      const path = `${to}${target.path.slice(from.length)}`;
      let after: string;
      if (/^!?\[\[/.test(ref.original)) after = ref.original.replace(/(\[\[)[^|\]#]+/, `$1${path}`);
      else {
        const marker = ref.original.indexOf("](");
        if (marker < 0) throw new Error(`Unsupported asset link; update before preparation: ${file.path}`);
        const start = marker + 2, angle = ref.original[start] === "<";
        const rest = ref.original.slice(start + (angle ? 1 : 0));
        const destination = rest.match(angle ? /^[^>]+/ : /^[^\s)]+/)?.[0];
        if (!destination) throw new Error(`Cannot review asset link: ${file.path}`);
        const depth = file.path.split("/").length - 1;
        const replacement = "../".repeat(depth) + path.split("/").map(encodeURIComponent).join("/") + (destination.match(/#[\s\S]*$/)?.[0] ?? "");
        after = ref.original.slice(0, start + (angle ? 1 : 0)) + replacement + rest.slice(destination.length);
      }
      if (after === ref.original) continue;
      edits.push({ start: ref.position.start.offset, end: ref.position.end.offset, before: ref.original, after });
    }
    if (!edits.length) continue;
    const before = await app.vault.read(file);
    let after = before, boundary = before.length;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      if (edit.end > boundary || before.slice(edit.start, edit.end) !== edit.before) throw new Error(`Asset links differ from the index: ${file.path}`);
      after = after.slice(0, edit.start) + edit.after + after.slice(edit.end);
      boundary = edit.start;
    }
    links.push({ path: file.path, before, after, replacements: edits.map(({ before, after }) => ({ before, after })) });
  }
  // Canvas and other non-Markdown references are not covered by the reviewed link edits.
  for (const file of app.vault.getAllLoadedFiles()) {
    if (file instanceof TFile && file.extension === "canvas" && (await app.vault.read(file)).includes(from)) throw new Error(`Update Canvas asset references before preparation: ${file.path}`);
  }
  return { from, to, inventory: sourceInventory, links };
}

export function assertPreparationAssets(app: App, assets: PreparationAssets, moved = false) {
  const actual = inventory(app, moved ? assets.to : assets.from).map(item => ({ ...item, path: moved ? assets.from + item.path.slice(assets.to.length) : item.path }));
  if (app.vault.getAbstractFileByPath(moved ? assets.from : assets.to) || JSON.stringify(actual) !== JSON.stringify(assets.inventory)) throw new Error("Assets changed, moved or have a destination conflict; review again.");
}

export async function movePreparationAssets(app: App, assets: PreparationAssets, undo = false) {
  assertPreparationAssets(app, assets, undo);
  const source = app.vault.getAbstractFileByPath(undo ? assets.to : assets.from);
  if (!(source instanceof TFolder)) throw new Error("Assets folder missing.");
  await app.vault.rename(source, undo ? assets.from : assets.to);
  assertPreparationAssets(app, assets, !undo);
}
