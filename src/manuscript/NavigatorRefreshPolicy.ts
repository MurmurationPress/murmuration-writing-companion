export interface NavigatorRefreshContext {
  readonly navigatorIsActive: boolean;
  readonly sceneActivationInProgress: boolean;
}

/**
 * A scene press may temporarily make the sidebar leaf active before the scene
 * opens in an editor leaf. Rerendering the navigator during that physical press
 * replaces the DOM beneath the pointer and can make the same press land on a
 * disclosure control. Defer only that transient refresh; all settled and
 * non-scene refreshes remain immediate.
 */
export function shouldRefreshNavigator(
  context: NavigatorRefreshContext
): boolean {
  return !(context.navigatorIsActive && context.sceneActivationInProgress);
}
