import {context} from 'esbuild';
import {stylesheetBuildOptions} from './build-styles.mjs';
const js = await context({entryPoints:['src/entry.ts'],bundle:true,external:['obsidian','node:*'],format:'cjs',target:'es2018',outfile:'main.js',sourcemap:true,logLevel:'info'});
const css = await context({...stylesheetBuildOptions(),minifyWhitespace:false,logLevel:'info'});
await Promise.all([js.watch(),css.watch()]);
