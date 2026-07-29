import { App, PluginSettingTab, Setting } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { AboutMurmurationPressModal } from "../about/AboutMurmurationPressModal";
import { ABOUT_SETTINGS_ENTRY } from "../about/AboutMurmurationPress";

export class ContinuitySettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: MurmurationWritingCompanionPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "Murmuration Writing Companion" });
    new Setting(this.containerEl)
      .setName("Show diagnostic information")
      .setDesc("Show support and debugging details in Continuity Review. Editorial evidence remains visible when this is off.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.continuityDiagnosticPreference.get())
        .onChange((value) => {
          this.plugin.continuityDiagnosticPreference.set(value);
          this.plugin.refreshView();
        }));
    new Setting(this.containerEl)
      .setName(ABOUT_SETTINGS_ENTRY.name)
      .setDesc(ABOUT_SETTINGS_ENTRY.description)
      .addButton((button) => {
        button
          .setButtonText(ABOUT_SETTINGS_ENTRY.buttonLabel)
          .setTooltip(ABOUT_SETTINGS_ENTRY.accessibleLabel)
          .onClick(() => new AboutMurmurationPressModal(this.plugin).open());
        button.buttonEl.setAttribute("aria-label", ABOUT_SETTINGS_ENTRY.accessibleLabel);
      });
  }
}
