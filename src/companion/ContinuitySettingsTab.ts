import { App, PluginSettingTab, Setting } from "obsidian";
import type MurmurationWritingCompanionPlugin from "../main";
import { AboutMurmurationPressModal } from "../about/AboutMurmurationPressModal";
import { ABOUT_SETTINGS_ENTRY } from "../about/AboutMurmurationPress";
import { HELP_SETTINGS_ENTRY, invokeHelpSettingsAction } from "../help/Help";
import type { VaultBackupInspection } from "../backup/VaultBackupService";
import { vaultBackupRemoteOptions } from "../backup/VaultBackupRemotePreference";

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
      .setName("Project readiness")
      .setDesc("Reinspect this vault and show recognised manuscript, optional Story World, and editorial information. This check does not modify notes.")
      .addButton((button) => button.setButtonText("Open project readiness").onClick(() => this.plugin.openProjectReadiness()));
    this.addVaultBackupSettings();
    new Setting(this.containerEl)
      .setName(HELP_SETTINGS_ENTRY.name)
      .setDesc(HELP_SETTINGS_ENTRY.description)
      .addButton((button) => {
        button
          .setButtonText(HELP_SETTINGS_ENTRY.buttonLabel)
          .setTooltip(HELP_SETTINGS_ENTRY.accessibleLabel)
          .onClick(() => invokeHelpSettingsAction(() => this.plugin.openHelp()));
        button.buttonEl.setAttribute("aria-label", HELP_SETTINGS_ENTRY.accessibleLabel);
      });
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

  private addVaultBackupSettings(): void {
    this.containerEl.createEl("h3", { text: "Vault backup" });
    const repository = new Setting(this.containerEl).setName("Repository").setDesc("Detecting…");
    const branch = new Setting(this.containerEl).setName("Branch").setDesc("Detecting…");
    const remote = new Setting(this.containerEl).setName("Remote").setDesc("Detecting…");
    const remoteUrl = new Setting(this.containerEl).setName("Remote URL").setDesc("Detecting…");
    new Setting(this.containerEl)
      .setName("Check backup configuration")
      .setDesc("Fetch the detected remote deliberately and verify that backup is safe to run.")
      .addButton((button) => button.setButtonText("Check backup configuration").onClick(() => this.plugin.checkVaultBackup()));

    void this.plugin.inspectVaultBackup().then((inspection) => {
      repository.setDesc(inspection.vaultPath ?? "Unavailable");
      if (inspection.kind === "ready") {
        branch.setDesc(inspection.branch);
        remote.setDesc(inspection.remoteSelection === "explicit_override"
          ? `${inspection.remote} (selected)`
          : `${inspection.remote} (automatic)`);
        remoteUrl.setDesc(inspection.remoteUrl);
      } else {
        const label = backupInspectionLabel(inspection);
        branch.setDesc(label);
        remote.setDesc(label);
        remoteUrl.setDesc(label);
      }

      const options = vaultBackupRemoteOptions(inspection.remotes ?? []);
      if (options.length > 0) {
        remote.addDropdown((dropdown) => {
          dropdown.addOption("", "Choose a remote…");
          for (const name of options) dropdown.addOption(name, name);
          const selected = this.plugin.vaultBackupRemotePreference.get();
          dropdown.setValue(selected && options.includes(selected) ? selected : "");
          dropdown.onChange((value) => {
            this.plugin.vaultBackupRemotePreference.set(value || null);
            this.display();
          });
        });
      }
    });
  }
}

export function backupInspectionLabel(inspection: VaultBackupInspection): string {
  switch (inspection.kind) {
    case "ready": return "Ready";
    case "unsupported": return "Desktop filesystem vault required";
    case "git_unavailable": return "Git unavailable";
    case "not_repository": return "Not a Git repository";
    case "unsafe_repository_scope": return "Vault is inside a larger repository";
    case "detached_head": return "Detached HEAD";
    case "no_remote": return "No remote configured";
    case "ambiguous_remote": return "Multiple remotes; no origin";
    case "remote_not_found": return "Remote unavailable";
    default: return "Configuration check required";
  }
}
