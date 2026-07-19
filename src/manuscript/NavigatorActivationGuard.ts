/**
 * Browsers retain the click count across a rapid mouse sequence even when the
 * navigator rerenders between presses. Treat only the first activation as
 * meaningful so a shifted DOM target cannot receive the second press.
 */
export function isRepeatedNavigatorActivation(detail: number): boolean {
  return Number.isFinite(detail) && detail > 1;
}
