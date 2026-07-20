import MurmurationWritingCompanionPlugin from "./main";
import { installManuscriptPreparationCommands } from "./manuscript/ManuscriptPreparationCommands";
import { installManuscriptReconciliationCommands } from "./manuscript/ManuscriptReconciliationCommands";
import { installPovCharacterCreationStyles } from "./ui/PovCharacterCreationStyles";

export default class MurmurationWritingCompanionEntry extends MurmurationWritingCompanionPlugin {
  private navigatorRefreshTimer: number | null = null;

  async onload() {
    await super.onload();
    installManuscriptPreparationCommands(this);
    installManuscriptReconciliationCommands(this);

    const povCharacterStyles = installPovCharacterCreationStyles();
    this.register(() => povCharacterStyles.remove());

    this.registerEvent(
      this.app.metadataCache.on("changed", () => this.queueNavigatorRefresh())
    );
    this.register(() => {
      if (this.navigatorRefreshTimer !== null) {
        window.clearTimeout(this.navigatorRefreshTimer);
        this.navigatorRefreshTimer = null;
      }
    });
  }

  private queueNavigatorRefresh() {
    if (this.navigatorRefreshTimer !== null) {
      window.clearTimeout(this.navigatorRefreshTimer);
    }
    this.navigatorRefreshTimer = window.setTimeout(() => {
      this.navigatorRefreshTimer = null;
      this.refreshManuscriptNavigator();
    }, 100);
  }
}
