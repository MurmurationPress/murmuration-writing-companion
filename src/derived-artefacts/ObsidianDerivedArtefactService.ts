import { App, normalizePath, TFile } from "obsidian";
import { DerivedArtefactService } from "./DerivedArtefactService";

export function createObsidianDerivedArtefactService(app: App): DerivedArtefactService {
  return new DerivedArtefactService({
    markdownDocuments: () => app.vault.getMarkdownFiles().map((file) => ({
      path: file.path,
      frontmatter: app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined
    })),
    entryKind: (path) => {
      const entry = app.vault.getAbstractFileByPath(normalizePath(path));
      return entry ? entry instanceof TFile ? "file" : "folder" : null;
    },
    createFolder: async (path) => { await app.vault.createFolder(normalizePath(path)); },
    create: async (path, content) => { await app.vault.create(normalizePath(path), content); },
    modify: async (path, content) => {
      const file = app.vault.getAbstractFileByPath(normalizePath(path));
      if (!(file instanceof TFile)) throw new Error(`${path} is no longer a file.`);
      await app.vault.modify(file, content);
    },
    read: async (path) => {
      const file = app.vault.getAbstractFileByPath(normalizePath(path));
      if (!(file instanceof TFile)) throw new Error(`${path} is no longer a file.`);
      return app.vault.cachedRead(file);
    }
  });
}
