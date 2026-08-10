import { App, Component, TFile } from "obsidian";
import { isWikilinkActivationKey, presentWikilinkValues, resolvedReferenceNavigationTarget } from "../story-world/WikilinkPresentation";

export function renderWikilinkValues(
  container: Element,
  value: unknown,
  app: App,
  sourcePath: string,
  component: Component,
  options: { readonly separator?: string; readonly className?: string } = {}
): void {
  const values = presentWikilinkValues(value);
  values.forEach((item, index) => {
    if (index) container.createSpan({ text: options.separator ?? ", " });
    const target = item.linkpath ? app.metadataCache.getFirstLinkpathDest(item.linkpath, sourcePath) : null;
    if (target instanceof TFile) {
      const navigationTarget = resolvedReferenceNavigationTarget(target.path);
      const link = container.createEl("a", {
        cls: `internal-link ${options.className ?? ""}`.trim(), text: item.label,
        attr: { href: target.path, "data-href": target.path }
      });
      link.onclick = (event) => { event.preventDefault(); void app.workspace.openLinkText(navigationTarget, sourcePath); };
      link.onkeydown = (event) => {
        if (!isWikilinkActivationKey(event.key)) return;
        event.preventDefault(); void app.workspace.openLinkText(navigationTarget, sourcePath);
      };
      component.registerDomEvent(link, "auxclick", (event) => {
        if (event.button === 1) { event.preventDefault(); void app.workspace.openLinkText(navigationTarget, sourcePath, true); }
      });
    } else {
      container.createSpan({ cls: item.wikilink ? "mwc-wikilink-unresolved" : "mwc-scalar-value", text: item.label, attr: item.wikilink ? { title: `Unresolved: ${item.authored}` } : {} });
    }
  });
}
