import MurmurationWritingCompanionPlugin from "./main";
import { installManuscriptPreparationCommands } from "./manuscript/ManuscriptPreparationCommands";
import { installManuscriptReconciliationCommands } from "./manuscript/ManuscriptReconciliationCommands";
import { ManuscriptNavigatorView } from "./manuscript/ManuscriptNavigatorView";
import { shouldRefreshNavigator } from "./manuscript/NavigatorRefreshPolicy";

export default class MurmurationWritingCompanionEntry extends MurmurationWritingCompanionPlugin {
  private navigatorRefreshTimer: number | null = null;

  async onload() {
    await super.onload();
    installManuscriptPreparationCommands(this);
    installManuscriptReconciliationCommands(this);

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

  override refreshManuscriptNavigator() {
    const navigatorIsActive = Boolean(
      this.app.workspace.getActiveViewOfType(ManuscriptNavigatorView)
    );
    const focused = document.activeElement;
    const sceneEntryFocused = focused instanceof Element
      && Boolean(focused.closest(
        ".mwc-manuscript-node--scene .mwc-manuscript-entry"
      ));
    const sceneEntryPressed = document.querySelector(
      ".mwc-manuscript-node--scene .mwc-manuscript-entry:active"
    ) !== null;

    if (!shouldRefreshNavigator({
      navigatorIsActive,
      sceneActivationInProgress: sceneEntryFocused || sceneEntryPressed
    })) {
      return;
    }

    super.refreshManuscriptNavigator();
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
