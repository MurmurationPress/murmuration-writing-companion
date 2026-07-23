import { findAliasedProperty, getChapterContextField } from "../companion/ChapterContext";
import { parseTemporalInterval, TemporalPrecision } from "../observations/TemporalInterval";

export interface PrecedingStoryDateScene {
  readonly path: string;
  readonly title: string;
  readonly frontmatter: Readonly<Record<string, unknown>> | undefined;
}

export interface PrecedingStoryDateProposal {
  readonly sourcePath: string;
  readonly sourceTitle: string;
  readonly sourcePosition: number;
  readonly property: string;
  readonly raw: unknown;
  readonly value: string;
  readonly precision: TemporalPrecision;
}

export function precedingStoryDate(
  scenes: readonly PrecedingStoryDateScene[],
  hypotheticalPosition: number
): PrecedingStoryDateProposal | null {
  const start = Math.min(Math.max(0, hypotheticalPosition), scenes.length) - 1;
  const aliases = getChapterContextField("story_date").aliases;
  for (let index = start; index >= 0; index -= 1) {
    const scene = scenes[index];
    const match = findAliasedProperty(scene.frontmatter, aliases);
    if (!match) continue;
    const parsed = parseTemporalInterval(match.value);
    if (parsed.kind !== "supported" || !parsed.value.point || parsed.value.authoredShape === "range") continue;
    return {
      sourcePath: scene.path,
      sourceTitle: scene.title,
      sourcePosition: index,
      property: match.property,
      raw: match.value,
      value: parsed.value.source,
      precision: parsed.value.precision
    };
  }
  return null;
}
