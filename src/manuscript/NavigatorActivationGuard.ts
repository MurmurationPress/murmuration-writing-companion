export const NAVIGATOR_CLICK_SHIELD_MS = 450;

/**
 * Only a genuine first mouse click needs a temporary click shield. Keyboard or
 * programmatic activation has detail 0, while repeated clicks are already aimed
 * at the shield created by the first click.
 */
export function shouldShieldNavigatorSceneActivation(detail: number): boolean {
  return detail === 1;
}
