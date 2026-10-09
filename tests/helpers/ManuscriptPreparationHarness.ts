import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const runtimeRequire = createRequire(`${process.cwd()}/package.json`);
const { buildSync } = runtimeRequire("esbuild") as typeof import("esbuild");

export class Element {
  style: Record<string, unknown> = {};
  children: Element[] = [];
  text = "";
  tag = "";
  attr: Record<string, string> = {};
  checked = false;
  disabled = false;
  onclick?: () => void;
  onchange?: () => void;
  createEl(tag: string, options: { text?: string; attr?: Record<string, string>; cls?: string } = {}): Element {
    const child = new Element(); child.tag = tag; child.text = options.text ?? ""; child.attr = options.attr ?? {};
    this.children.push(child); return child;
  }
  createDiv(options = {}): Element { return this.createEl("div", options); }
  createSpan(options = {}): Element { return this.createEl("span", options); }
  setText(text: string) { this.text = text; }
  empty() { this.children = []; }
  focus() {}
  all(): Element[] { return [this, ...this.children.flatMap(child => child.all())]; }
  textContent(): string { return this.all().map(el => el.text).join("\n"); }
  button(text: string): Element { const button = this.all().find(el => el.tag === "button" && el.text === text); if (!button) throw new Error(`Missing button: ${text}`); return button; }
}
export class Folder {
  path: string; name: string; parent: Folder | null = null;
  constructor(path: string) { this.path = path; this.name = path.split("/").pop()!; }
}
export class File {
  path: string; basename: string; extension = "md";
  stat = { mtime: 1, size: 0 };
  constructor(path: string, readonly parent: Folder) { this.path = path; this.basename = path.split("/").pop()!.replace(/\.md$/, ""); }
}
export interface TestModal { contentEl: Element; titleEl: Element; close(): void; onChooseSuggestion?(file: File | Folder): void; selectSuggestion?(file: File | Folder, event: unknown): void; }

