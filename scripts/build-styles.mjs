import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

export function stylesheetBuildOptions() {
  return {entryPoints:['src/styles/plugin.css'],bundle:true,outfile:'styles.css',
    minifyWhitespace:true,logLevel:'silent'};
}

export async function stylesheetBytes(root = '.') {
  try {
    await readFile(path.resolve(root,'src/styles/plugin.css'));
  } catch(error) {
    if(error.code !== 'ENOENT') throw error;
    return readFile(path.resolve(root,'styles.css')); // Historical source snapshots.
  }
  const result = await build({...stylesheetBuildOptions(),absWorkingDir:path.resolve(root),write:false});
  if(result.warnings.length) throw new Error('Unexpected stylesheet warning');
  return result.outputFiles[0].contents;
}

export function shippedAssetsReport(js, css, manifest) {
  const sizes = value => ({rawBytes:Buffer.byteLength(value),gzipBytes:gzipSync(value).length});
  const assets = {'main.js':sizes(js),'styles.css':sizes(css),'manifest.json':sizes(manifest)};
  return {assets,totalRawBytes:Object.values(assets).reduce((n,a)=>n+a.rawBytes,0),
    totalGzipBytes:Object.values(assets).reduce((n,a)=>n+a.gzipBytes,0)};
}
