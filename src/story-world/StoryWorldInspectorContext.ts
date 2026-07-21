export interface ActiveMarkdownInspectorContext {
  readonly path: string;
  readonly isStoryWorldItem: boolean;
}

export function reconcileStoryWorldInspectorPath(
  currentPath: string | null,
  activeMarkdown: ActiveMarkdownInspectorContext | null
): string | null {
  if (!activeMarkdown) return currentPath;
  return activeMarkdown.isStoryWorldItem ? activeMarkdown.path : null;
}
