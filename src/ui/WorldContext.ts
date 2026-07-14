import {
  formatWorldEntityType,
  groupWorldContextEntries,
  presentWorldStatus,
  WorldContextEntry,
  WorldContextResult
} from "../story-world/WorldContext";

export type OpenWorldContextEntity = (
  entry: WorldContextEntry,
  event: MouseEvent
) => void;

export function renderWorldContext(
  container: HTMLElement,
  result: WorldContextResult,
  openEntity: OpenWorldContextEntity
) {
  if (result.entries.length === 0) {
    container.createEl("p", {
      cls: "mwc-muted",
      text: result.unresolvedReferences.length > 0
        ? "No linked Story World entities could be resolved yet."
        : "No Story World entities are linked to this chapter."
    });
    return;
  }

  for (const group of groupWorldContextEntries(result.entries)) {
    const groupEl = container.createDiv("mwc-world-context-group");
    groupEl.createEl("h4", {
      cls: "mwc-world-context-group-title",
      text: group.label
    });
    const list = groupEl.createDiv({
      cls: "mwc-world-context-list",
      attr: { role: "list" }
    });

    for (const entry of group.entries) {
      const status = presentWorldStatus(entry.entity.status);
      const card = list.createEl("article", {
        cls: [
          "mwc-world-context-card",
          `mwc-world-context-card--${status.tone}`
        ].join(" "),
        attr: { role: "listitem" }
      });
      const header = card.createDiv("mwc-world-context-card-header");
      const link = header.createEl("button", {
        cls: "mwc-world-context-link",
        text: entry.entity.name,
        attr: {
          type: "button",
          title: `Open ${entry.entity.name}`,
          "aria-label": `Open Story World note for ${entry.entity.name}`
        }
      });
      link.onclick = (event) => openEntity(entry, event);

      const badges = header.createDiv("mwc-world-context-badges");
      badges.createSpan({
        cls: "mwc-world-context-type",
        text: formatWorldEntityType(entry.entity.entityType)
      });
      badges.createSpan({
        cls: `mwc-world-context-status mwc-world-context-status--${status.tone}`,
        text: status.label,
        attr: { title: "Story World canon status" }
      });

      if (entry.reasons.includes("pov")) {
        badges.createSpan({
          cls: "mwc-world-context-reason",
          text: "POV",
          attr: { title: "Included from the chapter POV property" }
        });
      }

      if (entry.entity.summary) {
        card.createEl("p", {
          cls: "mwc-world-context-summary",
          text: entry.entity.summary
        });
      }
    }
  }

  if (result.unresolvedReferences.length > 0) {
    const count = result.unresolvedReferences.length;
    container.createEl("p", {
      cls: "mwc-world-context-unresolved mwc-muted",
      text: `${count} ${count === 1 ? "reference" : "references"} could not be resolved.`
    });
  }
}
