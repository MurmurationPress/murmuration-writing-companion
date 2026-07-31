import type {
  ManuscriptPreparationPlan,
  ManuscriptPreparationState
} from "../manuscript/ManuscriptPreparation";

export type ProjectReadinessState =
  | "ready_to_begin"
  | "no_manuscript"
  | "preparation_available"
  | "preparation_needs_attention"
  | "project_prepared"
  | "structural_conflict";

export type ReadinessActionId =
  | "open_manuscript_navigator"
  | "prepare_manuscript"
  | "view_preparation_diagnostics"
  | "open_story_world_navigator"
  | "run_story_world_review"
  | "run_continuity_review"
  | "open_documentation"
  | "recheck";

export interface ReadinessAction {
  readonly id: ReadinessActionId;
  readonly label: string;
  readonly bookPath?: string;
}

export interface ManuscriptReadinessPresentation {
  readonly bookPath: string;
  readonly title: string;
  readonly state: ManuscriptPreparationState;
  readonly stateLabel: string;
  readonly summary: string;
  readonly sourceLabel: string;
  readonly partCount: number;
  readonly sceneCount: number;
  readonly canPrepare: boolean;
  readonly diagnostics: readonly string[];
  readonly actions: readonly ReadinessAction[];
}

export interface StoryWorldReadinessPresentation {
  readonly state: "absent" | "present" | "needs_review";
  readonly entityCount: number;
  readonly eventCount: number;
  readonly significantObservationCount: number;
  readonly summary: string;
}

export interface EditorialStoragePresentation {
  readonly state: "absent" | "present" | "unreadable";
  readonly summary: string;
}

export interface ProjectReadinessPresentation {
  readonly overallState: ProjectReadinessState;
  readonly headline: string;
  readonly summary: string;
  readonly bookCount: number;
  readonly partCount: number;
  readonly sceneCount: number;
  readonly markdownFileCount: number;
  readonly unresolvedManuscriptNoteCount: number;
  readonly manuscripts: readonly ManuscriptReadinessPresentation[];
  readonly storyWorld: StoryWorldReadinessPresentation;
  readonly editorialStorage: EditorialStoragePresentation;
  readonly actions: readonly ReadinessAction[];
}

export interface ProjectReadinessInput {
  readonly markdownFileCount: number;
  readonly unresolvedManuscriptNotes: readonly string[];
  readonly manuscripts: readonly {
    readonly plan: ManuscriptPreparationPlan;
    readonly partCount: number;
    readonly sceneCount: number;
  }[];
  readonly storyWorld: {
    readonly entityCount: number;
    readonly eventCount: number;
    readonly significantObservationCount: number;
  };
  readonly editorialStorageState: EditorialStoragePresentation["state"];
}

const blockedStates = new Set<ManuscriptPreparationState>([
  "conflicting_distributed_metadata",
  "malformed_or_incomplete_legacy_metadata",
  "ambiguous_hierarchy",
  "unsupported_or_unrecognised"
]);

function sourceLabel(source: ManuscriptPreparationPlan["source"]): string {
  if (source === "distributed") return "authoritative note properties";
  if (source === "legacy_array") return "the Book's legacy manuscript_order list";
  if (source === "legacy") return "the current Navigator folder and filename order";
  return "no safe order source";
}

function stateCopy(state: ManuscriptPreparationState, canApply: boolean): { label: string; summary: string } {
  switch (state) {
    case "fully_prepared": return { label: "Prepared", summary: "This Book already uses authoritative parent links and distributed order keys." };
    case "legacy_array": return { label: "Preparation available", summary: "A complete legacy reading order was recognised and can be converted after a full preview." };
    case "deterministic_folder_order": return { label: "Preparation available", summary: "The Navigator has a deterministic folder and filename order that can be made authoritative after a full preview." };
    case "partially_distributed": return canApply
      ? { label: "Preparation available", summary: "Some authoritative structure is present; the existing preparation workflow can complete it safely." }
      : { label: "Preparation needs attention", summary: "Some authoritative structure is present, but safe completion is blocked until the listed issues are resolved." };
    case "conflicting_distributed_metadata": return { label: "Structural conflict", summary: "Authoritative properties disagree. MWC has not selected a fallback interpretation." };
    case "malformed_or_incomplete_legacy_metadata": return { label: "Legacy metadata needs attention", summary: "The legacy reading-order metadata is incomplete or malformed and must be corrected before preparation." };
    case "ambiguous_hierarchy": return { label: "Hierarchy needs attention", summary: "More than one manuscript interpretation is possible, so MWC has not chosen one." };
    default: return { label: "Structure not recognised", summary: "MWC cannot yet recognise a safe Book, Part and Scene sequence for this Book." };
  }
}

