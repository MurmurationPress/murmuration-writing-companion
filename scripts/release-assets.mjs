import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const releaseAssets = ['main.js', 'manifest.json', 'styles.css'];

/** Standard sha256sum format, fixed order, with no host paths or timestamps. */
export async function releaseChecksums(root) {
  return (await Promise.all(releaseAssets.map(async name => {
    const bytes = await readFile(path.join(root, name));
    if (!bytes.length) throw new Error(`${name} is empty`);
    return `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`;
  }))).join('');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(await releaseChecksums(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')));
}
