import MurmurationWritingCompanionPlugin from "./main";
import { installManuscriptPreparationCommands } from "./manuscript/ManuscriptPreparationCommands";
import { installManuscriptReconciliationCommands } from "./manuscript/ManuscriptReconciliationCommands";
import {
  NAVIGATOR_CLICK_SHIELD_MS,
  shouldShieldNavigatorSceneActivation
} from "./manuscript/NavigatorActivationGuard";

export default class MurmurationWritingCompanionEntry extends MurmurationWritingCompanionPlugin {
  private navigatorRefreshTimer: number | null = null;
  private navigatorClickShield: HTMLDivElement | null = null;
  private navigatorClickShieldTimer: number | null = null;

  async onload() {
    await super.onload();
    installManuscriptPreparationCommands(this);
    installManuscriptReconciliationCommands(this);

    this.registerEvent(
      this.app.metadataCache.on("changed", () => this.queueNavigatorRefresh())
    );

    const protectSceneActivation = (event: MouseEvent) => {
      if (!shouldShieldNavigatorSceneActivation(event.detail)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>(
        ".mwc-manuscript-node--scene .mwc-manuscript-entry"
      );
      if (!button) return;

      this.installNavigatorClickShield(button);
    };

    document.addEventListener("click", protectSceneActivation, true);
    this.register(() => {
      document.removeEventListener("click", protectSceneActivation, true);
      this.clearNavigatorClickShield();
      if (this.navigatorRefreshTimer !== null) {
        window.clearTimeout(this.navigatorRefreshTimer);
        this.navigatorRefreshTimer = null;
      }
    });
  }

  private installNavigatorClickShield(button: HTMLButtonElement) {
    this.clearNavigatorClickShield();

    const rect = button.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const padding = 4;
    const shield = document.createElement("div");
    shield.className = "mwc-manuscript-click-shield";
    shield.setAttribute("aria-hidden", "true");
    Object.assign(shield.style, {
      position: "fixed",
      left: `${Math.max(0, rect.left - padding)}px`,
      top: `${Math.max(0, rect.top - padding)}px`,
      width: `${rect.width + padding * 2}px`,
      height: `${rect.height + padding * 2}px`,
      zIndex: "2147483647",
      background: "transparent",
      pointerEvents: "auto",
      cursor: "default",
      userSelect: "none"
    });

    const consume = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    shield.addEventListener("pointerdown", consume, true);
    shield.addEventListener("pointerup", consume, true);
    shield.addEventListener("mousedown", consume, true);
    shield.addEventListener("mouseup", consume, true);
    shield.addEventListener("click", consume, true);
    shield.addEventListener("dblclick", consume, true);
    shield.addEventListener("contextmenu", consume, true);

    document.body.appendChild(shield);
    this.navigatorClickShield = shield;
    this.navigatorClickShieldTimer = window.setTimeout(
      () => this.clearNavigatorClickShield(),
      NAVIGATOR_CLICK_SHIELD_MS
    );
  }

  private clearNavigatorClickShield() {
    if (this.navigatorClickShieldTimer !== null) {
      window.clearTimeout(this.navigatorClickShieldTimer);
      this.navigatorClickShieldTimer = null;
    }
    this.navigatorClickShield?.remove();
    this.navigatorClickShield = null;
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
