export interface ConnectedPreparationActions {
  readonly prepare: { readonly isConnected: boolean };
  readonly undo: { readonly isConnected: boolean };
}

/** A Navigator render may replace its toolbar; detached cached actions must be reinstalled. */
export function manuscriptPreparationActionsNeedInstallation(
  actions: ConnectedPreparationActions | undefined
): boolean {
  return !actions || !actions.prepare.isConnected || !actions.undo.isConnected;
}

export function manuscriptPreparationUndoNoticeVisible(
  undoAvailable: boolean,
  operationRunning: boolean
): boolean {
  return undoAvailable || operationRunning;
}
