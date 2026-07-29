export interface ManuscriptContainerRemovalPlan {
  readonly path: string;
  readonly mtime: number;
  readonly size: number;
  readonly errors: readonly string[];
}

export interface ManuscriptContainerRemovalAdapter<Plan extends ManuscriptContainerRemovalPlan> {
  revalidate(preview: Plan): Promise<Plan>;
  trash(path: string): Promise<void>;
  refreshNavigator(): void;
}

export async function executeManuscriptContainerRemoval<Plan extends ManuscriptContainerRemovalPlan>(
  adapter: ManuscriptContainerRemovalAdapter<Plan>,
  preview: Plan,
  invalid: (errors: readonly string[]) => Error
): Promise<void> {
  const current = await adapter.revalidate(preview);
  if (current.errors.length > 0) throw invalid(current.errors);
  await adapter.trash(current.path);
  adapter.refreshNavigator();
}

export async function confirmManuscriptContainerRemoval<Plan extends ManuscriptContainerRemovalPlan>(
  accepted: boolean,
  execute: () => Promise<void>
): Promise<boolean> {
  if (!accepted) return false;
  await execute();
  return true;
}
