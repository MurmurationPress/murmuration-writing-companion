import { StoryWorldEntityRecord } from "./StoryWorldIndex";

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function dateValue(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  return nonEmptyString(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads an event's intrinsic authoritative time without deriving or storing
 * another temporal fact. Both the early scalar form and the settled structured
 * form are accepted.
 */
export function getWorldEventDisplayTime(
  entity: StoryWorldEntityRecord
): string | null {
  if (entity.entityType.trim().toLowerCase() !== "event") return null;

  const worldTime = entity.properties.world_time;
  const scalar = dateValue(worldTime);
  if (scalar) return scalar;

  if (!isRecord(worldTime)) return null;

  return dateValue(worldTime.from)
    ?? dateValue(worldTime.at)
    ?? dateValue(worldTime.date);
}
