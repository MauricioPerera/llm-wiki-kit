#!/usr/bin/env node
// Postbuild: rewrite relative `.ts` import specifiers in emitted .d.ts files
// to `.js`. TypeScript 5.9's rewriteRelativeImportExtensions handles the
// emitted JavaScript but leaves declaration files untouched
// (microsoft/TypeScript#59767), so consumers that resolve with Node16 fail
// to find the imports. This script closes that gap.

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const RE = /(from\s+['"])(\.{1,2}\/[^'"]+?)\.ts(['"])/g;

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = join(dir, name);
    const st = await stat(full);
    if (st.isDirectory()) out.push(...await walk(full));
    else if (name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

async function main() {
  const files = await walk(DIST);
  let rewritten = 0;
  for (const file of files) {
    const before = await readFile(file, 'utf-8');
    const after = before.replace(RE, (_, a, path, b) => `${a}${path}.js${b}`);
    if (after !== before) {
      await writeFile(file, after, 'utf-8');
      rewritten += 1;
    }
  }
  process.stdout.write(`rewrite-dts: ${rewritten}/${files.length} .d.ts files updated\n`);
}

main().catch((err) => { process.stderr.write(err.stack + '\n'); process.exit(1); });
