import MurmurationWritingCompanionPlugin from "./main";
import { installManuscriptPreparationCommands } from "./manuscript/ManuscriptPreparationCommands";
import { installManuscriptReconciliationCommands } from "./manuscript/ManuscriptReconciliationCommands";
import { NavigatorActivationGuard } from "./manuscript/NavigatorActivationGuard";

export default class MurmurationWritingCompanionEntry extends MurmurationWritingCompanionPlugin {
  private navigatorRefreshTimer: number | null = null;
  private readonly navigatorActivationGuard = new NavigatorActivationGuard();

  async onload() {
    await super.onload();
    installManuscriptPreparationCommands(this);
    installManuscriptReconciliationCommands(this);

    this.registerEvent(
      this.app.metadataCache.on("changed", () => this.queueNavigatorRefresh())
    );

    const guardRapidNavigatorActivation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const navigator = target.closest(".mwc-manuscript-navigator");
      if (!navigator) return;

      if (this.navigatorActivationGuard.blocks()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (target.closest(".mwc-manuscript-entry")) {
        this.navigatorActivationGuard.begin();
      }
    };

    document.addEventListener("click", guardRapidNavigatorActivation, true);
    this.register(() => {
      document.removeEventListener("click", guardRapidNavigatorActivation, true);
      this.navigatorActivationGuard.clear();
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
