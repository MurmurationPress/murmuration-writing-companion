import { normalizePath, type App } from "obsidian";
import type { PortableEditorialFileSystem } from "./PortableEditorialStorage";

export class ObsidianEditorialFileSystem
  implements PortableEditorialFileSystem {
  constructor(private readonly app: App) {}

  async exists(path: string): Promise<boolean> {
    return this.app.vault.adapter.exists(normalizePath(path));
  }

  async read(path: string): Promise<string> {
    return this.app.vault.adapter.read(normalizePath(path));
  }

  async write(path: string, content: string): Promise<void> {
    await this.app.vault.adapter.write(normalizePath(path), content);
  }

  async rename(sourcePath: string, targetPath: string): Promise<void> {
    await this.app.vault.adapter.rename(
      normalizePath(sourcePath),
      normalizePath(targetPath)
    );
  }

  async remove(path: string): Promise<void> {
    await this.app.vault.adapter.remove(normalizePath(path));
  }

  async mkdir(path: string): Promise<void> {
    await this.app.vault.adapter.mkdir(normalizePath(path));
  }
}
