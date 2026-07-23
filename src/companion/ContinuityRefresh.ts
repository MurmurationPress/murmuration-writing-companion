export interface ContinuityRefreshDecision {
  readonly companion: boolean;
  readonly manuscriptNavigator: boolean;
  readonly deferredChronology: boolean;
}

export function metadataContinuityRefreshDecision(input: {
  readonly changedPath: string;
  readonly manuscriptDependencies: ReadonlySet<string>;
  readonly worldChanged: boolean;
  readonly currentChapterChanged: boolean;
  readonly currentBookChanged: boolean;
}): ContinuityRefreshDecision {
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
