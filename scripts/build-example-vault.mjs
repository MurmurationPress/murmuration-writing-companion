import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "examples", "v2-onboarding");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function filesBelow(directory, relative = "") {
  const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(directory, child));
    else if (entry.isFile()) files.push(child.split(path.sep).join("/"));
  }
  return files;
}

function localHeader(name, data, checksum) {
  const nameBytes = Buffer.from(name);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0x5021, 12); // 2020-01-01, 00:00:00
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  return Buffer.concat([header, nameBytes, data]);
}

function centralHeader(name, data, checksum, offset) {
  const nameBytes = Buffer.from(name);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0x5021, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, nameBytes]);
}

export async function buildExampleVaultArchive(outputPath) {
  const relativeFiles = await filesBelow(sourceRoot);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const relative of relativeFiles) {
    const data = await readFile(path.join(sourceRoot, relative));
    const name = `mwc-v2-example-vaults/${relative}`;
    const checksum = crc32(data);
    const local = localHeader(name, data, checksum);
    locals.push(local);
    centrals.push(centralHeader(name, data, checksum, offset));
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(relativeFiles.length, 8);
  end.writeUInt16LE(relativeFiles.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  const archive = Buffer.concat([...locals, central, end]);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, archive);
  return { outputPath, files: relativeFiles, bytes: archive.length };
}

const requested = process.argv.indexOf("--output");
const outputPath = requested >= 0 && process.argv[requested + 1]
  ? path.resolve(process.argv[requested + 1])
  : path.join(projectRoot, "dist", "mwc-v2-example-vaults.zip");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildExampleVaultArchive(outputPath);
  console.log(`Created ${result.outputPath} with ${result.files.length} files (${result.bytes} bytes).`);
}
