export interface NavigatorBookSelectionState {
  readonly selectedBookPath: string | null;
  readonly lastActivePath: string | null;
  readonly pinned: boolean;
}

/**
 * Follow a newly active manuscript scene automatically, while preserving an
 * explicit book choice until the active file actually changes.
 */
export function reconcileNavigatorBookSelection(
  state: NavigatorBookSelectionState,
  activePath: string | null,
  activeBookPath: string | null
): NavigatorBookSelectionState {
  const activeChanged = activePath !== state.lastActivePath;
  const pinned = activeChanged ? false : state.pinned;

  return {
    selectedBookPath: activeBookPath && !pinned
      ? activeBookPath
      : state.selectedBookPath,
    lastActivePath: activePath,
    pinned
  };
}

/**
 * Invoke every renderer while retaining only the first non-null result.
 *
 * Keeping invocation separate from the nullish selection prevents later
 * siblings from disappearing once the active row has been found.
 */
export function renderAndRetainFirst<T>(
  current: T | null,
  renderNext: () => T | null
): T | null {
  const rendered = renderNext();
  return current ?? rendered;
}
