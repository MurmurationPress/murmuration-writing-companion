import type { ContinuityReviewItem } from "../observations/ContinuityReview";

export interface ContinuityDiagnosticPayload {
  readonly pluginVersion: string;
  readonly selectedBook: string;
  readonly rule: { readonly id: string; readonly version: number };
  readonly lineage: string;
  readonly fingerprint: string;
  readonly resolution: {
    readonly match: string;
    readonly disposition: string | null;
  };
  readonly sources: readonly {
    readonly path: string;
    readonly propertyPath: readonly (string | number)[];
  }[];
}

export function buildContinuityDiagnosticPayload(
  item: ContinuityReviewItem,
  selectedBook: string,
  pluginVersion: string
): ContinuityDiagnosticPayload {
  const observation = item.observation;
  return {
    pluginVersion,
    selectedBook,
    rule: { id: observation.rule.id, version: observation.rule.version },
    lineage: observation.lineageKey,
    fingerprint: observation.fingerprint,
    resolution: {
      match: item.match.state,
      disposition: item.match.record?.disposition ?? null
    },
    sources: observation.evidence.map((evidence) => ({
      path: evidence.source.note.path,
      propertyPath: [...evidence.source.property]
    }))
  };
}

export class ContinuityDiagnosticPreference {
  private value = false;

  constructor(private readonly storage: Storage | null, private readonly key: string) {
    try { this.value = storage?.getItem(key) === "true"; } catch { this.value = false; }
  }

  get(): boolean { return this.value; }

  set(value: boolean): void {
    this.value = value;
    try { this.storage?.setItem(this.key, String(value)); } catch { /* Keep the session preference. */ }
  }
}

export function shouldShowContinuityDiagnostics(preference: ContinuityDiagnosticPreference): boolean {
  return preference.get();
}
