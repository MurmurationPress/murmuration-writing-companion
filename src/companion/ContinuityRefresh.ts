export interface ContinuityRefreshDecision {
  readonly companion: boolean;
  readonly manuscriptNavigator: boolean;
  readonly deferredChronology: boolean;
}

export function metadataContinuityRefreshDecision(input: {
  readonly changedPath: string;
  readonly settledManuscript?: boolean;
  readonly manuscriptDependencies: ReadonlySet<string>;
  readonly worldChanged: boolean;
  readonly currentChapterChanged: boolean;
  readonly currentBookChanged: boolean;
}): ContinuityRefreshDecision {
  // The integrity coordinator rereads metadata and refreshes both panes after
  // publishing the settled hierarchy. Earlier renders only show the old index.
  if (input.settledManuscript) return { companion: false, manuscriptNavigator: false, deferredChronology: false };
  const chronologyChanged = input.manuscriptDependencies.has(input.changedPath);
  return {
    companion: input.worldChanged || input.currentChapterChanged || input.currentBookChanged,
    manuscriptNavigator: true,
    deferredChronology: chronologyChanged
  };
}

export function dispositionContinuityRefreshDecision(): ContinuityRefreshDecision {
  return {
    companion: true,
    manuscriptNavigator: false,
    deferredChronology: false
  };
}