// The real Obsidian root is '/', and getAbstractFileByPath performs an exact
// fileMap lookup. An empty-root or normalising fake would hide issue #261.
export function preparationHarness(typed = true, rootPath = "/") {
  const fixture = JSON.parse(readFileSync("tests/fixtures/aikido-manuscript.json", "utf8")) as { root: string; notes: Array<{ path: string; frontmatter: Record<string, unknown> }> };
  const loaded = new Map<string, File | Folder>();
  const contents = new Map<string, string>();
  const cache = new Map<string, { frontmatter?: Record<string, unknown> }>();
  const modals: TestModal[] = [];
  const notices: string[] = [];
  const root = new Folder(rootPath); loaded.set(rootPath, root);
  const folder = (path: string): Folder => {
    if (!path) return root;
    const existing = loaded.get(path); if (existing instanceof Folder) return existing;
    const f = new Folder(path); f.parent = folder(path.split("/").slice(0, -1).join("/")); loaded.set(path, f); return f;
  };
  const add = (path: string, fm: Record<string, unknown> = {}, body = `\nOriginal fixture prose for ${path}.\n![[Assets/figure.png]]\n`) => {
    const f = new File(path, folder(path.split("/").slice(0, -1).join("/")));
    loaded.set(path, f); const content = `---\n${JSON.stringify(fm)}\n---\n${body}`;
    contents.set(path, content); cache.set(path, { frontmatter: structuredClone(fm) }); f.stat.size = content.length; return f;
  };
  for (const note of fixture.notes) { const fm = { ...note.frontmatter }; if (!typed) delete fm.type; add(note.path, fm); }
  folder("The-Structure-of-Aikido/Assets");
  contents.set("The-Structure-of-Aikido/Assets/figure.png", "original asset bytes");
  const parseYaml = (text: string): Record<string, unknown> => {
    if (text.trim().startsWith("{")) return JSON.parse(text);
    const fm: Record<string, unknown> = {};
    for (const line of text.split("\n").filter(line => line.trim() && !line.startsWith("#"))) {
      const colon = line.indexOf(":"); if (colon < 0) throw new Error("Invalid YAML");
      const value = line.slice(colon + 1).trim();
      try { fm[line.slice(0, colon)] = JSON.parse(value || "null"); } catch { fm[line.slice(0, colon)] = value; }
    }
    return fm;
  };
  let writes = 0; let failWrite = -1;
  const commands = new Map<string, { callback: () => Promise<void> | void }>();
  const app = {
    vault: {
      getMarkdownFiles: () => [...loaded.values()].filter((file): file is File => file instanceof File),
      getAllLoadedFiles: () => [...loaded.values()],
      getAbstractFileByPath: (path: string) => loaded.get(path) ?? null,
      read: async (file: File) => contents.get(file.path)!,
      modify: async (file: File, content: string) => { writes++; contents.set(file.path, content); file.stat.mtime++; file.stat.size = content.length; cache.set(file.path, { frontmatter: content.startsWith("---") ? parseYaml(content.split("---")[1]) : {} }); }
    },
    metadataCache: {
      getFileCache: (file: File) => cache.get(file.path),
      getFirstLinkpathDest: (link: string) => [...loaded.values()].find(file => file instanceof File && (file.path.replace(/\.md$/, "") === link || file.basename === link)) ?? null
    },
    fileManager: { processFrontMatter: async (file: File, change: (fm: Record<string, unknown>) => void) => {
      if (writes + 1 === failWrite) { failWrite = -1; throw new Error("Injected write failure"); }
      const content = contents.get(file.path)!; const fm = content.startsWith("---") ? parseYaml(content.split("---")[1]) : {}; change(fm);
      const body = content.replace(/^---\s*\n[\s\S]*?\n---\n/, "");
      await app.vault.modify(file, `---\n${JSON.stringify(fm)}\n---\n${body}`);
    } },
    workspace: { getLeavesOfType: () => [], on: () => null, onLayoutReady: () => null }
  };
  class Modal {
    contentEl = new Element(); titleEl = new Element();
    constructor(readonly app: unknown) {}
    onOpen() {} onClose() {}
    open() { modals.push(this); this.onOpen(); }
    close() { modals.splice(modals.indexOf(this), 1); this.onClose(); }
  }
  class SuggestModal extends Modal {
    setPlaceholder(_text: string) {}
    onChooseSuggestion(_file: File | Folder) {}
    selectSuggestion(file: File | Folder, _event: unknown) { this.close(); this.onChooseSuggestion(file); }
  }
  const obsidian = { TFile: File, TFolder: Folder, Modal, SuggestModal, Notice: class { constructor(text: string) { notices.push(text); } }, parseYaml };
  const code = buildSync({ stdin: { contents: `export * from "./src/manuscript/ManuscriptPreparationCommands"; export * from "./src/manuscript/ManuscriptPreparationSelection"; export * from "./src/manuscript/ObsidianManuscriptPreparation"; export * from "./src/manuscript/ObsidianManuscript";`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", external: ["obsidian"], write: false }).outputFiles[0].text;
  const module = { exports: {} }; const require = createRequire(`${process.cwd()}/package.json`);
  new Function("require", "module", "exports", code)((name: string) => name === "obsidian" ? obsidian : require(name), module, module.exports);
  // Dynamic bundle boundary deliberately executes the production modules with
  // a shared Obsidian API, rather than reimplementing preparation in the test.
  const api = module.exports as any;
  const host = { app, getCurrentChapter: () => loaded.get(fixture.root), addCommand: (command: { id: string; callback: () => Promise<void> | void }) => commands.set(command.id, command), registerEvent() {}, register() {}, refreshManuscriptNavigator() {} };
  (globalThis as any).window = { setTimeout: () => 0 };
  api.installManuscriptPreparationCommands(host);
  const invoke = (id = "prepare-existing-manuscript") => commands.get(id)!.callback();
  const tick = () => new Promise<void>(resolve => setImmediate(resolve));
  const latest = () => modals[modals.length - 1];
  const choose = async (path = fixture.root) => { latest().selectSuggestion!(loaded.get(path)!, {}); await tick(); };
  const click = async (text: string) => { const button = latest().contentEl.button(text); if (button.disabled) throw new Error(`Disabled: ${text}`); button.onclick!(); await tick(); };
  return { api, app, fixture, loaded, contents, cache, modals, notices, add, invoke, choose, click, tick, latest, writes: () => writes, failAt: (number: number) => { failWrite = number; } };
}
