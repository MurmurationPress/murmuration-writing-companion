interface ExactContentProtection {
  readonly content: string;
  restoring: boolean;
}

const protectionsByAuthority = new WeakMap<object, Map<string, ExactContentProtection>>();

function protectionsFor(authority: object): Map<string, ExactContentProtection> {
  let protections = protectionsByAuthority.get(authority);
  if (!protections) {
    protections = new Map();
    protectionsByAuthority.set(authority, protections);
  }
  return protections;
}

export function beginExactContentRestoration(
  authority: object,
  contentsByPath: ReadonlyMap<string, string>
): void {
  const protections = protectionsFor(authority);
  for (const [path, content] of contentsByPath) {
    protections.set(path, { content, restoring: true });
  }
}

export function completeExactContentRestoration(
  authority: object,
  paths: readonly string[]
): void {
  const protections = protectionsFor(authority);
  for (const path of paths) {
    const protection = protections.get(path);
    if (protection) protection.restoring = false;
  }
}

export function cancelExactContentRestoration(
  authority: object,
  paths: readonly string[]
): void {
  const protections = protectionsFor(authority);
  for (const path of paths) protections.delete(path);
}

export function hasExactContentProtection(authority: object, path: string): boolean {
  return protectionsFor(authority).has(path);
}

export async function exactContentIsProtected(
  authority: object,
  path: string,
  read: () => Promise<string>
): Promise<boolean> {
  const protections = protectionsFor(authority);
  const protection = protections.get(path);
  if (!protection) return false;
  if (protection.restoring) return true;
  if (await read() === protection.content) return true;
  protections.delete(path);
  return false;
}
