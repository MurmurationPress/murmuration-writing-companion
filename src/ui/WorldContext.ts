import {
  buildWorldContextHierarchy,
  formatWorldEntityType,
  presentWorldStatus,
  WorldContextEntry,
  WorldContextGroup,
  WorldContextResult,
  WorldStatusPresentation
} from "../story-world/WorldContext";
import { getWorldEventDisplayTime } from "../story-world/WorldTime";

export type OpenWorldContextEntity = (
  entry: WorldContextEntry,
  event: MouseEvent
) => void;

export type PreviewWorldContextEntity = (
  entry: WorldContextEntry,
  target: HTMLElement,
  event: MouseEvent | FocusEvent
) => void;

function entityDestination(entry: WorldContextEntry): string {
  return entry.entity.path.replace(/\.md$/i, "");
}

function applyStatusTone(
  container: HTMLElement,
  statusEl: HTMLElement,
  status: WorldStatusPresentation
) {
  if (status.tone === "provisional") {
    statusEl.style.color = "var(--text-warning)";
    statusEl.style.fontWeight = "700";
  } else if (status.tone === "unresolved") {
    statusEl.style.color = "var(--text-accent)";
    statusEl.style.fontWeight = "600";
  } else if (status.tone === "superseded") {
    container.style.opacity = "0.68";
  }
}

function createEntityLink(
  container: HTMLElement,
  entry: WorldContextEntry,
  openEntity: OpenWorldContextEntity,
  previewEntity: PreviewWorldContextEntity | undefined,
  className: string
): HTMLAnchorElement {
  const destination = entityDestination(entry);
  const link = container.createEl("a", {
    cls: `internal-link ${className}`,
    text: entry.entity.name,
    attr: {
      href: destination,
      "data-href": destination,
      "aria-label": `Open Story World note for ${entry.entity.name}`
    }
  });

  link.addEventListener("click", (event) => {
    event.preventDefault();
    openEntity(entry, event);
  });

  if (previewEntity) {
    link.addEventListener("mouseenter", (event) => {
      previewEntity(entry, link, event);
    });
    link.addEventListener("focus", (event) => {
      previewEntity(entry, link, event);
    });
  }

  return link;
}

function renderEventGroup(
  container: HTMLElement,
  entries: readonly WorldContextEntry[],
  openEntity: OpenWorldContextEntity,
  previewEntity: PreviewWorldContextEntity | undefined
) {
  if (entries.length === 0) return;

  const groupEl = container.createDiv(
    "mwc-world-context-group mwc-world-context-group--events"
  );
  groupEl.createEl("h4", {
    cls: "mwc-world-context-group-title",
    text: "Events"
  });
  const list = groupEl.createDiv({
    cls: "mwc-context-list mwc-world-context-list mwc-world-context-event-list",
    attr: { role: "list" }
  });

  for (const entry of entries) {
    const status = presentWorldStatus(entry.entity.status);
    const eventTime = getWorldEventDisplayTime(entry.entity);
    const card = list.createEl("article", {
      cls: [
        "mwc-context-row",
        "mwc-context-row--editable",
        "mwc-world-context-card",
        "mwc-world-context-event-card",
        `mwc-world-context-card--${status.tone}`
      ].join(" "),
      attr: { role: "listitem" }
    });
    const metadata = card.createDiv({
      cls: "mwc-context-label mwc-world-context-metadata"
    });
    metadata.createDiv({
      cls: "mwc-world-context-type",
      text: "Event"
    });

    if (eventTime) {
      metadata.createEl("time", {
        cls: "mwc-world-context-time",
        text: eventTime,
        attr: { datetime: eventTime }
      });
    }

    const statusEl = metadata.createDiv({
      cls: `mwc-world-context-status mwc-world-context-status--${status.tone}`,
      text: status.label,
      attr: { title: "Story World canon status" }
    });
    applyStatusTone(card, statusEl, status);

    const content = card.createDiv({
      cls: "mwc-context-value mwc-world-context-card-content"
    });
    createEntityLink(
      content,
      entry,
      openEntity,
      previewEntity,
      "mwc-world-context-link mwc-world-context-event-link"
    );

    if (entry.entity.summary) {
      content.createEl("p", {
        cls: "mwc-world-context-summary",
        text: entry.entity.summary
      });
    }
  }
}

function renderSupportingGroup(
  container: HTMLElement,
  group: WorldContextGroup,
  openEntity: OpenWorldContextEntity,
  previewEntity: PreviewWorldContextEntity | undefined
) {
  const groupEl = container.createDiv(
    "mwc-world-context-group mwc-world-context-group--supporting"
  );
  groupEl.createEl("h4", {
    cls: "mwc-world-context-group-title",
    text: group.label
  });
  const list = groupEl.createDiv({
    cls: "mwc-world-context-supporting-list",
    attr: { role: "list" }
  });

  for (const entry of group.entries) {
    const status = presentWorldStatus(entry.entity.status);
    const item = list.createDiv({
      cls: [
        "mwc-world-context-supporting-item",
        `mwc-world-context-supporting-item--${status.tone}`
      ].join(" "),
      attr: { role: "listitem" }
    });
    applyStatusTone(item, item, status);
    createEntityLink(
      item,
      entry,
      openEntity,
      previewEntity,
      "mwc-world-context-supporting-link"
    );
  }
}

export function renderWorldContext(
  container: HTMLElement,
  result: WorldContextResult,
  openEntity: OpenWorldContextEntity,
  previewEntity?: PreviewWorldContextEntity
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

  const hierarchy = buildWorldContextHierarchy(result.entries);
  renderEventGroup(container, hierarchy.events, openEntity, previewEntity);

  for (const group of hierarchy.supportingGroups) {
    renderSupportingGroup(container, group, openEntity, previewEntity);
  }

  if (result.unresolvedReferences.length > 0) {
    const count = result.unresolvedReferences.length;
    container.createEl("p", {
      cls: "mwc-world-context-unresolved mwc-muted",
      text: `${count} ${count === 1 ? "reference" : "references"} could not be resolved.`
    });
  }
}
