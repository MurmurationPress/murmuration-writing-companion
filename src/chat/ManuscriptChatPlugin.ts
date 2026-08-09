import { MarkdownRenderChild, Plugin } from "obsidian";
import { renderManuscriptChatSource } from "./ManuscriptChatRendering";

export function installManuscriptChatRendering(plugin: Plugin): void {
  for (const language of ["chat", "chat-old", "chat-old-old"]) {
    plugin.registerMarkdownCodeBlockProcessor(language, async (source, el, context) => {
      const child = new MarkdownRenderChild(el);
      context.addChild(child);
      await renderManuscriptChatSource(source, el, plugin.app, context.sourcePath, child);
    });
  }
}
