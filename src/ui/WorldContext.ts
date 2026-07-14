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
      cls: "mwc-context-list mwc-world-context-list",
      attr: { role: "list" }
    });

    for (const entry of group.entries) {
      const status = presentWorldStatus(entry.entity.status);
      const card = list.createEl("article", {
        cls: [
          "mwc-context-row",
          "mwc-context-row--editable",
          "mwc-world-context-card",
          `mwc-world-context-card--${status.tone}`
        ].join(" "),
        attr: { role: "listitem" }
      });
      const metadata = card.createDiv({
        cls: "mwc-context-label mwc-world-context-metadata"
      });
      metadata.createDiv({
        cls: "mwc-world-context-type",
        text: formatWorldEntityType(entry.entity.entityType)
      });
      const statusEl = metadata.createDiv({
        cls: `mwc-world-context-status mwc-world-context-status--${status.tone}`,
        text: status.label,
        attr: { title: "Story World canon status" }
      });

      if (status.tone === "provisional") {
        statusEl.style.color = "var(--text-warning)";
        statusEl.style.fontWeight = "700";
      } else if (status.tone === "unresolved") {
        statusEl.style.color = "var(--text-accent)";
        statusEl.style.fontWeight = "600";
      } else if (status.tone === "superseded") {
        card.style.opacity = "0.68";
      }

      if (entry.reasons.includes("pov")) {
        metadata.createDiv({
          cls: "mwc-world-context-reason",
          text: "POV",
          attr: { title: "Included from the chapter POV property" }
        });
      }

      const content = card.createDiv({
        cls: "mwc-context-value mwc-world-context-card-content"
      });
      const link = content.createEl("button", {
        cls: "mwc-context-input mwc-world-context-link",
        text: entry.entity.name,
        attr: {
          type: "button",
          title: `Open ${entry.entity.name}`,
          "aria-label": `Open Story World note for ${entry.entity.name}`
        }
      });
      link.onclick = (event) => openEntity(entry, event);

      if (entry.entity.summary) {
        content.createEl("p", {
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
