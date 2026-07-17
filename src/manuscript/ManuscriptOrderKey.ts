export const MANUSCRIPT_ORDER_KEY_PROPERTY = "manuscript_order_key";

export const MANUSCRIPT_ORDER_KEY_LENGTH = 10;

const ORDER_KEY_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ORDER_KEY_RADIX = ORDER_KEY_ALPHABET.length;
const ORDER_KEY_MAX_VALUE = ORDER_KEY_RADIX ** MANUSCRIPT_ORDER_KEY_LENGTH - 1;
const ORDER_KEY_PATTERN = new RegExp(
  `^[${ORDER_KEY_ALPHABET}]{${MANUSCRIPT_ORDER_KEY_LENGTH}}$`
);

function encodeOrderKey(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > ORDER_KEY_MAX_VALUE) {
    throw new Error("Manuscript order-key value is outside the supported range.");
  }

  let remaining = value;
  let encoded = "";
  for (let index = 0; index < MANUSCRIPT_ORDER_KEY_LENGTH; index += 1) {
    encoded = ORDER_KEY_ALPHABET[remaining % ORDER_KEY_RADIX] + encoded;
    remaining = Math.floor(remaining / ORDER_KEY_RADIX);
  }
  return encoded;
}

function decodeOrderKey(value: string): number {
  let decoded = 0;
  for (const character of value) {
    decoded = decoded * ORDER_KEY_RADIX + ORDER_KEY_ALPHABET.indexOf(character);
  }
  return decoded;
}

export function manuscriptOrderKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return ORDER_KEY_PATTERN.test(trimmed) ? trimmed : null;
}

export function compareManuscriptOrderKeys(left: string, right: string): number {
  return left.localeCompare(right, "en", { sensitivity: "case" });
}

export function manuscriptOrderKeyBetween(
  before: string | null,
  after: string | null
): string | null {
  const lower = before ? decodeOrderKey(before) : 0;
  const upper = after ? decodeOrderKey(after) : ORDER_KEY_MAX_VALUE;

  if (lower >= upper - 1) return null;
  const midpoint = Math.floor((lower + upper) / 2);
  if (midpoint <= lower || midpoint >= upper) return null;
  return encodeOrderKey(midpoint);
}

export function evenlySpacedManuscriptOrderKeys(count: number): string[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Manuscript order-key count must be a non-negative integer.");
  }
  if (count === 0) return [];

  const spacing = Math.floor(ORDER_KEY_MAX_VALUE / (count + 1));
  if (spacing < 1) {
    throw new Error("Too many manuscript siblings to allocate order keys safely.");
  }

  return Array.from({ length: count }, (_, index) => (
    encodeOrderKey(spacing * (index + 1))
  ));
}

export function manuscriptOrderKeyAssignments(
  pathsInOrder: readonly string[]
): ReadonlyMap<string, string> {
  const keys = evenlySpacedManuscriptOrderKeys(pathsInOrder.length);
  return new Map(pathsInOrder.map((path, index) => [path, keys[index]]));
}
