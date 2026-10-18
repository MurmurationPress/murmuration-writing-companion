import { Modal, Notice, TFile } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import type { StoryWorldBuilderItem } from "../story-world/WorldBuilder";
import { isPovEligible, parseWikilink } from "../story-world/StoryWorldIndex";
import { changeCharacterPov } from "../story-world/CharacterPov";
import { povProfileMarkdownBody, povProfileResolutionIssueMessage, resolvePovProfileChain } from "../story-world/PovProfile";
import { StoryWorldEntityCreationModal } from "./StoryWorldEntityCreationModal";

export function renderCharacterPovWorkspace(container: Element, plugin: MurmurationWritingCompanionPlugin, file: TFile, item: StoryWorldBuilderItem): void {
  const index = plugin.storyWorldIndex;
  const record = index.index.getByPath(file.path);
  if (!record) return;
  const link = (path: string) => `[[${path.replace(/\.md$/i, "")}]]`;
  const open = (path: string) => {
    const target = plugin.app.vault.getAbstractFileByPath(path);
    if (target instanceof TFile) void plugin.app.workspace.getLeaf(false).openFile(target, { active: true });
    else new Notice("This note is no longer available.");
  };
  const section = container.createDiv("mwc-story-world-inspector-section mwc-character-pov");
  const button = (parent: Element, text: string, action: () => void) => {
    const control = parent.createEl("button", { text, attr: { type: "button" } });
    control.onclick = action;
    return control;
  };
  if (item.type === "pov-profile") {
    section.createEl("h3", { text: "Profile connections" });
    const parent = index.resolveWikilink(item.properties.pov_extends, file.path);
    if (parent) button(section, `Base profile: ${parent.name}`, () => open(parent.path));
    for (const candidate of index.index.getAll()) {
      if (index.resolveWikilink(candidate.properties.pov_profile, candidate.path)?.path === file.path) {
        button(section, `Character: ${candidate.name}`, () => open(candidate.path));
      }
      if (index.resolveWikilink(candidate.properties.pov_extends, candidate.path)?.path === file.path) {
        button(section, `Extension: ${candidate.name}`, () => open(candidate.path));
      }
    }
    return;
  }
  if (item.type !== "character" && !isPovEligible(record)) { section.remove(); return; }
  section.createEl("h3", { text: "POV Profile" });
  section.createEl("p", { cls: "mwc-muted", text: "Optional authorial guidance about how this character is presented to the reader. Character facts belong in the character note." });
  const expected = item.properties.pov_profile;
  const associated = index.resolveWikilink(expected, file.path);
  const valid = associated?.entityType.trim().toLowerCase() === "pov-profile" ? associated : null;
  section.createEl("p", { text: valid ? `Associated profile: ${valid.name}` : expected ? `Unavailable profile: ${String(expected)}. You can replace or remove this link.` : "No profile yet. Develop your character first; add guidance whenever useful." });
  if (valid) button(section, "Open associated profile", () => open(valid.path));
  const select = section.createEl("select", { attr: { "aria-label": "POV Profile" } });
  select.createEl("option", { text: "Choose a profile…", value: "" });
  for (const profile of index.index.getAll().filter((entity) => entity.entityType.trim().toLowerCase() === "pov-profile")) {
    select.createEl("option", { text: `${profile.name} — ${profile.path}`, value: profile.path });
  }
  select.value = valid?.path ?? "";
  const feedback = section.createEl("p", { attr: { role: "status", "aria-live": "polite" } });
  const update = async (path: string | null) => {
    try {
      if (plugin.app.vault.getAbstractFileByPath(file.path) !== file) throw new Error("The character moved or was deleted. Reopen it before changing its profile.");
      const target = path ? index.index.getByPath(path) : null;
      if (path && (!target || !(plugin.app.vault.getAbstractFileByPath(path) instanceof TFile))) throw new Error("The selected profile is no longer available. Choose another profile.");
      await plugin.app.fileManager.processFrontMatter(file, (properties) => {
        if (path && plugin.app.vault.getAbstractFileByPath(path) === null) throw new Error("The selected profile was deleted. Choose another profile.");
        if (properties.world_entity !== item.properties.world_entity) throw new Error("The character type changed elsewhere. Reopen it and try again.");
        changeCharacterPov(properties, expected, target);
      });
      feedback.setText("POV association saved.");
      return true;
    } catch (error) { feedback.setText(error instanceof Error ? error.message : String(error)); new Notice(feedback.textContent ?? "Could not save association."); return false; }
  };
  button(section, "Associate selected profile", () => { if (select.value) void update(select.value); });
  if (expected !== undefined) button(section, "Remove association", () => void update(null));
  const creation = (bookPath?: string) => {
    const base = valid;
    new StoryWorldEntityCreationModal(plugin, {
      initialKind: "pov-profile",
      fixedKind: true,
      initialName: `${item.name} POV${bookPath ? ` — ${plugin.app.vault.getAbstractFileByPath(bookPath)?.name.replace(/\.md$/i, "")}` : ""}`,
      initialScope: bookPath ? link(bookPath) : "",
      initialPovProfileTemplate: bookPath ? "scoped" : "base",
      initialTypedProperties: bookPath && base ? { pov_extends: link(base.path) } : {},
      onCreated: (created) => {
        // Keep the origin captured across navigation; association is always explicit.
        const confirmation = new Modal(plugin.app);
        confirmation.titleEl.setText(bookPath ? "Book extension created" : `Profile created for ${item.name}`);
        confirmation.contentEl.createEl("p", { text: bookPath ? "The extension applies through its Book scope. The base association is unchanged." : "Associate this profile with the originating character? This changes only the character’s optional profile link." });
        if (!bookPath) button(confirmation.contentEl, "Confirm association and return to character", () => {
          void update(created.path).then((saved) => { if (saved) { confirmation.close(); open(file.path); } });
        });
        button(confirmation.contentEl, "Return without changing association", () => { confirmation.close(); open(file.path); });
        confirmation.open();
      }
    }).open();
  };
  button(section, "Create a profile for this character", () => creation());
  if (!valid) return;
  const details = section.createEl("details");
  details.createEl("summary", { text: "Develop POV for a Book" });
  details.createEl("p", { text: "The base guidance is inherited first. Book extensions add only the differences for the selected Book; editing an extension leaves its base unchanged." });
  const books = details.createEl("select", { attr: { "aria-label": "POV guidance Book" } });
  books.createEl("option", { text: "Base guidance only", value: "" });
  for (const book of plugin.manuscriptProjection.get().books) books.createEl("option", { text: book.file.basename, value: book.file.path });
  books.value = plugin.manuscriptBookSelection.get().bookPath ?? "";
  const guidance = details.createDiv();
  const render = () => {
    guidance.empty();
    const chain = resolvePovProfileChain({ pov: link(file.path) }, file.path, (reference, source) => index.resolveWikilink(reference, source), {
      activeBookPath: books.value || null,
      indexedEntities: index.index.getAll(),
      resolveScope: (reference, source) => { const parsed = parseWikilink(reference); return parsed ? plugin.app.metadataCache.getFirstLinkpathDest(parsed.linkpath, source)?.path ?? null : null; }
    });
    const issue = povProfileResolutionIssueMessage(chain.issues);
    if (issue) guidance.createEl("p", { text: issue });
    for (const profile of chain.profiles) {
      const row = guidance.createEl("details");
      row.createEl("summary", { text: `${profile.name} · ${chain.profiles.indexOf(profile) > chain.profiles.findIndex((entry) => entry.path === valid.path) ? "Book-specific guidance" : "Inherited base guidance"}` });
      button(row, "Edit this profile’s guidance", () => open(profile.path));
      const body = row.createEl("p", { cls: "mwc-story-world-inspector-prose" });
      const target = plugin.app.vault.getAbstractFileByPath(profile.path);
      if (target instanceof TFile) void plugin.app.vault.cachedRead(target).then((markdown) => body.setText(povProfileMarkdownBody(markdown))).catch(() => body.setText("Guidance could not be read. Reopen the profile to retry."));
    }
    if (books.value && chain.profiles[chain.profiles.length - 1]?.path === valid.path && !chain.issues.length) button(guidance, "Create extension for this Book", () => creation(books.value));
  };
  books.onchange = render;
  render();
}
