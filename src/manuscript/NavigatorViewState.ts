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
