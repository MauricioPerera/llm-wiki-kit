import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createWiki, initializeWiki } from '../../src/core/wiki.ts';
import type { FileAdapter } from '../../src/types/index.ts';
import { StubLLM } from './responses.ts';

function createMemoryAdapter(): FileAdapter {
  const json = new Map<string, unknown>();
  const bin = new Map<string, Uint8Array>();
  return {
    readJson<T = unknown>(f: string): T | null {
      return json.has(f) ? (json.get(f) as T) : null;
    },
    writeJson(f, d) { json.set(f, d); bin.delete(f); },
    readBin(f) {
      const v = bin.get(f);
      return v ? (new Uint8Array(v).buffer as ArrayBuffer) : null;
    },
    readBinShared(f) { return bin.get(f) ?? null; },
    writeBin(f, b) {
      const bytes = b instanceof Uint8Array ? new Uint8Array(b) : new Uint8Array(b);
      bin.set(f, bytes);
      json.delete(f);
    },
    delete(f) { json.delete(f); bin.delete(f); },
    async preload() {},
    async persist() {}
  };
}

async function main(): Promise<void> {
  const adapter = createMemoryAdapter();
  await initializeWiki(adapter);
  const wiki = await createWiki({
    path: resolve('.'),
    llmAdapter: new StubLLM(),
    storageAdapter: adapter
  });

  const sources = ['tessera.md', 'a2e.md', 'gemma.md'];
  for (const name of sources) {
    const path = resolve('examples/basic-wiki/sources', name);
    const content = await readFile(path, 'utf-8');
    const result = await wiki.ingest({ kind: 'text', content, format: 'md', sourceId: name.replace('.md', '') });
    console.log(`ingested ${name}: +${result.factsProduced.length} facts, ~${result.entitiesTouched.length} entities`);
  }

  const manifest = wiki.readManifest();
  console.log(`\nwiki has ${Object.keys(manifest.pages).length} pages:`);
  for (const path of Object.keys(manifest.pages).sort()) console.log(`  ${path}`);

  const answer = await wiki.query('what is Lattice-Nav and when did Helix launch Tessera-1?');
  console.log('\nQ: what is Lattice-Nav and when did Helix launch Tessera-1?');
  console.log('A:', answer.answer);
  console.log(`citations: ${answer.citations.length}, layers: ${answer.retrievalTrace.layersRun.join('+')}`);
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
