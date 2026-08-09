import { App, Component, MarkdownRenderer, TFile } from "obsidian";
import { ParsedManuscriptChat, parseManuscriptChat } from "./ManuscriptChat";
import { manuscriptChatBodyMarkdown } from "./ManuscriptChatBody";

export async function renderManuscriptChat(
  container: HTMLElement,
  parsed: ParsedManuscriptChat,
  app?: App,
  sourcePath = "",
  component?: Component
): Promise<void> {
  container.classList.add("mwc-manuscript-chat");
  container.setAttribute("data-chat-syntax", parsed.syntax);
  if (parsed.syntax === "unrecognised") {
    const pre = container.createEl("pre", { cls: "mwc-manuscript-chat-source" });
    pre.createEl("code", { text: parsed.source });
    return;
  }
  for (const token of parsed.tokens) {
    if (token.type === "divider") { container.createEl("hr", { cls: "mwc-manuscript-chat-divider" }); continue; }
    if (token.type === "comment") { container.createEl("p", { cls: "mwc-manuscript-chat-comment", text: token.text }); continue; }
    if (token.type === "malformed") {
      const malformed = container.createEl("pre", { cls: "mwc-manuscript-chat-malformed", attr: { "aria-label": "Unparsed chat source" } });
      malformed.createEl("code", { text: token.source }); continue;
    }
    const message = container.createEl("article", {
      cls: `mwc-manuscript-chat-message mwc-manuscript-chat-${token.alignment}`,
      attr: { "aria-label": token.header ? `Message from ${token.header}` : "Interface message" }
    });
    if (token.header) message.createEl("div", { cls: "mwc-manuscript-chat-speaker", text: token.header });
    const body = message.createEl("div", { cls: "mwc-manuscript-chat-body" });
    if (app && component) {
      const markdown = manuscriptChatBodyMarkdown(token.body, (linkpath) => (
        app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath) instanceof TFile
      ));
      await MarkdownRenderer.render(app, markdown, body, sourcePath, component);
    } else body.setText(token.body);
    if (token.subtext) message.createEl("div", { cls: "mwc-manuscript-chat-subtext", text: token.subtext });
  }
}

export async function renderManuscriptChatSource(
  source: string,
  container: HTMLElement,
  app?: App,
  sourcePath = "",
  component?: Component
): Promise<ParsedManuscriptChat> {
  const parsed = parseManuscriptChat(source);
  await renderManuscriptChat(container, parsed, app, sourcePath, component);
  return parsed;
}
