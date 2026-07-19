import MurmurationWritingCompanionPlugin from "./main";
import { installManuscriptPreparationCommands } from "./manuscript/ManuscriptPreparationCommands";
import { installManuscriptReconciliationCommands } from "./manuscript/ManuscriptReconciliationCommands";
import { isRepeatedNavigatorActivation } from "./manuscript/NavigatorActivationGuard";

export default class MurmurationWritingCompanionEntry extends MurmurationWritingCompanionPlugin {
  private navigatorRefreshTimer: number | null = null;

  async onload() {
    await super.onload();
    installManuscriptPreparationCommands(this);
    installManuscriptReconciliationCommands(this);

    this.registerEvent(
      this.app.metadataCache.on("changed", () => this.queueNavigatorRefresh())
    );

    const suppressRepeatedNavigatorActivation = (event: MouseEvent) => {
      if (!isRepeatedNavigatorActivation(event.detail)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".mwc-manuscript-navigator")) return;

      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const guardedEvents: Array<keyof DocumentEventMap> = [
      "mousedown",
      "mouseup",
      "click",
      "dblclick"
    ];

    for (const eventName of guardedEvents) {
      document.addEventListener(eventName, suppressRepeatedNavigatorActivation, true);
    }

    this.register(() => {
      for (const eventName of guardedEvents) {
        document.removeEventListener(eventName, suppressRepeatedNavigatorActivation, true);
      }
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
