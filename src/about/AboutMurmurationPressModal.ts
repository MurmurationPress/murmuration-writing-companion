import { Modal, Setting } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import {
  aboutPresentation,
  openAboutExternalLink
} from "./AboutMurmurationPress";

export class AboutMurmurationPressModal extends Modal {
  constructor(private readonly plugin: MurmurationWritingCompanionPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    const presentation = aboutPresentation(this.plugin.manifest.version);
    this.titleEl.setText("About Murmuration Writing Companion");
    const content = this.contentEl.createDiv("mwc-about");
    content.createEl("h2", { text: presentation.name });
    content.createEl("p", { cls: "mwc-muted", text: `Version ${presentation.version}` });
    content.createEl("p", { text: presentation.description });
    content.createEl("p", { text: presentation.relationship });
    content.createEl("p", { text: presentation.support });

    const links = content.createDiv("mwc-about-links");
    for (const link of presentation.links) {
      new Setting(links)
        .setName(link.label)
        .addButton((button) => {
          button
            .setButtonText(link.prominent ? "Purchase" : "Open")
            .setTooltip(link.accessibleLabel)
            .onClick(() => openAboutExternalLink(
              link.url,
              (url, target, features) => window.open(url, target, features)
            ));
          button.buttonEl.setAttribute("aria-label", link.accessibleLabel);
          if (link.prominent) button.setCta();
        });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
