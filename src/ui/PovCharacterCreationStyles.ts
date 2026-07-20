export const POV_CHARACTER_CREATION_STYLES = `
.mwc-pov-character-offer {
  margin-top: 5px;
  padding: 7px 8px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary-alt);
  color: var(--text-muted);
  font-size: 0.78em;
  line-height: 1.35;
}

.mwc-pov-character-offer-text {
  margin: 0;
}

.mwc-pov-character-offer-actions,
.mwc-pov-character-modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 7px;
}

.mwc-pov-character-offer button {
  padding: 3px 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  cursor: pointer;
  box-shadow: none;
}

.mwc-pov-character-offer button:hover,
.mwc-pov-character-offer button:focus-visible {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.mwc-pov-character-offer .mwc-pov-character-create {
  color: var(--text-accent);
  font-weight: 650;
}

.mwc-pov-character-preview {
  margin: 12px 0;
}

.mwc-pov-character-preview-row {
  display: grid;
  grid-template-columns: minmax(64px, auto) minmax(0, 1fr);
  gap: 10px;
  padding: 4px 0;
}

.mwc-pov-character-preview-row dt {
  color: var(--text-muted);
  font-weight: 650;
}

.mwc-pov-character-preview-row dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
`;

export function installPovCharacterCreationStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.dataset.mwcPovCharacterCreation = "true";
  style.textContent = POV_CHARACTER_CREATION_STYLES;
  document.head.appendChild(style);
  return style;
}
