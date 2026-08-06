import { parseWikilink } from "../story-world/StoryWorldIndex";

export interface WorldSourceAdditionPlan {
  readonly values: readonly unknown[];
  readonly changed: boolean;
}

export function planWorldSourceAddition(
  current: unknown,
  sourcePath: string,
  reference: string,
  resolveLinkpath: (linkpath: string) => string | null
): WorldSourceAdditionPlan {
  const values: unknown[] = current === undefined || current === null
    ? []
    : Array.isArray(current)
      ? [...current]
      : typeof current === "string"
        ? [current]
        : (() => { throw new Error("The entity's world_sources property is not a string or list and was left unchanged."); })();
  const expected = sourcePath.toLowerCase();
  const duplicate = values.some((value) => {
    const parsed = parseWikilink(value);
    if (!parsed) return false;
    return resolveLinkpath(parsed.linkpath)?.toLowerCase() === expected;
  });
  return duplicate ? { values, changed: false } : { values: [...values, reference], changed: true };
}