function manuscriptPresentation(input: ProjectReadinessInput["manuscripts"][number]): ManuscriptReadinessPresentation {
  const { plan } = input;
  const copy = stateCopy(plan.state, plan.canApply);
  const actions: ReadinessAction[] = [];
  if (plan.canApply && !plan.alreadyPrepared) actions.push({ id: "prepare_manuscript", label: `Prepare ${plan.bookTitle}`, bookPath: plan.bookPath });
  else if (plan.alreadyPrepared) actions.push({ id: "run_continuity_review", label: `Run Continuity Review for ${plan.bookTitle}`, bookPath: plan.bookPath });
  else if (!plan.alreadyPrepared && plan.diagnostics.length) actions.push({ id: "view_preparation_diagnostics", label: `View diagnostics for ${plan.bookTitle}`, bookPath: plan.bookPath });
  return {
    bookPath: plan.bookPath,
    title: plan.bookTitle,
    state: plan.state,
    stateLabel: copy.label,
    summary: copy.summary,
    sourceLabel: sourceLabel(plan.source),
    partCount: input.partCount,
    sceneCount: input.sceneCount,
    canPrepare: plan.canApply && !plan.alreadyPrepared,
    diagnostics: plan.diagnostics.map((diagnostic) => diagnostic.path ? `${diagnostic.path}: ${diagnostic.message}` : diagnostic.message),
    actions
  };
}

export function projectReadiness(input: ProjectReadinessInput): ProjectReadinessPresentation {
  const manuscripts = input.manuscripts.map(manuscriptPresentation);
  const bookCount = manuscripts.length;
  const partCount = manuscripts.reduce((sum, book) => sum + book.partCount, 0);
  const sceneCount = manuscripts.reduce((sum, book) => sum + book.sceneCount, 0);
  let overallState: ProjectReadinessState;
  if (!bookCount) overallState = input.markdownFileCount === 0 ? "ready_to_begin" : "no_manuscript";
  else if (manuscripts.some((book) => blockedStates.has(book.state))) overallState = "structural_conflict";
  else if (manuscripts.some((book) => book.state === "partially_distributed" && !book.canPrepare)) overallState = "preparation_needs_attention";
  else if (manuscripts.some((book) => book.canPrepare)) overallState = "preparation_available";
  else overallState = "project_prepared";

  const overall = {
    no_manuscript: ["Existing notes found, but no manuscript is recognised", `MWC found ${input.markdownFileCount} Markdown note${input.markdownFileCount === 1 ? "" : "s"}, but none is a recognised Book note. Folder names alone do not establish manuscript structure.`],
    structural_conflict: ["Structural conflict requires review", "MWC found manuscript structure it cannot interpret safely. Review the affected notes; no repair has been attempted."],
    preparation_needs_attention: ["Manuscript preparation needs attention", "Some manuscript authority is incomplete and cannot yet be completed safely."],
    preparation_available: ["Manuscript preparation available", "One or more Books can be prepared through the existing previewed, reversible workflow."],
    project_prepared: ["Project already prepared", "Recognised Books use authoritative note properties and are ready for navigation."],
    ready_to_begin: ["Ready to begin", "This vault contains no Markdown notes yet. You can start a manuscript when you are ready; nothing needs to be repaired."]
  }[overallState];

  const entities = input.storyWorld.entityCount;
  const significant = input.storyWorld.significantObservationCount;
  const storyWorld: StoryWorldReadinessPresentation = entities === 0
    ? { state: "absent", entityCount: 0, eventCount: 0, significantObservationCount: 0, summary: "No Story World is present. Story World notes are optional for manuscript work." }
    : { state: significant > 0 ? "needs_review" : "present", entityCount: entities, eventCount: input.storyWorld.eventCount, significantObservationCount: significant, summary: significant > 0 ? `${entities} entities are recognised; ${significant} significant review observation${significant === 1 ? "" : "s"} may need attention.` : `${entities} Story World entit${entities === 1 ? "y is" : "ies are"} recognised. Story World use remains optional.` };
  const editorialStorage: EditorialStoragePresentation = input.editorialStorageState === "present"
    ? { state: "present", summary: "Existing editorial information was recognised. It remains separate from manuscript authority." }
    : input.editorialStorageState === "unreadable"
      ? { state: "unreadable", summary: "Existing editorial information could not be read. Onboarding has not modified it." }
      : { state: "absent", summary: "No editorial information is currently stored. Opening readiness does not create it." };
  const actions: ReadinessAction[] = [];
  if (bookCount || overallState === "ready_to_begin") actions.push({ id: "open_manuscript_navigator", label: overallState === "ready_to_begin" ? "Open Manuscript Navigator to create a Book" : "Open Manuscript Navigator" });
  if (entities) {
    actions.push({ id: "open_story_world_navigator", label: "Open Story World Navigator" });
    if (significant) actions.push({ id: "run_story_world_review", label: "Run Story World Review" });
  }
  actions.push({ id: "open_documentation", label: "Read project readiness guidance" }, { id: "recheck", label: "Recheck project readiness" });
  return { overallState, headline: overall[0], summary: overall[1], bookCount, partCount, sceneCount, markdownFileCount: input.markdownFileCount, unresolvedManuscriptNoteCount: input.unresolvedManuscriptNotes.length, manuscripts, storyWorld, editorialStorage, actions };
}
